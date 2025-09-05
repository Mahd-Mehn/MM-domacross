from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import database as models
from app.services.cost_basis_service import apply_trade_cost_basis


def make_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_apply_trade_cost_basis_buy_then_sell():
    db = make_session()
    # Seed participant + domain minimal rows if constraints require (participant_id/domain_name FK not enforced in sqlite memory w/o pragma)
    ph = apply_trade_cost_basis(db, 1, 'example.com', 'BUY', Decimal('100'))
    db.flush()
    assert ph.quantity == 1
    assert str(ph.avg_cost) == '100'
    ph2 = apply_trade_cost_basis(db, 1, 'example.com', 'BUY', Decimal('200'))
    db.flush()
    assert ph2.quantity == 2
    # avg cost should be (100 + 200)/2 = 150
    assert str(ph2.avg_cost) == '150'
    ph3 = apply_trade_cost_basis(db, 1, 'example.com', 'SELL', Decimal('0'))
    db.flush()
    assert ph3.quantity == 1


def test_apply_trade_cost_basis_sell_without_position():
    db = make_session()
    ph = apply_trade_cost_basis(db, 2, 'nohold.com', 'SELL', Decimal('50'))
    assert ph is None
