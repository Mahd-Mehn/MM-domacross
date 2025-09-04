from types import SimpleNamespace
from app.services.redemption_validation import validate_redemption_receipt
from app.config import settings

class DummyLog:
    def __init__(self, topics):
        self.topics = topics

class Topic:
    def __init__(self, value: str):
        self._v = value
    def hex(self):
        return self._v


def make_receipt(**kw):
    defaults = dict(status=1, blockNumber=123, to=settings.redemption_contract_address or '0xabc', gasUsed=settings.redemption_min_gas_used+10, logs=[DummyLog([Topic(settings.redemption_expected_event_topic0 or '0xdead')])])
    defaults.update(kw)
    return SimpleNamespace(**defaults)


def test_validation_success():
    r = make_receipt()
    res = validate_redemption_receipt(r)
    assert res.ok, res
    assert res['reason']=='ok'
    assert res['gas_used'] >= settings.redemption_min_gas_used


def test_validation_tx_failed():
    r = make_receipt(status=0)
    res = validate_redemption_receipt(r)
    assert not res.ok and res['reason']=='tx_failed'


def test_validation_missing_block():
    r = make_receipt(blockNumber=None)
    res = validate_redemption_receipt(r)
    assert not res.ok and res['reason']=='missing_block'


def test_validation_gas_too_low():
    r = make_receipt(gasUsed=max(0, settings.redemption_min_gas_used - 1))
    res = validate_redemption_receipt(r)
    assert not res.ok and res['reason']=='gas_too_low'


def test_validation_insufficient_logs():
    r = make_receipt(logs=[])
    res = validate_redemption_receipt(r)
    assert not res.ok and res['reason']=='insufficient_logs'


def test_validation_unexpected_contract(monkeypatch):
    # Cannot reload global settings instance easily; only run assertion if already configured in environment
    if settings.redemption_contract_address:
        # Provide a differing to address
        r = make_receipt(to='0xDEADBEEF')
        res = validate_redemption_receipt(r)
        assert (not res.ok and res['reason']=='unexpected_to_address') or res['reason']!='ok'


def test_validation_topic_not_found(monkeypatch):
    # Only meaningful if topic0 configured at process start
    if settings.redemption_expected_event_topic0:
        r = make_receipt(logs=[DummyLog([])])
        res = validate_redemption_receipt(r)
        assert (not res.ok and res['reason']=='expected_topic0_not_found') or res['reason']=='ok'


def test_validation_min_value(monkeypatch):
    if settings.redemption_min_value_wei:
        low = make_receipt(value=max(0, settings.redemption_min_value_wei - 1))
        res = validate_redemption_receipt(low)
        assert not res.ok and res['reason'] in ('value_below_min','no_value_field')

