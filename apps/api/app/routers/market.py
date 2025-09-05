from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import Optional
from app.database import get_db
from app.models.database import Listing, Offer, Domain, Trade, Participant, Competition, TradeRiskFlag, CompetitionReward, CompetitionEpoch, ParticipantHolding
from app.deps.auth import get_current_user
from app.config import settings
from app.services.reconciliation_service import reconciliation_service
from app.services.backfill_service import backfill_service
from app.models.database import User as UserModel
from datetime import datetime, timezone, timedelta
from app.broadcast import get_sync_broadcast
from app.services.metrics_service import invalidate_leaderboard_cache

router = APIRouter()

def _post_trade_hooks(db: Session, trade: Trade, domain_name: str):
    """Apply risk heuristics and update competition reward points.
    Heuristics (simple):
    - Wash trade: same wallet executes BUY then SELL (or vice versa) on same domain within 120s.
    - Rapid flip: more than 3 trades on same domain by same participant in 10m.
    Reward points: volume contribution = price; simple Sharpe-like placeholder omitted.
    """
    # Fetch participant & related competition
    from app.models.database import Participant as P, Competition as C, Trade as T, TradeRiskFlag, CompetitionReward, CompetitionEpoch
    part = db.query(P).filter(P.id == trade.participant_id).first()
    if not part:
        return
    # Recent trades for risk analysis
    now = datetime.now(timezone.utc)
    window_120s = now - timedelta(seconds=120)
    window_10m = now - timedelta(minutes=10)
    recent_trades = db.query(T).filter(T.participant_id==trade.participant_id, T.domain_token_id==domain_name, T.id != trade.id, T.timestamp >= window_10m).all()
    # Wash trade detection: opposite side within 120s
    broadcast = get_sync_broadcast()
    # Track whether to emit leaderboard delta later
    leaderboard_comp_id: int | None = None
    for rt in recent_trades:
        if rt.trade_type != trade.trade_type and rt.timestamp >= window_120s:
            flag = TradeRiskFlag(trade_id=trade.id, flag_type='WASH_LIKELY', details={'against_trade_id': rt.id})
            db.add(flag)
            if broadcast:
                broadcast({'type': 'risk_flag', 'trade_id': trade.id, 'flag_type': 'WASH_LIKELY'})
            break
    # Rapid flip detection
    flips = sum(1 for rt in recent_trades if rt.trade_type != trade.trade_type)
    if flips >= 3:
        rf = TradeRiskFlag(trade_id=trade.id, flag_type='RAPID_FLIP', details={'flip_count': flips})
        db.add(rf)
        if broadcast:
            broadcast({'type': 'risk_flag', 'trade_id': trade.id, 'flag_type': 'RAPID_FLIP'})
    # Points update: find active epoch
    comp = db.query(C).join(P, P.competition_id == C.id).filter(P.id==part.id).first()
    if not comp:
        return
    ep = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==comp.id, CompetitionEpoch.start_time <= now, CompetitionEpoch.end_time >= now).first()
    if not ep:
        return
    # Upsert reward row (need trade_value first)
    reward = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==ep.id, CompetitionReward.user_id==part.user_id).first()
    trade_value = trade.price or 0
    # Maintain holdings after determining trade_value
    holding = db.query(ParticipantHolding).filter(ParticipantHolding.participant_id==part.id, ParticipantHolding.domain_name==domain_name).first()
    if trade.trade_type == 'BUY':
        if not holding:
            holding = ParticipantHolding(participant_id=part.id, domain_name=domain_name, quantity=1, avg_cost=trade_value)
            db.add(holding)
        else:
            new_q = (holding.quantity or 0) + 1
            holding.avg_cost = ((holding.avg_cost or 0)*(holding.quantity or 0) + trade_value) / new_q  # type: ignore
            holding.quantity = new_q
    elif trade.trade_type == 'SELL':
        if holding and (holding.quantity or 0) > 0:
            holding.quantity = (holding.quantity or 0) - 1  # type: ignore
            if holding.quantity <= 0:
                holding.quantity = 0
    # Update participant realized/unrealized pnl (placeholder: treat BUY as negative cash flow, SELL as positive)
    if trade.trade_type == 'BUY':
        part.realized_pnl = (part.realized_pnl or 0) - trade_value  # type: ignore
    else:
        part.realized_pnl = (part.realized_pnl or 0) + trade_value  # type: ignore
    # Simplistic unrealized pnl left unchanged (would require current valuations)
    # Compute risk-adjusted metrics inputs
    # Turnover ratio ~ cumulative volume / portfolio_value (avoid divide by zero)
    existing_volume = reward.volume if reward else 0
    new_cum_volume = (existing_volume or 0) + trade_value  # type: ignore
    portfolio_val = part.portfolio_value or 0
    turnover_ratio = (new_cum_volume / portfolio_val) if portfolio_val else 0
    # Concentration index placeholder: inverse of number of domains touched (maintain simple cardinality via reward.factors if needed)
    # For now approximate with square root dampening of turnover
    from decimal import Decimal as D
    # True concentration via HHI on holdings weights
    hhi = D(0)
    holdings = db.query(ParticipantHolding).filter(ParticipantHolding.participant_id==part.id, ParticipantHolding.quantity > 0).all()
    if holdings:
        total_val = D(0)
        for h in holdings:
            dom = db.query(Domain).filter(Domain.name==h.domain_name).first()
            estimated = D(dom.last_estimated_value) if dom and dom.last_estimated_value is not None else D(h.avg_cost or 0)
            total_val += estimated
        if total_val > 0:
            for h in holdings:
                dom = db.query(Domain).filter(Domain.name==h.domain_name).first()
                estimated = D(dom.last_estimated_value) if dom and dom.last_estimated_value is not None else D(h.avg_cost or 0)
                w = estimated / total_val
                hhi += w * w
    concentration_index = hhi
    # Enhanced Sharpe-like: realized_pnl / sqrt(cum_volume) with stability floor
    import math
    sharpe_like = None
    if new_cum_volume and abs(float(new_cum_volume)) > 0:
        try:
            sharpe_like = float(part.realized_pnl or 0) / math.sqrt(float(new_cum_volume))  # type: ignore
        except Exception:
            sharpe_like = None
    # Normalize Sharpe into [-1,1] using x/(1+|x|)
    sharpe_norm = 0.0
    if sharpe_like is not None:
        try:
            sharpe_norm = float(sharpe_like) / (1 + abs(float(sharpe_like)))
        except Exception:
            sharpe_norm = 0.0
    from app.config import settings as cfg
    # Turnover component: encourage some activity but clamp at 1
    turnover_norm = min(float(turnover_ratio), 1.0)
    # Concentration reward: prefer diversification (1 - HHI) where HHI in [0,1]
    diversification = 1.0 - float(concentration_index or 0)
    if diversification < 0:
        diversification = 0.0
    # Weighted multiplier base
    raw_multiplier = 1.0 
    raw_multiplier += cfg.reward_sharpe_weight * sharpe_norm
    raw_multiplier += cfg.reward_turnover_weight * turnover_norm
    raw_multiplier += cfg.reward_concentration_weight * diversification
    # Clamp multiplier
    raw_multiplier = max(cfg.reward_min_multiplier, min(cfg.reward_max_multiplier, raw_multiplier))
    incremental_points = trade_value * raw_multiplier
    if not reward:
        reward = CompetitionReward(
            competition_id=comp.id,
            epoch_id=ep.id,
            user_id=part.user_id,
            points=incremental_points,
            volume=trade_value,
            pnl=part.realized_pnl,
            sharpe_like=sharpe_like,
            turnover_ratio=turnover_ratio,
            concentration_index=concentration_index,
        )
        db.add(reward)
    else:
        reward.points = (reward.points or 0) + incremental_points  # type: ignore
        reward.volume = (reward.volume or 0) + trade_value  # type: ignore
        reward.pnl = part.realized_pnl
        reward.sharpe_like = sharpe_like
        reward.turnover_ratio = turnover_ratio
        reward.concentration_index = concentration_index
    db.flush()
    leaderboard_comp_id = comp.id
    # After reward/points update, broadcast leaderboard delta for this participant (simplified rank computation)
    if leaderboard_comp_id and broadcast:
        # Compute rank with window function approximation via ordering
        from app.models.database import Participant as P2
        rows = (db.query(P2.id, P2.user_id, P2.portfolio_value)
                .filter(P2.competition_id==leaderboard_comp_id)
                .order_by(P2.portfolio_value.desc())
                .limit(50).all())  # only top 50 for delta context
        rank = None
        for idx, r in enumerate(rows, start=1):
            if r.id == part.id:
                rank = idx
                break
        broadcast({
            'type': 'leaderboard_delta',
            'competition_id': leaderboard_comp_id,
            'updates': [{
                'participant_id': part.id,
                'user_id': part.user_id,
                'portfolio_value': str(part.portfolio_value or 0),
                'rank': rank,
            }]
        })
    invalidate_leaderboard_cache(leaderboard_comp_id)

def _get_or_create_domain(db: Session, name: str) -> Domain:
    name_l = name.lower()
    dom = db.query(Domain).filter(Domain.name == name_l).first()
    if not dom:
        tld = name_l.split('.')[-1] if '.' in name_l else None
        dom = Domain(name=name_l, tld=tld, last_seen_event_at=datetime.now(timezone.utc))
        db.add(dom)
        db.flush()
    return dom

@router.post('/market/listing')
def create_listing(
    domain: str,
    contract: str,
    token_id: str,
    price: str,
    external_order_id: str | None = None,
    tx_hash: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Persist off-chain listing snapshot (SDK handles on-chain / remote orderbook)
    _get_or_create_domain(db, domain)
    try:
        price_dec = Decimal(price)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid price')
    from app.config import settings
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.listing_ttl_days)
    listing = Listing(domain_name=domain.lower(), seller_wallet=user.wallet_address.lower(), price=price_dec, tx_hash=tx_hash, external_order_id=external_order_id, expires_at=expires_at)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return { 'id': listing.id, 'domain': domain.lower(), 'price': str(listing.price) }

@router.post('/market/buy')
def record_buy(
    order_id: Optional[str] = None,
    domain: Optional[str] = None,
    price: Optional[str] = None,
    tx_hash: Optional[str] = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Simple persistence: mark any listing inactive if domain provided & seller differs.
    if domain:
        name_l = domain.lower()
        _get_or_create_domain(db, name_l)
        # Deactivate lowest priced active listing as matched fill heuristic
        lst = db.query(Listing).filter(Listing.domain_name == name_l, Listing.active == True).order_by(Listing.price.asc()).first()  # noqa: E712
        if lst:
            lst.active = False
            # Record a trade entry for participants referencing this domain (simplistic: any participant of any competition by seller/buyer wallet)
            try:
                from decimal import Decimal as D
                trade_price = D(price) if price else lst.price
            except Exception:
                trade_price = lst.price
            now_ts = datetime.now(timezone.utc)
            participants = (
                db.query(Participant)
                .join(UserModel, Participant.user_id == UserModel.id)
                .join(Competition, Competition.id == Participant.competition_id)
                .filter(
                    UserModel.wallet_address.in_([user.wallet_address.lower(), lst.seller_wallet]),
                    Competition.start_time <= now_ts,
                    Competition.end_time >= now_ts,
                )
                .all()
            )
            for part in participants:
                trade_type = 'BUY' if part.user_id == user.id else 'SELL'
                tr = Trade(participant_id=part.id, domain_token_address=contract_placeholder(lst.domain_name), domain_token_id=lst.domain_name, trade_type=trade_type, price=trade_price, tx_hash=tx_hash or order_id or "local")
                db.add(tr)
                db.flush()
                _post_trade_hooks(db, tr, lst.domain_name)
                # broadcast trade
                broadcast = get_sync_broadcast()
                if broadcast:
                    broadcast({ 'type': 'trade', 'domain': lst.domain_name, 'price': str(trade_price), 'side': trade_type })
    db.commit()
    return { 'status': 'ok', 'order_id': order_id }

@router.post('/market/offer')
def create_offer(
    domain: str,
    contract: str,
    token_id: str,
    price: str,
    external_order_id: str | None = None,
    tx_hash: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    _get_or_create_domain(db, domain)
    try:
        price_dec = Decimal(price)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid price')
    offer = Offer(domain_name=domain.lower(), buyer_wallet=user.wallet_address.lower(), price=price_dec, tx_hash=tx_hash, external_order_id=external_order_id)
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return { 'id': offer.id, 'domain': domain.lower(), 'price': str(offer.price) }

@router.post('/market/cancel-listing')
def cancel_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    lst = db.query(Listing).filter(Listing.id == listing_id, Listing.seller_wallet == user.wallet_address.lower()).first()
    if not lst:
        raise HTTPException(status_code=404, detail='Listing not found')
    lst.active = False
    db.commit()
    return { 'status': 'cancelled', 'listing_id': listing_id }

@router.post('/market/cancel-offer')
def cancel_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    off = db.query(Offer).filter(Offer.id == offer_id, Offer.buyer_wallet == user.wallet_address.lower()).first()
    if not off:
        raise HTTPException(status_code=404, detail='Offer not found')
    off.active = False
    db.commit()
    return { 'status': 'cancelled', 'offer_id': offer_id }

@router.post('/market/accept-offer')
def accept_offer(
    offer_id: int | None = None,
    external_order_id: str | None = None,
    domain: str | None = None,
    price: str | None = None,
    tx_hash: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Locate offer by internal id or external_order_id
    q = db.query(Offer).filter(Offer.active == True)  # noqa: E712
    if offer_id is not None:
        q = q.filter(Offer.id == offer_id)
    elif external_order_id is not None:
        q = q.filter(Offer.external_order_id == external_order_id)
    else:
        raise HTTPException(status_code=400, detail='offer_id or external_order_id required')
    off = q.first()
    if not off:
        raise HTTPException(status_code=404, detail='Offer not found or inactive')
    # Ensure domain alignment if provided
    if domain and off.domain_name != domain.lower():
        raise HTTPException(status_code=400, detail='Domain mismatch')
    # Seller is current user; buyer is offer.buyer_wallet
    # Deactivate offer
    off.active = False
    # Record trades for participants (BUY for offer buyer, SELL for current user)
    from decimal import Decimal as D
    try:
        trade_price = D(price) if price else off.price
    except Exception:
        trade_price = off.price
    # Gather participants related to either wallet
    now_ts = datetime.now(timezone.utc)
    participants = (
        db.query(Participant)
        .join(UserModel, Participant.user_id == UserModel.id)
        .join(Competition, Competition.id == Participant.competition_id)
        .filter(
            UserModel.wallet_address.in_([user.wallet_address.lower(), off.buyer_wallet]),
            Competition.start_time <= now_ts,
            Competition.end_time >= now_ts,
        )
        .all()
    )
    for part in participants:
        trade_type = 'SELL' if part.user_id == user.id else 'BUY'
        tr = Trade(
            participant_id=part.id,
            domain_token_address=contract_placeholder(off.domain_name),
            domain_token_id=off.domain_name,
            trade_type=trade_type,
            price=trade_price,
            tx_hash=tx_hash or external_order_id or f"offer-{off.id}"
        )
        db.add(tr)
        db.flush()
        _post_trade_hooks(db, tr, off.domain_name)
        broadcast = get_sync_broadcast()
        if broadcast:
            broadcast({ 'type': 'trade', 'domain': off.domain_name, 'price': str(trade_price), 'side': trade_type })
    db.commit()
    return { 'status': 'accepted', 'offer_id': off.id }

@router.delete('/market/expired/listings')
def cleanup_expired_listings(
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Allow only admins for cleanup
    from app.config import settings
    if user.wallet_address.lower() not in settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    now = datetime.now(timezone.utc)
    q = db.query(Listing).filter(Listing.active == True, Listing.expires_at != None, Listing.expires_at < now)  # noqa: E712
    count = 0
    for lst in q.all():
        lst.active = False
        count += 1
    db.commit()
    return { 'deactivated': count }

# Helper placeholder for domain token address until mapping is introduced
def contract_placeholder(domain_name: str) -> str:
    # Could map TLD or domain to a known contract; for now return zero address
    return '0x' + '0'*40


def _assert_admin(user: UserModel):
    if user.wallet_address.lower() not in (settings.admin_wallets or []):
        raise HTTPException(status_code=403, detail='admin only')

@router.post('/market/reconcile')
async def reconcile_market(limit: int = 200, user: UserModel = Depends(get_current_user)):
    _assert_admin(user)
    res = await reconciliation_service.run_once(limit=limit)
    return { 'status': 'ok', 'result': res }

@router.get('/market/missing-external-ids')
def list_missing_external_ids(limit: int = 100, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    _assert_admin(user)
    listings = db.query(Listing.id, Listing.domain_name, Listing.price).filter(Listing.external_order_id == None).order_by(Listing.created_at.desc()).limit(limit).all()  # noqa: E711
    offers = db.query(Offer.id, Offer.domain_name, Offer.price).filter(Offer.external_order_id == None).order_by(Offer.created_at.desc()).limit(limit).all()  # noqa: E711
    return {
        'listings_missing': [ { 'id': l.id, 'domain': l.domain_name, 'price': str(l.price) } for l in listings ],
        'offers_missing': [ { 'id': o.id, 'domain': o.domain_name, 'price': str(o.price) } for o in offers ],
    }

@router.post('/market/backfill-external-id')
def backfill_external_id(kind: str, internal_id: int, external_order_id: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    _assert_admin(user)
    if kind not in ('listing','offer'):
        raise HTTPException(status_code=400, detail='kind must be listing or offer')
    if kind == 'listing':
        obj = db.query(Listing).filter(Listing.id == internal_id).first()
    else:
        obj = db.query(Offer).filter(Offer.id == internal_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail='not found')
    if obj.external_order_id and obj.external_order_id != external_order_id:
        raise HTTPException(status_code=409, detail='external_order_id already set')
    obj.external_order_id = external_order_id
    db.commit()
    return { 'status': 'backfilled', 'kind': kind, 'id': internal_id, 'external_order_id': external_order_id }

@router.post('/market/run-auto-backfill')
def run_auto_backfill(limit: int = 200, lookback_minutes: int = 1440, user: UserModel = Depends(get_current_user)):
    _assert_admin(user)
    res = backfill_service.run_once(lookback_minutes=lookback_minutes, limit=limit)
    return { 'status': 'ok', 'result': res }
