import types
from datetime import datetime, timezone

class _DummyLog:
    def __init__(self, address, topics, data='0x', tx='0xabc'):
        self.address = address
        self.topics = topics
        self.data = data
        self.transactionHash = tx

# Precomputed topic0 values mirrored in service
ORDER_CREATED = '0x03dd3b14c56623f65a5c49080f964c1673909e9e5a66dd2d445a95d8961c5e0c'
TRADE_EXECUTED = '0x3bf1911091cf07bba468e2e4040d3ba93926ab9dd98ec6053b457769278ade41'

# Build dummy topics: [topic0, orderId/buyer, seller, ...]
# Use simple hex numbers

def test_chain_marketplace_decode(db_session, monkeypatch):
    from app.services.chain_ingest_service import chain_ingest_service
    from app import config as cfg
    # Force feature flags & address
    monkeypatch.setattr(cfg.settings, 'enable_chain_marketplace_events', True)
    monkeypatch.setattr(cfg.settings, 'domain_marketplace_contract_address', '0xDEADBEEF00000000000000000000000000000000')

    # Craft logs: order created + trade executed
    order_log = _DummyLog(
        '0xdeadbeef00000000000000000000000000000000',
        [ORDER_CREATED, hex(1), '0x0000000000000000000000000123456789abcdef0123456789abcdef01234567'],
        data='0x' + '00'*64*3  # placeholder
    )
    trade_log = _DummyLog(
        '0xdeadbeef00000000000000000000000000000000',
        [TRADE_EXECUTED, hex(5), '0x0000000000000000000000000a23456789abcdef0123456789abcdef0123456', '0x0000000000000000000000000b23456789abcdef0123456789abcdef0123456'],
        data='0x' + '00'*63 + '01'  # price=1
    )

    # Monkeypatch web3 provider & state
    class _Block:
        def __init__(self, number):
            self.number = number
            self.parentHash = types.SimpleNamespace(hex=lambda: '0x' + '11'*32)
            self.hash = types.SimpleNamespace(hex=lambda: '0x' + '22'*32)
            self.timestamp = int(datetime.now(tz=timezone.utc).timestamp())
    class _Web3:
        class eth:
            block_number = 10
            @staticmethod
            def get_block(n, full_transactions=False):
                return _Block(n)
            @staticmethod
            def get_logs(filt):
                # Return logs only for the target block range
                return [order_log, trade_log]
    from app.services import blockchain_service as bcs_mod
    monkeypatch.setattr(bcs_mod.blockchain_service, 'web3', _Web3())
    monkeypatch.setattr(bcs_mod.blockchain_service, 'ensure_initialized', lambda: True)

    processed = chain_ingest_service.run_once(db_session)
    assert processed >= 1
    # Verify at least one pair of decoded events persisted
    from app.models.database import AuditEvent
    evs = db_session.query(AuditEvent).filter(AuditEvent.event_type.in_(['CHAIN_ORDER_CREATED','CHAIN_TRADE_EXECUTED'])).all()
    assert len(evs) >= 2
    trade_events = [e for e in evs if e.event_type=='CHAIN_TRADE_EXECUTED']
    assert trade_events, 'expected at least one CHAIN_TRADE_EXECUTED event'
    assert trade_events[0].payload.get('price_raw') == '1'
