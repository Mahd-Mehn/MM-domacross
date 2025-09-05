import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.database import IncentiveSchedule, IncentiveEpoch, Participant, User, Trade, ParticipantHolding
from app.services.incentive_service import incentive_service

@pytest.mark.asyncio
async def test_provisional_cost_basis(db_session: Session):  # assumes a db_session fixture exists
    now = datetime.now(timezone.utc)
    # Create user/participant
    u = User(wallet_address='0xabc')
    db_session.add(u); db_session.commit(); db_session.refresh(u)
    p = Participant(user_id=u.id, competition_id=1, portfolio_value=Decimal('100'))
    db_session.add(p); db_session.commit(); db_session.refresh(p)
    sched = IncentiveSchedule(name='TestSched', start_time=now - timedelta(hours=1), end_time=now + timedelta(hours=1), epoch_duration_minutes=60, base_emission_per_epoch=Decimal('10'), competition_id=1)
    db_session.add(sched); db_session.commit(); db_session.refresh(sched)
    ep = IncentiveEpoch(schedule_id=sched.id, epoch_index=0, start_time=now - timedelta(minutes=30), end_time=now + timedelta(minutes=30), planned_emission=Decimal('10'))
    db_session.add(ep); db_session.commit(); db_session.refresh(ep)
    # Simulate buy then sell to realize PnL
    db_session.add(Trade(participant_id=p.id, domain_token_address='0xD', domain_token_id='1', trade_type='BUY', price=Decimal('5'), tx_hash='0x1'))
    db_session.add(Trade(participant_id=p.id, domain_token_address='0xD', domain_token_id='1', trade_type='SELL', price=Decimal('8'), tx_hash='0x2'))
    db_session.commit()
    rows = incentive_service.compute_provisional(db_session, sched.id, 0)
    assert rows, 'Expected provisional rows'
    r = rows[0]
    assert Decimal(r['volume']) == Decimal('13')  # 5 + 8
    assert Decimal(r['pnl']) == Decimal('3')  # realized
    # Upsert holding cost basis persists across recompute (idempotent)
    rows2 = incentive_service.compute_provisional(db_session, sched.id, 0)
    assert rows2[0]['pnl'] == r['pnl']
