import logging
from datetime import datetime, timezone
from decimal import Decimal
from app.database import SessionLocal
from app.models.database import (
    Participant,
    PortfolioValueHistory,
    DomainETF,
    DomainETFNavHistory,
)

logger = logging.getLogger(__name__)

from typing import Optional


class SnapshotService:
    def __init__(self):
        self.last_portfolio_snapshot: Optional[datetime] = None
        self.last_nav_snapshot: Optional[datetime] = None

    def snapshot_once(self):
        session = SessionLocal()
        now = datetime.now(timezone.utc)
        try:
            # Portfolio snapshots
            participants = session.query(Participant).all()
            for p in participants:
                if p.portfolio_value is not None:
                    row = PortfolioValueHistory(participant_id=p.id, snapshot_time=now, value=p.portfolio_value)
                    session.add(row)
            # ETF NAV per-share snapshots
            etfs = session.query(DomainETF).all()
            for etf in etfs:
                if etf.nav_last is not None and etf.total_shares and etf.total_shares != 0:
                    nav_ps = (Decimal(etf.nav_last) / (etf.total_shares or Decimal(1))).quantize(Decimal('0.00000001'))
                    session.add(DomainETFNavHistory(etf_id=etf.id, snapshot_time=now, nav_per_share=nav_ps))
            session.commit()
            self.last_portfolio_snapshot = now
            self.last_nav_snapshot = now
        except Exception:
            logger.exception("[snapshot] failure")
        finally:
            try:
                session.close()
            except Exception:
                pass

snapshot_service = SnapshotService()
