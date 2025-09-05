import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.database import (
    IncentiveSchedule, IncentiveEpoch, Participant, User, Trade, TradeRiskFlag
)
from app.services.incentive_service import incentive_service

@pytest.mark.asyncio
async def test_risk_flag_exclusion_and_normalization(db_session: Session):
    now = datetime.now(timezone.utc)
    # Two users/participants
    u1 = User(wallet_address='0xuser1')
    u2 = User(wallet_address='0xuser2')
    db_session.add_all([u1, u2]); db_session.commit(); db_session.refresh(u1); db_session.refresh(u2)
    p1 = Participant(user_id=u1.id, competition_id=42, portfolio_value=Decimal('100'))
    p2 = Participant(user_id=u2.id, competition_id=42, portfolio_value=Decimal('100'))
    db_session.add_all([p1, p2]); db_session.commit(); db_session.refresh(p1); db_session.refresh(p2)
    sched = IncentiveSchedule(name='RiskFlagSched', start_time=now - timedelta(hours=2), end_time=now + timedelta(hours=2), epoch_duration_minutes=60, base_emission_per_epoch=Decimal('10'), competition_id=42, weight_volume_bps=5000, weight_pnl_bps=5000)
    db_session.add(sched); db_session.commit(); db_session.refresh(sched)
    ep = IncentiveEpoch(schedule_id=sched.id, epoch_index=0, start_time=now - timedelta(minutes=30), end_time=now + timedelta(minutes=30), planned_emission=Decimal('10'))
    db_session.add(ep); db_session.commit(); db_session.refresh(ep)
    # Trades: user1 has two trades (one flagged), user2 one clean trade
    t1 = Trade(participant_id=p1.id, domain_token_address='0xD', domain_token_id='A', trade_type='BUY', price=Decimal('10'), tx_hash='0xrf1')
    t2 = Trade(participant_id=p1.id, domain_token_address='0xD', domain_token_id='A', trade_type='SELL', price=Decimal('12'), tx_hash='0xrf2')
    t3 = Trade(participant_id=p2.id, domain_token_address='0xD', domain_token_id='B', trade_type='BUY', price=Decimal('8'), tx_hash='0xrf3')
    db_session.add_all([t1, t2, t3]); db_session.commit(); db_session.refresh(t1); db_session.refresh(t2); db_session.refresh(t3)
    # Flag SELL trade for user1 so its volume & pnl excluded
    flag = TradeRiskFlag(trade_id=t2.id, flag_type='WASH', details=None)
    db_session.add(flag); db_session.commit()
    rows = incentive_service.compute_provisional(db_session, sched.id, 0)
    # Ensure flagged trade (t2) excluded: user1 volume should only count BUY (10) not 22
    rows_by_user = { r['user_id']: r for r in rows }
    assert Decimal(rows_by_user[u1.id]['volume']) == Decimal('10')
    # User2 volume 8
    assert Decimal(rows_by_user[u2.id]['volume']) == Decimal('8')
    # Normalization: max volume is 10 so user1 vol_n=1, user2 vol_n=0.8 -> user1 base_points >= user2 base_points
    bp1 = Decimal(rows_by_user[u1.id]['base_points'])
    bp2 = Decimal(rows_by_user[u2.id]['base_points'])
    assert bp1 >= bp2
