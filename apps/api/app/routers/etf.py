from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.database import DomainETF as DomainETFModel, DomainETFPosition as DomainETFPositionModel, Domain as DomainModel, DomainETFShare as DomainETFShareModel, Participant as ParticipantModel, Competition as CompetitionModel
from app.schemas.competition import DomainETFCreate, DomainETF, DomainETFPosition, DomainETFShare, ETFIssueRedeem, ETFNavUpdate, DomainETFShareFlow, DomainETFRedemptionIntent
from app.deps.auth import get_current_user
from app.models.database import User as UserModel
from datetime import datetime, timezone
from decimal import Decimal
from datetime import timedelta
from app.services.nav_service import nav_service

router = APIRouter()

@router.post('/etfs', response_model=DomainETF)
def create_etf(payload: DomainETFCreate, creation_unit_size: Decimal | None = None, lock_period_seconds: int | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Basic validation: weights sum ~ 10000 (allow small drift)
    total = sum(w for _, w in payload.positions)
    if total < 9990 or total > 10010:
        raise HTTPException(status_code=400, detail='Weights must sum to ~10000 bps (100%)')
    etf = DomainETFModel(
        owner_user_id=user.id,
        competition_id=payload.competition_id,
        name=payload.name,
        symbol=payload.symbol.upper(),
        description=payload.description,
        total_shares=0,
        creation_unit_size=creation_unit_size,
    )
    db.add(etf)
    db.flush()
    # Ensure domains exist
    # Optional whitelist enforcement: if any active whitelist entries exist, restrict to them
    from app.models.database import DomainWhitelist
    whitelist_active = db.query(DomainWhitelist).filter(DomainWhitelist.active == True).all()  # noqa: E712
    allowed_set = {w.domain_name for w in whitelist_active}
    for domain_name, weight in payload.positions:
        name_l = domain_name.lower()
        if allowed_set and name_l not in allowed_set:
            raise HTTPException(status_code=400, detail=f'Domain {name_l} not whitelisted')
        dom = db.query(DomainModel).filter(DomainModel.name == name_l).first()
        if not dom:
            dom = DomainModel(name=name_l)
            db.add(dom)
            db.flush()
        pos = DomainETFPositionModel(etf_id=etf.id, domain_name=name_l, weight_bps=weight)
        db.add(pos)
    db.commit()
    db.refresh(etf)
    return etf

@router.get('/etfs', response_model=list[DomainETF])
def list_etfs(limit: int = 20, offset: int = 0, competition_id: int | None = None, search: str | None = None, db: Session = Depends(get_db)):
    q = db.query(DomainETFModel)
    if competition_id is not None:
        q = q.filter(DomainETFModel.competition_id == competition_id)
    if search:
        like = f"%{search.lower()}%"
        q = q.filter(DomainETFModel.name.ilike(like) | DomainETFModel.symbol.ilike(like))
    return q.order_by(DomainETFModel.created_at.desc()).limit(min(limit, 100)).offset(offset).all()

@router.get('/etfs/{etf_id}', response_model=DomainETF)
def get_etf(etf_id: int, db: Session = Depends(get_db)):
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf:
        raise HTTPException(status_code=404, detail='ETF not found')
    return etf

@router.get('/etfs/{etf_id}/positions', response_model=list[DomainETFPosition])
def get_etf_positions(etf_id: int, db: Session = Depends(get_db)):
    return db.query(DomainETFPositionModel).filter(DomainETFPositionModel.etf_id == etf_id).all()

def _compute_nav(db: Session, etf: DomainETFModel) -> Decimal:
    # NAV = sum(weight% * domain_value); use valuations table fallback to last_floor_price
    from app.models.database import Valuation, Domain
    positions = db.query(DomainETFPositionModel).filter(DomainETFPositionModel.etf_id == etf.id).all()
    total = Decimal(0)
    for p in positions:
        val = db.query(Valuation.value).filter(Valuation.domain_name == p.domain_name).order_by(Valuation.created_at.desc()).limit(1).scalar()
        if val is None:
            val = db.query(Domain.last_floor_price).filter(Domain.name == p.domain_name).scalar() or Decimal(0)
        weight_pct = Decimal(p.weight_bps) / Decimal(10000)
        total += (val or Decimal(0)) * weight_pct
    return total

@router.post('/etfs/{etf_id}/nav', response_model=DomainETF)
def update_nav(etf_id: int, payload: ETFNavUpdate, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf: raise HTTPException(status_code=404, detail='ETF not found')
    if etf.owner_user_id != user.id: raise HTTPException(status_code=403, detail='Not owner')
    etf.nav_last = payload.nav
    etf.nav_updated_at = datetime.now(timezone.utc)
    db.add(etf)
    db.commit()
    db.refresh(etf)
    return etf

@router.post('/etfs/{etf_id}/nav/recompute', response_model=DomainETF)
def recompute_nav(etf_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf: raise HTTPException(status_code=404, detail='ETF not found')
    if etf.owner_user_id != user.id: raise HTTPException(status_code=403, detail='Not owner')
    previous_nav = etf.nav_last or Decimal(0)
    nav = _compute_nav(db, etf)
    etf.nav_last = nav
    etf.nav_updated_at = datetime.now(timezone.utc)
    # Accrue management fee pro-rata (now handled in nav service; keep legacy simplified accrual removed)
    # Performance fee if nav increased (handled in nav service). Here just update high-water if absent.
    if etf.nav_high_water is None or nav > (etf.nav_high_water or Decimal(0)):
        etf.nav_high_water = nav
    db.add(etf)
    db.commit()
    db.refresh(etf)
    return etf

@router.post('/etfs/{etf_id}/issue', response_model=DomainETFShare)
def issue_shares(etf_id: int, payload: ETFIssueRedeem, cash_paid: Decimal | None = None, lock_period_seconds: int | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf: raise HTTPException(status_code=404, detail='ETF not found')
    if etf.owner_user_id != user.id: raise HTTPException(status_code=403, detail='Not owner')
    if payload.shares <= 0: raise HTTPException(status_code=400, detail='Shares must be positive')
    if etf.creation_unit_size:
        # enforce integer multiple of creation unit
        unit = Decimal(etf.creation_unit_size)
        if (payload.shares / unit) % 1 != 0:
            raise HTTPException(status_code=400, detail='Shares must be multiple of creation unit size')
    # Use latest nav or recompute if stale (>10m)
    if not etf.nav_last or not etf.nav_updated_at or (datetime.now(timezone.utc) - etf.nav_updated_at).total_seconds() > 600:
        etf.nav_last = _compute_nav(db, etf)
        etf.nav_updated_at = datetime.now(timezone.utc)
    nav_per_share = etf.nav_last or Decimal(0)
    required_cash = (nav_per_share * payload.shares).quantize(Decimal('0.00000001'))
    if cash_paid is None:
        cash_paid = required_cash
    # Basic validation representing primary market subscription at NAV
    if cash_paid < required_cash * Decimal('0.995') or cash_paid > required_cash * Decimal('1.005'):
        raise HTTPException(status_code=400, detail='Cash must be within 50bps of NAV * shares')
    holding = db.query(DomainETFShareModel).filter(DomainETFShareModel.etf_id == etf_id, DomainETFShareModel.user_id == user.id).first()
    lock_until = None
    if lock_period_seconds and lock_period_seconds > 0:
        lock_until = datetime.now(timezone.utc) + timedelta(seconds=lock_period_seconds)
    if not holding:
        holding = DomainETFShareModel(etf_id=etf_id, user_id=user.id, shares=payload.shares, lock_until=lock_until)
        db.add(holding)
    else:
        holding.shares = holding.shares + payload.shares  # type: ignore
        if lock_until and (holding.lock_until is None or lock_until > holding.lock_until):  # extend lock if longer
            holding.lock_until = lock_until
    etf.total_shares = (etf.total_shares or Decimal(0)) + payload.shares  # type: ignore
    # Record flow
    from app.models.database import DomainETFShareFlow as Flow
    flow = Flow(etf_id=etf.id, user_id=user.id, flow_type='ISSUE', shares=payload.shares, cash_value=cash_paid, nav_per_share=nav_per_share)
    db.add(flow)
    # Apply creation fee
    if etf.creation_fee_bps:
        fee = (required_cash * Decimal(etf.creation_fee_bps) / Decimal(10000)).quantize(Decimal('0.00000001'))
        if fee > 0:
            etf.fee_accrued = (etf.fee_accrued or Decimal(0)) + fee
    db.commit()
    db.refresh(holding)
    return holding

@router.post('/etfs/{etf_id}/redeem', response_model=DomainETFShare)
def redeem_shares(etf_id: int, payload: ETFIssueRedeem, cash_received: Decimal | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf: raise HTTPException(status_code=404, detail='ETF not found')
    holding = db.query(DomainETFShareModel).filter(DomainETFShareModel.etf_id == etf_id, DomainETFShareModel.user_id == user.id).first()
    if not holding: raise HTTPException(status_code=400, detail='No shares')
    if payload.shares <= 0 or payload.shares > holding.shares:  # type: ignore
        raise HTTPException(status_code=400, detail='Invalid share amount')
    # Vesting / lock enforcement
    if holding.lock_until and datetime.now(timezone.utc) < holding.lock_until:
        raise HTTPException(status_code=400, detail='Shares are still locked')
    if not etf.nav_last or not etf.nav_updated_at or (datetime.now(timezone.utc) - etf.nav_updated_at).total_seconds() > 600:
        etf.nav_last = _compute_nav(db, etf)
        etf.nav_updated_at = datetime.now(timezone.utc)
    nav_per_share = etf.nav_last or Decimal(0)
    owed_cash = (nav_per_share * payload.shares).quantize(Decimal('0.00000001'))
    if cash_received is None:
        cash_received = owed_cash
    if cash_received < owed_cash * Decimal('0.995') or cash_received > owed_cash * Decimal('1.005'):
        raise HTTPException(status_code=400, detail='Cash must be within 50bps of NAV * shares')
    holding.shares = holding.shares - payload.shares  # type: ignore
    etf.total_shares = (etf.total_shares or Decimal(0)) - payload.shares  # type: ignore
    from app.models.database import DomainETFShareFlow as Flow
    flow = Flow(etf_id=etf.id, user_id=user.id, flow_type='REDEEM', shares=payload.shares, cash_value=cash_received, nav_per_share=nav_per_share)
    db.add(flow)
    # Apply redemption fee
    if etf.redemption_fee_bps:
        fee = (owed_cash * Decimal(etf.redemption_fee_bps) / Decimal(10000)).quantize(Decimal('0.00000001'))
        if fee > 0:
            etf.fee_accrued = (etf.fee_accrued or Decimal(0)) + fee
    db.commit()
    db.refresh(holding)
    return holding

@router.post('/etfs/{etf_id}/redeem/intent', response_model=DomainETFRedemptionIntent)
def create_redemption_intent(etf_id: int, payload: ETFIssueRedeem, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Creates an intent capturing current nav per share; execution happens after on-chain listing settlement off-platform
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf: raise HTTPException(status_code=404, detail='ETF not found')
    holding = db.query(DomainETFShareModel).filter(DomainETFShareModel.etf_id == etf_id, DomainETFShareModel.user_id == user.id).first()
    if not holding or holding.shares < payload.shares:  # type: ignore
        raise HTTPException(status_code=400, detail='Insufficient shares')
    # Enforce lock / vesting (can't even create intent if still locked)
    if holding.lock_until and datetime.now(timezone.utc) < holding.lock_until:
        raise HTTPException(status_code=400, detail='Shares are still locked')
    # snapshot nav per share. Allow zero NAV; only reject if nav is None OR total_shares is None/zero
    if etf.nav_last is None or etf.total_shares is None or etf.total_shares == 0:
        raise HTTPException(status_code=400, detail='NAV unavailable')
    nav_ps = (Decimal(etf.nav_last or 0) / Decimal(etf.total_shares or 1)).quantize(Decimal('0.00000001'))
    from app.models.database import DomainETFRedemptionIntent as Intent
    intent = Intent(etf_id=etf.id, user_id=user.id, shares=payload.shares, nav_per_share_snapshot=nav_ps)
    db.add(intent)
    db.commit()
    db.refresh(intent)
    return intent

@router.post('/etfs/{etf_id}/redeem/execute/{intent_id}', response_model=DomainETFShare)
def execute_redemption_intent(etf_id: int, intent_id: int, tx_hash: str | None = None, payload: dict | None = Body(default=None), db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Called after SDK-driven domain liquidation completed (frontend orchestrates) to burn shares and record flow
    from app.models.database import DomainETFRedemptionIntent as Intent, DomainETFShareFlow as Flow
    intent = db.query(Intent).filter(Intent.id == intent_id, Intent.etf_id == etf_id, Intent.user_id == user.id, Intent.executed_at == None).first()  # noqa: E711
    if not intent: raise HTTPException(status_code=404, detail='Intent not found or already executed')
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf: raise HTTPException(status_code=404, detail='ETF not found')
    holding = db.query(DomainETFShareModel).filter(DomainETFShareModel.etf_id == etf_id, DomainETFShareModel.user_id == user.id).first()
    if not holding or holding.shares < intent.shares:  # type: ignore
        raise HTTPException(status_code=400, detail='Insufficient shares')
    # Burn shares at snapshotted nav
    holding.shares = holding.shares - intent.shares  # type: ignore
    etf.total_shares = (etf.total_shares or Decimal(0)) - intent.shares  # type: ignore
    intent.executed_at = datetime.now(timezone.utc)
    settlement_order_ids = None
    if payload and isinstance(payload, dict):
        settlement_order_ids = payload.get('settlement_order_ids')
        if settlement_order_ids is not None:
            if not isinstance(settlement_order_ids, list) or any(not isinstance(x, str) or not x.strip() for x in settlement_order_ids):
                raise HTTPException(status_code=400, detail='settlement_order_ids must be a non-empty list of strings')
            # Deduplicate while preserving order
            seen = set()
            deduped: list[str] = []
            for oid in settlement_order_ids:
                if oid not in seen:
                    seen.add(oid)
                    deduped.append(oid)
            settlement_order_ids = deduped
            # Validate they exist in listings or offers (external_order_id)
            from app.models.database import Listing, Offer
            found_ids = set()
            if settlement_order_ids:
                q_list = db.query(Listing.external_order_id).filter(Listing.external_order_id.in_(settlement_order_ids)).all()
                q_offer = db.query(Offer.external_order_id).filter(Offer.external_order_id.in_(settlement_order_ids)).all()
                for (eid,) in q_list + q_offer:  # type: ignore
                    if eid:
                        found_ids.add(eid)
                if len(found_ids) != len(settlement_order_ids):
                    missing = [i for i in settlement_order_ids if i not in found_ids]
                    raise HTTPException(status_code=400, detail=f'Unknown settlement order ids: {missing}')
    # Require tx_hash for audit (simplified check)
    if not tx_hash:
        raise HTTPException(status_code=400, detail='tx_hash required for settlement proof')
    flow = Flow(etf_id=etf.id, user_id=user.id, flow_type='REDEEM', shares=intent.shares, cash_value=intent.shares * intent.nav_per_share_snapshot, nav_per_share=intent.nav_per_share_snapshot, settlement_order_ids=settlement_order_ids)
    db.add(flow)
    db.add(intent)
    db.commit()
    db.refresh(holding)
    return holding

@router.post('/competitions/{competition_id}/seed-winner-etf', response_model=DomainETF)
def seed_winner_etf(competition_id: int, symbol: str, name: str, auto_positions: bool = True, top_n: int = 10, creation_unit_size: Decimal | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Admin only for seeding
    from app.config import settings
    if user.wallet_address.lower() not in settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    comp = db.query(CompetitionModel).filter(CompetitionModel.id == competition_id).first()
    if not comp: raise HTTPException(status_code=404, detail='Competition not found')
    # Determine winner (highest portfolio_value)
    top = db.query(ParticipantModel).filter(ParticipantModel.competition_id == competition_id).order_by(ParticipantModel.portfolio_value.desc()).first()
    if not top: raise HTTPException(status_code=400, detail='No participants')
    winner_user_id = top.user_id
    # Create ETF referencing competition
    etf = DomainETFModel(owner_user_id=winner_user_id, competition_id=competition_id, name=name, symbol=symbol.upper(), description=f"Winner ETF from competition {competition_id}", total_shares=0, creation_unit_size=creation_unit_size)
    db.add(etf)
    db.flush()
    # Optionally derive positions from top traded domains by winner
    if auto_positions:
        from app.models.database import Trade
        trades = db.query(Trade.domain_token_id, Trade.price).join(ParticipantModel, ParticipantModel.id == Trade.participant_id).filter(ParticipantModel.user_id == winner_user_id, ParticipantModel.competition_id == competition_id).all()
        # Simple aggregation: count occurrences per domain_token_id
        counts: dict[str, Decimal] = {}
        for dom, price in trades:
            counts[dom] = counts.get(dom, Decimal(0)) + (price or Decimal(0))
        ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
        if ranked:
            total_val = sum(v for _, v in ranked) or Decimal(1)
            rows = []
            remaining_bps = 10000
            for i,(dom,val) in enumerate(ranked):
                if i == len(ranked)-1:
                    weight = remaining_bps
                else:
                    weight = int((val / total_val * Decimal(10000)).quantize(Decimal('1')))
                    remaining_bps -= weight
                # ensure domain exists
                name_l = str(dom).lower()
                dom_obj = db.query(DomainModel).filter(DomainModel.name == name_l).first()
                if not dom_obj:
                    dom_obj = DomainModel(name=name_l)
                    db.add(dom_obj)
                    db.flush()
                rows.append(DomainETFPositionModel(etf_id=etf.id, domain_name=name_l, weight_bps=weight))
            # Adjust rounding drift: ensure sum rows weight_bps == 10000
            current_sum = sum(r.weight_bps for r in rows)
            if current_sum != 10000 and rows:
                delta = 10000 - current_sum
                rows[0].weight_bps += delta
            for r in rows:
                db.add(r)
    db.commit()
    db.refresh(etf)
    return etf

@router.get('/etfs/{etf_id}/nav/per-share')
def nav_per_share(etf_id: int, db: Session = Depends(get_db)):
    etf = db.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    if not etf:
        raise HTTPException(status_code=404, detail='ETF not found')
    if not etf.nav_last or (etf.total_shares or 0) == 0:
        return { 'etf_id': etf_id, 'nav_per_share': None }
    nav_ps = (Decimal(etf.nav_last) / (etf.total_shares or Decimal(1))).quantize(Decimal('0.00000001'))
    return { 'etf_id': etf_id, 'nav_per_share': str(nav_ps) }

@router.get('/etfs/{etf_id}/flows', response_model=list[DomainETFShareFlow])
def list_flows(etf_id: int, limit: int = 50, offset: int = 0, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    from app.models.database import DomainETFShareFlow as Flow
    return db.query(Flow).filter(Flow.etf_id == etf_id).order_by(Flow.created_at.desc()).limit(min(limit,200)).offset(offset).all()

@router.get('/etfs/{etf_id}/my/shares')
def my_shares(etf_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    holding = db.query(DomainETFShareModel).filter(DomainETFShareModel.etf_id == etf_id, DomainETFShareModel.user_id == user.id).first()
    if not holding:
        return { 'etf_id': etf_id, 'shares': '0', 'lock_until': None }
    return { 'etf_id': etf_id, 'shares': str(holding.shares), 'lock_until': holding.lock_until.isoformat() if holding.lock_until else None }

@router.get('/etfs/{etf_id}/apy')
def get_apy(etf_id: int, lookback_days: int = 30, db: Session = Depends(get_db)):
    etf = db.query(DomainETFModel).filter(DomainETFModel.id==etf_id).first()
    if not etf:
        raise HTTPException(status_code=404, detail='ETF not found')
    apy = nav_service.estimate_apy(db, etf_id, lookback_days=lookback_days)
    return { 'etf_id': etf_id, 'apy': str(apy) if apy is not None else None, 'lookback_days': lookback_days }
