from typing import Any
from app.config import settings

class SettlementValidationResult(dict):
    @property
    def ok(self) -> bool:
        return self.get('ok', False)

def validate_competition_settlement_receipt(receipt: Any) -> SettlementValidationResult:
    status = getattr(receipt, 'status', None)
    if status != 1:
        return SettlementValidationResult(ok=False, reason='tx_failed')
    to_addr = (getattr(receipt, 'to', None) or '')
    logs = list(getattr(receipt, 'logs', []) or [])
    gas_used = getattr(receipt, 'gasUsed', 0) or 0
    block_number = getattr(receipt, 'blockNumber', None)
    if block_number is None:
        return SettlementValidationResult(ok=False, reason='missing_block')
    if settings.competition_settlement_contract_address and to_addr:
        if to_addr.lower() != settings.competition_settlement_contract_address.lower():
            return SettlementValidationResult(ok=False, reason='unexpected_to_address', to=to_addr)
    if len(logs) < settings.competition_settlement_min_logs:
        return SettlementValidationResult(ok=False, reason='insufficient_logs', log_count=len(logs))
    # Topic checks: look for SettlementFinalized and at least one PrizePaid
    finalized_t0 = (settings.competition_settlement_finalized_topic0 or '').lower()
    prize_t0 = (settings.competition_settlement_prizepaid_topic0 or '').lower()
    found_final = False
    found_prize = False
    if finalized_t0 or prize_t0:
        for l in logs:
            topics = getattr(l, 'topics', []) or []
            if not topics:
                continue
            first = topics[0]
            if hasattr(first, 'hex'):
                first_hex = first.hex().lower()
            else:
                first_hex = str(first).lower()
            if finalized_t0 and first_hex == finalized_t0:
                found_final = True
            if prize_t0 and first_hex == prize_t0:
                found_prize = True
    # If topics configured, enforce presence
    if finalized_t0 and not found_final:
        return SettlementValidationResult(ok=False, reason='finalized_event_not_found')
    if prize_t0 and not found_prize:
        return SettlementValidationResult(ok=False, reason='prizepaid_event_not_found')
    return SettlementValidationResult(ok=True, reason='ok', block=block_number, gas_used=gas_used, log_count=len(logs))
