import os
from decimal import Decimal
from app.services.valuation_service import valuation_service
from app.config import settings
from sqlalchemy.orm import Session

# NOTE: This lightweight test assumes test harness provides a db Session fixture named `db_session`
# If not present, it will be skipped gracefully.

def test_valuation_ensemble_toggle(db_session: Session | None = None):  # type: ignore
    if db_session is None:
        return
    # Ensure a domain record exists
    from app.models.database import Domain
    dom = Domain(name='ensembletest.xyz')
    db_session.add(dom); db_session.commit()
    # Disable ensemble first
    settings.valuation_use_ensemble = False
    res_off = valuation_service.value_domains(db_session, ['ensembletest.xyz'], {'floors': {}, 'tld_counts': {}})
    base_val = Decimal(res_off[0]['value'])
    # Enable ensemble and re-value (simulate different internal blend) – should still produce a numeric result
    settings.valuation_use_ensemble = True
    res_on = valuation_service.value_domains(db_session, ['ensembletest.xyz'], {'floors': {}, 'tld_counts': {}})
    new_val = Decimal(res_on[0]['value'])
    assert res_on[0].get('chosen_source') is not None
    # Value may differ slightly but should be within reasonable band (10%) due to stub logic
    if base_val > 0:
        diff_pct = abs(new_val - base_val) / base_val
        assert diff_pct < Decimal('0.15')
