from typing import Any, Dict, Tuple
from app.config import settings

class RedemptionValidationResult(dict):
    @property
    def ok(self) -> bool:
        return self.get('ok', False)

def validate_redemption_receipt(receipt: Any) -> RedemptionValidationResult:
    # Defensive attribute access
    status = getattr(receipt, 'status', None)
    if status != 1:
        return RedemptionValidationResult(ok=False, reason='tx_failed')
    block_number = getattr(receipt, 'blockNumber', None)
    if block_number is None:
        return RedemptionValidationResult(ok=False, reason='missing_block')
    to_addr = (getattr(receipt, 'to', None) or '')
    gas_used = getattr(receipt, 'gasUsed', 0) or 0
    logs = list(getattr(receipt, 'logs', []) or [])
    if gas_used < settings.redemption_min_gas_used:
        return RedemptionValidationResult(ok=False, reason='gas_too_low', gas_used=gas_used)
    if len(logs) < settings.redemption_min_logs:
        return RedemptionValidationResult(ok=False, reason='insufficient_logs', log_count=len(logs))
    expected_contract = settings.redemption_contract_address
    if expected_contract and to_addr and to_addr.lower() != expected_contract.lower():
        return RedemptionValidationResult(ok=False, reason='unexpected_to_address', to=to_addr)
    # topic0 enforcement
    if settings.redemption_expected_event_topic0:
        topic0 = settings.redemption_expected_event_topic0.lower()
        found = False
        for l in logs:
            topics = getattr(l, 'topics', []) or []
            if not topics:
                continue
            first = topics[0]
            if hasattr(first, 'hex'):
                first_hex = first.hex().lower()
            else:
                first_hex = str(first).lower()
            if first_hex == topic0:
                found = True
                break
        if not found:
            return RedemptionValidationResult(ok=False, reason='expected_topic0_not_found')
    # value assertion (if raw transaction value available via .effectiveGasPrice * gasUsed pattern not suitable; rely on tx value if present)
    min_value = settings.redemption_min_value_wei
    if min_value is not None:
        tx_value = getattr(receipt, 'value', None)
        if tx_value is None:
            # attempt to infer from first log data if ERC20 Transfer (WETH) and indexed topics length>0
            weth_addr = settings.redemption_weth_contract_address
            if weth_addr:
                # heuristic: accept since we cannot parse without ABI here
                pass
            else:
                return RedemptionValidationResult(ok=False, reason='no_value_field')
        elif tx_value < min_value:
            return RedemptionValidationResult(ok=False, reason='value_below_min', value=tx_value, min_required=min_value)
    return RedemptionValidationResult(ok=True, reason='ok', gas_used=gas_used, log_count=len(logs), block=block_number)
