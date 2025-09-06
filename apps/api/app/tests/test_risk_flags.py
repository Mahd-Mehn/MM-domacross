import time, json, threading
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import pytest

from app.main import app
from app.models.database import User, Participant, Competition, Trade, TradeRiskFlag
from sqlalchemy import text
from app.services.abuse_guard import abuse_guard

client = TestClient(app)

@pytest.fixture()
def setup_participant(db_session: Session):
    now = datetime.now(timezone.utc)
    comp = Competition(name='RF', chain_id=1, start_time=now - timedelta(hours=1), end_time=now + timedelta(hours=1))
    db_session.add(comp); db_session.commit(); db_session.refresh(comp)
    u = User(wallet_address='0xriskuser')
    db_session.add(u); db_session.commit(); db_session.refresh(u)
    part = Participant(user_id=u.id, competition_id=comp.id, portfolio_value=Decimal('100'))
    db_session.add(part); db_session.commit(); db_session.refresh(part)
    return u, part, comp

# Helper to insert trade directly (bypassing endpoint complexity to focus on heuristic)

def _make_trade(db: Session, participant_id: int, domain: str, side: str, price: Decimal, seconds_ago: int | None = None):
    """Insert a trade; optionally backdate the timestamp by seconds_ago."""
    t = Trade(
        participant_id=participant_id,
        domain_token_address='0xdom',
        domain_token_id=domain,
        trade_type=side,
        price=price,
        tx_hash=f"0xtx{uuid4().hex[:10]}"
    )
    db.add(t); db.commit(); db.refresh(t)
    if seconds_ago is not None and seconds_ago > 0:
        past = datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)
        db.execute(text("UPDATE trades SET timestamp = :ts WHERE id = :id"), {"ts": past, "id": t.id})
        db.commit(); db.refresh(t)
    return t

@pytest.mark.asyncio
async def test_wash_and_rapid_flip_flags(db_session: Session, setup_participant):
    u, part, comp = setup_participant
    # Create >=3 opposite-side (SELL) trades within 120s to trigger both WASH_LIKELY and RAPID_FLIP when final BUY occurs.
    _make_trade(db_session, part.id, 'wash.dom', 'SELL', Decimal('1'), seconds_ago=110)
    _make_trade(db_session, part.id, 'wash.dom', 'SELL', Decimal('1'), seconds_ago=90)
    _make_trade(db_session, part.id, 'wash.dom', 'SELL', Decimal('1'), seconds_ago=70)
    # Include one same-side BUY earlier (not required but adds variety)
    _make_trade(db_session, part.id, 'wash.dom', 'BUY', Decimal('1'), seconds_ago=50)
    # Insert triggering trade (BUY) -> flips count should be 3 (three SELL trades)
    from app.routers.market import _post_trade_hooks
    tr = _make_trade(db_session, part.id, 'wash.dom', 'BUY', Decimal('1'))
    _post_trade_hooks(db_session, tr, 'wash.dom')
    db_session.commit()
    flags = db_session.query(TradeRiskFlag).filter(TradeRiskFlag.trade_id==tr.id).all()
    types = {f.flag_type for f in flags}
    assert 'RAPID_FLIP' in types, types
    assert 'WASH_LIKELY' in types, types

@pytest.mark.asyncio
async def test_self_cross_flag(db_session: Session, setup_participant):
    u, part, comp = setup_participant
    from app.routers.market import _post_trade_hooks
    t1 = _make_trade(db_session, part.id, 'sc.dom', 'BUY', Decimal('1'), seconds_ago=10)
    t2 = _make_trade(db_session, part.id, 'sc.dom', 'SELL', Decimal('1'))
    _post_trade_hooks(db_session, t2, 'sc.dom')
    db_session.commit()
    flags = db_session.query(TradeRiskFlag).filter(TradeRiskFlag.trade_id==t2.id).all()
    assert any(f.flag_type == 'SELF_CROSS' for f in flags)

@pytest.mark.asyncio
async def test_circular_pattern_flag(db_session: Session):
    now = datetime.now(timezone.utc)
    comp = Competition(name='CIRC', chain_id=1, start_time=now - timedelta(hours=1), end_time=now + timedelta(hours=1))
    db_session.add(comp); db_session.commit(); db_session.refresh(comp)
    users = []
    participants = []
    for i in range(3):
        u = User(wallet_address=f'0xcirc{i}')
        db_session.add(u); db_session.commit(); db_session.refresh(u)
        p = Participant(user_id=u.id, competition_id=comp.id, portfolio_value=Decimal('100'))
        db_session.add(p); db_session.commit(); db_session.refresh(p)
        users.append(u); participants.append(p)
    from app.routers.market import _post_trade_hooks
    # Sequence: P0 BUY -> P1 SELL -> P2 BUY -> P0 SELL (circular)
    def mk(part, side, secs):
        tr = Trade(participant_id=part.id, domain_token_address='0xdom', domain_token_id='circ.dom', trade_type=side, price=Decimal('1'), tx_hash=f"0xtx{uuid4().hex[:10]}")
        db_session.add(tr); db_session.commit(); db_session.refresh(tr)
        if secs:
            past = datetime.now(timezone.utc) - timedelta(seconds=secs)
            db_session.execute(text("UPDATE trades SET timestamp = :ts WHERE id = :id"), {"ts": past, "id": tr.id}); db_session.commit()
        return tr
    mk(participants[0], 'BUY', 300)
    mk(participants[1], 'SELL', 200)
    mk(participants[2], 'BUY', 100)
    latest = mk(participants[0], 'SELL', 0)
    _post_trade_hooks(db_session, latest, 'circ.dom')
    db_session.commit()
    flags = db_session.query(TradeRiskFlag).filter(TradeRiskFlag.trade_id==latest.id).all()
    assert any(f.flag_type == 'CIRCULAR_PATTERN' for f in flags)

def test_websocket_risk_flag_contract(db_session: Session, setup_participant):
    u, part, comp = setup_participant
    from app.routers.market import _post_trade_hooks
    with client.websocket_connect("/ws?events=risk_flag") as ws:
        # trigger self-cross
        _make_trade(db_session, part.id, 'ws.dom', 'BUY', Decimal('1'), seconds_ago=5)
        t2 = _make_trade(db_session, part.id, 'ws.dom', 'SELL', Decimal('1'))
        _post_trade_hooks(db_session, t2, 'ws.dom')
        db_session.commit()

        received: list[str] = []

        def reader():
            try:
                msg = ws.receive_text()
                received.append(msg)
            except Exception:
                pass

        start = time.time()
        # attempt up to 5 sequential receives (some envs send unrelated events first)
        for _ in range(5):
            if time.time() - start > 3:
                break
            t = threading.Thread(target=reader, daemon=True)
            t.start()
            t.join(0.6)  # wait up to 600ms for a message
            if not t.is_alive() and received:
                data = json.loads(received.pop(0))
                if data.get('type') == 'risk_flag':
                    assert 'trade_id' in data and 'flag_type' in data
                    assert data['flag_type'] in {'SELF_CROSS','WASH_LIKELY','RAPID_FLIP','CIRCULAR_PATTERN'}
                    return
            # small pause before next attempt
            time.sleep(0.05)
        pytest.fail('Expected risk_flag event not received within timeout')
