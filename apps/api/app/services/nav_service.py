import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from app.database import SessionLocal
from app.models.database import DomainETF as DomainETFModel, DomainETFPosition as DomainETFPositionModel, Domain as DomainModel, Valuation as ValuationModel, DomainETFFeeEvent, DomainETFNavHistory
from app.services.audit_service import record_audit_event

logger = logging.getLogger(__name__)

class NavService:
    def __init__(self):
        self.last_run: Optional[datetime] = None
        self.total_recomputes: int = 0

    def _compute_nav(self, session, etf: DomainETFModel) -> Decimal:
        positions = session.query(DomainETFPositionModel).filter(DomainETFPositionModel.etf_id == etf.id).all()
        total = Decimal(0)
        if not positions:
            return total
        for p in positions:
            val = (
                session.query(ValuationModel.value)
                .filter(ValuationModel.domain_name == p.domain_name)
                .order_by(ValuationModel.created_at.desc())
                .limit(1)
                .scalar()
            )
            if val is None:
                val = (
                    session.query(DomainModel.last_floor_price)
                    .filter(DomainModel.name == p.domain_name)
                    .scalar()
                ) or Decimal(0)
            weight_pct = Decimal(p.weight_bps) / Decimal(10000)
            total += (val or Decimal(0)) * weight_pct
        return total

    def _accrue_management_fee(self, session, etf: DomainETFModel, nav: Decimal, now: datetime):
        if not etf.management_fee_bps:
            return
        last = etf.management_fee_last_accrued_at or etf.nav_updated_at or now
        # Normalize timezone awareness to prevent naive vs aware subtraction errors
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        elapsed_seconds = max(0, int((now - last).total_seconds()))
        if elapsed_seconds == 0:
            return
        # Annualized rate in decimal
        annual_rate = Decimal(etf.management_fee_bps) / Decimal(10000)
        # Continuous comp approximation: fee = nav * (annual_rate * elapsed/seconds_year)
        seconds_year = Decimal(31536000)  # 365d
        fee_amount = (nav * annual_rate * Decimal(elapsed_seconds) / seconds_year).quantize(Decimal('0.00000001'))
        if fee_amount <= 0:
            return
        etf.fee_accrued = (etf.fee_accrued or Decimal(0)) + fee_amount
        etf.management_fee_last_accrued_at = now
        session.add(DomainETFFeeEvent(etf_id=etf.id, event_type='MANAGEMENT_ACCRUAL', amount=fee_amount, nav_per_share_snapshot=None, meta={'elapsed_seconds': elapsed_seconds}))
        try:
            record_audit_event(session, event_type='MANAGEMENT_ACCRUAL', entity_type='FEE_EVENT', entity_id=etf.id, user_id=None, payload={'fee_amount': str(fee_amount), 'elapsed_seconds': elapsed_seconds})
        except Exception:
            logger.exception("[audit] failed to record management accrual event")

    def _crystallize_performance_fee(self, session, etf: DomainETFModel, nav: Decimal, now: datetime):
        if not etf.performance_fee_bps:
            return
        # Initialize high water mark
        if etf.nav_high_water is None:
            etf.nav_high_water = nav
            return
        if nav <= (etf.nav_high_water or Decimal(0)) or nav <= 0:
            return
        gain = nav - (etf.nav_high_water or Decimal(0))
        perf_fee_rate = Decimal(etf.performance_fee_bps) / Decimal(10000)
        fee_amount = (gain * perf_fee_rate).quantize(Decimal('0.00000001'))
        if fee_amount <= 0:
            etf.nav_high_water = nav  # still raise HWM
            return
        etf.fee_accrued = (etf.fee_accrued or Decimal(0)) + fee_amount
        etf.nav_high_water = nav
        session.add(DomainETFFeeEvent(etf_id=etf.id, event_type='PERFORMANCE_ACCRUAL', amount=fee_amount, nav_per_share_snapshot=None, meta={'gain': str(gain)}))
        try:
            record_audit_event(session, event_type='PERFORMANCE_ACCRUAL', entity_type='FEE_EVENT', entity_id=etf.id, user_id=None, payload={'fee_amount': str(fee_amount), 'gain': str(gain)})
        except Exception:
            logger.exception("[audit] failed to record performance accrual event")

    def run_once(self, stale_seconds: int = 600):
        session = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            etfs = session.query(DomainETFModel).all()
            for etf in etfs:
                if etf.nav_updated_at is None or (now - etf.nav_updated_at).total_seconds() > stale_seconds:
                    try:
                        nav = self._compute_nav(session, etf)
                        etf.nav_last = nav
                        etf.nav_updated_at = now
                        # Record nav history snapshot
                        try:
                            nav_ps = None
                            if etf.total_shares and etf.total_shares > 0 and nav is not None:
                                nav_ps = (nav / Decimal(etf.total_shares)).quantize(Decimal('0.00000001'))
                            session.add(DomainETFNavHistory(etf_id=etf.id, snapshot_time=now, nav_per_share=nav_ps or Decimal(0)))
                        except Exception:
                            logger.exception("[nav] failed to record nav history etf_id=%s", etf.id)
                        # Fee accrual & performance crystallization
                        self._accrue_management_fee(session, etf, nav, now)
                        self._crystallize_performance_fee(session, etf, nav, now)
                        self.total_recomputes += 1
                    except Exception:
                        logger.exception("[nav] failed recompute etf_id=%s", etf.id)
            session.commit()
            self.last_run = now
        finally:
            try:
                session.close()
            except Exception:
                pass

    def estimate_apy(self, session, etf_id: int, lookback_days: int = 30) -> Optional[Decimal]:
        from app.models.database import DomainETFNavHistory
        cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        rows = session.query(DomainETFNavHistory).filter(DomainETFNavHistory.etf_id==etf_id, DomainETFNavHistory.snapshot_time >= cutoff).order_by(DomainETFNavHistory.snapshot_time.asc()).all()
        if len(rows) < 2:
            return None
        start = Decimal(rows[0].nav_per_share)
        end = Decimal(rows[-1].nav_per_share)
        if start <= 0:
            return None
        days = (rows[-1].snapshot_time - rows[0].snapshot_time).total_seconds() / 86400
        if days <= 0:
            return None
        total_return = (end - start) / start
        annualized = (Decimal(1) + total_return) ** (Decimal(365) / Decimal(days)) - Decimal(1)
        return annualized.quantize(Decimal('0.00000001'))

nav_service = NavService()