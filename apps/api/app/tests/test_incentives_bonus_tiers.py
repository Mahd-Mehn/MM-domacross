import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.database import IncentiveSchedule, IncentiveEpoch, Participant, User, Trade
from app.services.incentive_service import incentive_service

@pytest.mark.asyncio
async def test_volume_and_holding_duration_bonus(db_session: Session):
    now = datetime.now(timezone.utc)
    # Users
    u1 = User(wallet_address='0xvolhold1')
    u2 = User(wallet_address='0xvolhold2')
    db_session.add_all([u1, u2]); db_session.commit(); db_session.refresh(u1); db_session.refresh(u2)
    p1 = Participant(user_id=u1.id, competition_id=77, portfolio_value=Decimal('100'))
    p2 = Participant(user_id=u2.id, competition_id=77, portfolio_value=Decimal('100'))
    db_session.add_all([p1, p2]); db_session.commit(); db_session.refresh(p1); db_session.refresh(p2)
    sched = IncentiveSchedule(
        name='BonusSched',
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
        epoch_duration_minutes=60,
        base_emission_per_epoch=Decimal('10'),
        competition_id=77,
        weight_volume_bps=4000,
        weight_pnl_bps=3000,
        weight_turnover_bps=2000,
        weight_concentration_bps=1000,
        bonus_early_join_bps=500,
        volume_tier_thresholds=[{"threshold": 50, "bonus_bps": 1000}],
        holding_duration_tiers=[{"min_minutes": 30, "bonus_bps": 500}]
    )
    db_session.add(sched); db_session.commit(); db_session.refresh(sched)
    ep = IncentiveEpoch(schedule_id=sched.id, epoch_index=0, start_time=now - timedelta(minutes=59), end_time=now + timedelta(minutes=1), planned_emission=Decimal('10'))
    db_session.add(ep); db_session.commit(); db_session.refresh(ep)
    # Trades: user1 high volume early, user2 low volume later
    early_ts = ep.start_time + timedelta(minutes=1)
    late_ts = ep.end_time - timedelta(minutes=5)
    # user1: 3 BUY trades of 20 each = 60 volume qualifies for tier + early holding duration
    for i in range(3):
        t = Trade(participant_id=p1.id, domain_token_address='0xD', domain_token_id=str(i), trade_type='BUY', price=Decimal('20'), tx_hash=f'0xvol{i}')
        setattr(t, 'timestamp', early_ts)
        db_session.add(t)
    # user2: 1 BUY trade of 10 at late timestamp
    t2 = Trade(participant_id=p2.id, domain_token_address='0xD', domain_token_id='z', trade_type='BUY', price=Decimal('10'), tx_hash='0xlow')
    setattr(t2, 'timestamp', late_ts)
    db_session.add(t2)
    db_session.commit()
    rows = incentive_service.compute_provisional(db_session, sched.id, 0)
    by = {r['user_id']: r for r in rows}
    r1 = by[u1.id]; r2 = by[u2.id]
    # Volume correctness
    assert Decimal(r1['volume']) == Decimal('60')
    assert Decimal(r2['volume']) == Decimal('10')
    # Ensure bonus components exist
    assert Decimal(r1['volume_bonus_points']) > 0
    assert Decimal(r1['holding_duration_bonus_points']) > 0
    # User2 should have no duration bonus (held < threshold)
    assert Decimal(r2['holding_duration_bonus_points']) == 0
    # r1 total points > r2 total points
    assert Decimal(r1['total_points']) > Decimal(r2['total_points'])
