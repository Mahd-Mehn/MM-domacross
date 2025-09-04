from __future__ import annotations
from typing import List, Dict, Any, Tuple, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.config import settings
from app.models.database import Valuation, Domain, Trade, OrderbookSnapshot, DomainValuationDispute
import math

class ValuationService:
        """Valuation Engine v1.1 (expanded w/ fallback tiers & dispute awareness)

        Primary blended components (when available):
            - trade_vwap (recent trades) -> weight_trade
            - floor (last recorded floor) -> weight_floor
            - orderbook_mid (median of bid/ask medians) -> weight_orderbook
            - time_decay_anchor (decayed previous valuation towards baseline) -> weight_time_decay

        Fallback Tier Selection (for transparency):
            Ordered preference for a *primary_source* used if blending degrades due to sparse data:
                1. trade_vwap (if trade_count >= min + freshness acceptable)
                2. orderbook_mid (if present)
                3. floor
                4. time_decay_anchor (decayed previous or baseline)
        The engine still blends present components; however we expose which tier served as the primary reference and the chain of fallbacks skipped.

        Disputes:
            If an OPEN dispute with votes >= threshold exists, valuation is marked disputed and the final value is *clamped* to previous valuation (no update drift) unless an admin override exists (override handled at API layer separately). This prevents contested rapid shifts.
        """

        def __init__(self):
            self.model_version = settings.valuation_model_version
            self.total_valuations = 0  # number of individual domain valuation records created
            self.total_batches = 0

    def _name_quality(self, name: str) -> Decimal:
        core = name.split('.')[0]
        length = len(core)
        if length == 0:
            return Decimal(0)
        vowels = sum(1 for c in core if c in 'aeiou')
        vowel_ratio = vowels / length
        # Ideal length 5-8 => score boost; penalize length extremes.
        length_score = 1 - abs((length - 6) / 10)
        if length_score < 0:
            length_score = 0
        vowel_balance = 1 - abs(vowel_ratio - 0.4)  # target ~0.4
        base = (length_score * 0.6 + vowel_balance * 0.4)
        return Decimal(max(base, 0))

    def _scarcity_factor(self, tld: str | None, tld_counts: Dict[str, int]) -> Decimal:
        if not tld:
            return Decimal(0.5)
        count = tld_counts.get(tld, 10)
        # Inverse log scale (rarer => higher)
        val = 1 / math.log(count + 10)
        return Decimal(min(max(val, 0.1), 2))

    def _trade_vwap(self, db: Session, domain: str) -> Tuple[Decimal | None, int]:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.valuation_trade_lookback_minutes)
        q = db.query(Trade).filter(Trade.domain_token_id==domain, Trade.timestamp >= cutoff)
        trades = q.all()
        if not trades or len(trades) < settings.valuation_min_samples_trade:
            return None, 0
        total = Decimal(0); vol = Decimal(0)
        for t in trades:
            total += Decimal(str(t.price))
            vol += Decimal(1)
        return (total / vol if vol else None, len(trades))

    def _orderbook_mid(self, db: Session, domain: str) -> Decimal | None:
        snaps = db.query(OrderbookSnapshot).filter(OrderbookSnapshot.domain_name==domain).order_by(OrderbookSnapshot.collected_at.desc()).limit(100).all()
        bids = [Decimal(str(s.price)) for s in snaps if s.side == 'BUY']
        asks = [Decimal(str(s.price)) for s in snaps if s.side == 'SELL']
        if not bids or not asks:
            return None
        bid_med = sorted(bids)[len(bids)//2]
        ask_med = sorted(asks)[len(asks)//2]
        return (bid_med + ask_med) / 2

    def _select_primary_source(self, trade_vwap: Optional[Decimal], trade_count: int, orderbook_mid: Optional[Decimal], floor: Optional[Decimal], decayed_prev: Decimal) -> Tuple[str, list[str], Decimal]:
        """Determine primary source and fallback chain for transparency.

        Returns (primary_source, fallback_chain, primary_price_value)
        """
        chain: list[str] = []
        if trade_vwap is not None and trade_count >= settings.valuation_min_samples_trade:
            return 'trade_vwap', chain, trade_vwap
        chain.append('trade_vwap')
        if orderbook_mid is not None:
            return 'orderbook_mid', chain, orderbook_mid
        chain.append('orderbook_mid')
        if floor is not None:
            return 'floor', chain, floor
        chain.append('floor')
        return 'time_decay_anchor', chain, decayed_prev

    def value_domains(self, db: Session, domains_input: List[str], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        from datetime import timedelta
        # Precompute TLD counts for scarcity
        tld_counts: Dict[str, int] = context.get('tld_counts') or {}
        floors: Dict[str, Decimal] = context.get('floors') or {}
        results: List[Dict[str, Any]] = []
        for name in domains_input:
            name_l = name.lower()
            tld = name_l.split('.')[-1] if '.' in name_l else None
            floor = floors.get(name_l)
            scarcity = self._scarcity_factor(tld, tld_counts)
            quality = self._name_quality(name_l)
            trade_vwap, trade_count = self._trade_vwap(db, name_l)
            orderbook_mid = self._orderbook_mid(db, name_l)
            # Time decay anchor: previous valuation decayed towards baseline
            prev = db.query(Valuation).filter(Valuation.domain_name==name_l).order_by(Valuation.created_at.desc()).first()
            baseline = Decimal(100)
            prev_val = Decimal(str(prev.value)) if prev else baseline
            age_seconds = (datetime.now(timezone.utc) - prev.created_at).total_seconds() if prev and prev.created_at else 0
            decay_factor = Decimal(math.exp(-settings.valuation_decay_lambda * age_seconds)) if age_seconds else Decimal(1)
            decayed_prev = prev_val * decay_factor + baseline * (1 - decay_factor)
            # Dispute check
            dispute = db.query(DomainValuationDispute).filter(DomainValuationDispute.domain_name==name_l, DomainValuationDispute.status=='OPEN').first()
            dispute_votes = dispute.votes if dispute else 0
            dispute_active = bool(dispute and dispute_votes >= settings.valuation_dispute_vote_threshold)
            # Compose weighted value
            wt_trade = Decimal(str(settings.valuation_weight_trade))
            wt_floor = Decimal(str(settings.valuation_weight_floor))
            wt_ob = Decimal(str(settings.valuation_weight_orderbook))
            wt_decay = Decimal(str(settings.valuation_weight_time_decay))
            used_trade = trade_vwap is not None
            used_floor = floor is not None
            used_ob = orderbook_mid is not None
            # Normalize dynamic presence (retain original relative weights among present components)
            components: List[Tuple[str, Decimal, Decimal]] = []  # (key, value, weight)
            if used_trade:
                components.append(('trade_vwap', trade_vwap, wt_trade))  # type: ignore
            if used_floor:
                components.append(('floor', floor, wt_floor))  # type: ignore
            if used_ob:
                components.append(('orderbook_mid', orderbook_mid, wt_ob))  # type: ignore
            components.append(('time_decay_anchor', decayed_prev, wt_decay))
            weight_sum = sum(c[2] for c in components) or Decimal(1)
            weighted_val = sum(c[1]*c[2] for c in components) / weight_sum
            final_value = weighted_val.quantize(Decimal('0.01'))
            freshness = Decimal(math.exp(-settings.valuation_freshness_lambda * age_seconds)) if age_seconds else Decimal(1)
            primary_source, fallback_chain, primary_price = self._select_primary_source(trade_vwap, trade_count, orderbook_mid, floor, decayed_prev)
            # Dispute clamp: if active dispute, freeze at prev_val (no new shift) but still record factors for transparency.
            if dispute_active:
                final_value = prev_val.quantize(Decimal('0.01'))
            valuation = Valuation(domain_name=name_l, model_version=self.model_version, value=final_value, factors={
                'trade_vwap': str(trade_vwap) if trade_vwap is not None else None,
                'trade_count': trade_count,
                'floor_price': str(floor) if floor is not None else None,
                'orderbook_mid': str(orderbook_mid) if orderbook_mid is not None else None,
                'time_decay_anchor': str(decayed_prev.quantize(Decimal('0.01'))),
                'weights': {
                    'trade': str(wt_trade), 'floor': str(wt_floor), 'orderbook': str(wt_ob), 'time_decay': str(wt_decay)
                },
                'scarcity': str(scarcity),
                'quality': str(quality),
                'decay_factor': str(decay_factor.quantize(Decimal('0.0001'))),
                'freshness_score': str(freshness.quantize(Decimal('0.0001'))),
                'primary_source': primary_source,
                'fallback_chain': fallback_chain,
                'primary_price': str(primary_price.quantize(Decimal('0.01'))),
                'disputed': dispute_active,
                'dispute_votes': dispute_votes if dispute else 0
            })
            db.add(valuation)
            domain = db.query(Domain).filter(Domain.name==name_l).first()
            if domain:
                domain.last_estimated_value = final_value
            results.append({
                'domain': name_l,
                'value': str(final_value),
                'model_version': self.model_version,
                'factors': valuation.factors
            })
            self.total_valuations += 1
        self.total_batches += 1
        db.commit()
        return results

valuation_service = ValuationService()
