from datetime import datetime, timedelta, timezone
from decimal import Decimal

def test_competition_settlement_verify_marks_distributed(client, auth_token, db_session, monkeypatch):
    headers = {"Authorization": f"Bearer {auth_token}"}
    # Create competition, epoch, rewards
    from app.models.database import Competition, User, Participant, CompetitionEpoch, CompetitionReward
    comp = Competition(contract_address='0xcomp', chain_id=1, name='C', description='d', start_time=datetime.now(timezone.utc)-timedelta(days=2), end_time=datetime.now(timezone.utc)+timedelta(days=2))
    db_session.add(comp); db_session.commit(); db_session.refresh(comp)
    # participants and rewards in an ended epoch
    users = []
    for i in range(2):
        u = User(wallet_address=f'0xuser{i:035d}')
        db_session.add(u); db_session.commit(); db_session.refresh(u)
        p = Participant(user_id=u.id, competition_id=comp.id)
        db_session.add(p); db_session.commit()
        users.append(u)
    ep = CompetitionEpoch(competition_id=comp.id, epoch_index=0, start_time=datetime.now(timezone.utc)-timedelta(days=2), end_time=datetime.now(timezone.utc)-timedelta(hours=1), reward_pool=Decimal('100'))
    db_session.add(ep); db_session.commit(); db_session.refresh(ep)
    for u in users:
        db_session.add(CompetitionReward(competition_id=comp.id, epoch_id=ep.id, user_id=u.id, points=Decimal('10')))
    db_session.commit()

    # Mock blockchain receipt
    class _Log:
        def __init__(self, t0):
            self.topics = [t0]
    class _Receipt:
        def __init__(self, to, status=1, blockNumber=123, gasUsed=21000, logs=None):
            self.to = to
            self.status = status
            self.blockNumber = blockNumber
            self.gasUsed = gasUsed
            self.logs = logs or []

    from app import config as cfg
    # Configure expected contract and topics
    monkeypatch.setattr(cfg.settings, 'competition_settlement_contract_address', '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
    monkeypatch.setattr(cfg.settings, 'competition_settlement_finalized_topic0', '0xabc')
    monkeypatch.setattr(cfg.settings, 'competition_settlement_prizepaid_topic0', '0xdef')
    monkeypatch.setattr(cfg.settings, 'competition_settlement_min_logs', 1)

    from app.services import blockchain_service as bcs_mod
    monkeypatch.setattr(bcs_mod.blockchain_service, 'ensure_initialized', lambda: True)
    async def _fake_get_receipt(txh: str):
        return _Receipt(to=cfg.settings.competition_settlement_contract_address, logs=[_Log('0xabc'), _Log('0xdef')])
    monkeypatch.setattr(bcs_mod.blockchain_service, 'get_transaction_receipt', _fake_get_receipt)

    # Submit tx hash audit event
    r = client.post(f"/api/v1/settlement/competitions/{comp.id}/submit", params={"tx_hash":"0xhash"}, headers=headers)
    assert r.status_code == 200, r.text

    # Verify and mark distributed
    r = client.post(f"/api/v1/settlement/competitions/{comp.id}/verify", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get('verified') is True

    # Check DB flags
    ep_refetched = db_session.query(CompetitionEpoch).filter(CompetitionEpoch.id==ep.id).first()
    assert ep_refetched.distributed is True
    rewards = db_session.query(CompetitionReward).filter(CompetitionReward.epoch_id==ep.id).all()
    assert all(rr.distributed_at is not None for rr in rewards)
