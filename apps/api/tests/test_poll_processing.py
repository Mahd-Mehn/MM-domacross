import asyncio
from decimal import Decimal
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models.database import User, Competition, Participant, Trade, ProcessedEvent
from app.services.doma_poll_service import doma_poll_service


def test_process_name_token_purchased_updates_trades_and_portfolio():
    session = SessionLocal()
    try:
        # Arrange users and competition/participants
        buyer_addr = "0xaaa1111111111111111111111111111111111111"
        seller_addr = "0xbbb2222222222222222222222222222222222222"
        buyer = User(wallet_address=buyer_addr)
        seller = User(wallet_address=seller_addr)
        session.add_all([buyer, seller])
        session.flush()

        comp = Competition(
            contract_address="0xcccc3333333333333333333333333333333333",
            chain_id=1234,
            name="Test Comp",
            description="",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1),
            entry_fee=Decimal(0),
            rules=None,
        )
        session.add(comp)
        session.flush()

        p_buyer = Participant(user_id=buyer.id, competition_id=comp.id, portfolio_value=Decimal(0))
        p_seller = Participant(user_id=seller.id, competition_id=comp.id, portfolio_value=Decimal(0))
        session.add_all([p_buyer, p_seller])
        session.commit()

        # Event payload similar to Poll API
        unique_id = "evt-123"
        price = "100.50"
        events = [
            {
                "id": 1,
                "uniqueId": unique_id,
                "eventType": "NAME_TOKEN_PURCHASED",
                "txHash": "0xdeadbeef",
                "eventData": {
                    "tokenId": "42",
                    "tokenAddress": "0xdddd4444444444444444444444444444444444",
                    "buyer": buyer_addr,
                    "seller": seller_addr,
                    "payment": {"price": price},
                },
            }
        ]

        # Act
        stats = asyncio.run(doma_poll_service.process_events(events))
        assert stats["processed"] == 1

        # Assert trades created and portfolio updated
        trades = session.query(Trade).all()
        assert len(trades) == 2
        # One BUY, one SELL
        types = sorted(t.trade_type for t in trades)
        assert types == ["BUY", "SELL"]

        # Reload participants and verify portfolio deltas
        session.refresh(p_buyer)
        session.refresh(p_seller)
        assert Decimal(p_buyer.portfolio_value) == Decimal(price)
        assert Decimal(p_seller.portfolio_value) == Decimal(0) - Decimal(price)

        # Idempotency: re-process same event should do nothing
        stats2 = asyncio.run(doma_poll_service.process_events(events))
        assert stats2["processed"] == 0
        trades2 = session.query(Trade).all()
        assert len(trades2) == 2
        # ProcessedEvent should be recorded once
        pe_count = session.query(ProcessedEvent).filter(ProcessedEvent.unique_id == unique_id).count()
        assert pe_count == 1
    finally:
        session.close()
