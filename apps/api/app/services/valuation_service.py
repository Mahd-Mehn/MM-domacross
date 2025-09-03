from __future__ import annotations
from typing import List, Dict, Any
from decimal import Decimal
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.config import settings
from app.models.database import Valuation, Domain
import math

class ValuationService:
    """A slightly complex but fully functional valuation model combining heuristics.

    Features:
    - Recent floor price (weight 0.4)
    - Offers median (weight 0.2)
    - Listings median (weight 0.15)
    - Scarcity factor: inverse log of TLD frequency (weight 0.15)
    - Name quality score: length & vowels/consonant mix heuristic (weight 0.1)
    Fallback to synthesized baseline if data sparse.
    """

    def __init__(self):
        self.model_version = settings.valuation_model_version

    def _name_quality(self, name: str) -> Decimal:
        core = name.split('.')[0]
        length = len(core)
        if length == 0:
            return Decimal(0)
        vowels = sum(1 for c in core if c in 'aeiou')
        vowel_ratio = vowels / length
        # Ideal length 5-8 => score boost; penalize length extremes.
        length_score = 1 - abs((length - 6) / 10)
        length_score = max(0, length_score)
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

    def value_domains(self, db: Session, domains_input: List[str], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Precompute TLD counts for scarcity
        tld_counts: Dict[str, int] = context.get('tld_counts') or {}
        listings_map: Dict[str, List[Decimal]] = context.get('listings') or {}
        offers_map: Dict[str, List[Decimal]] = context.get('offers') or {}
        floor_map: Dict[str, Decimal] = context.get('floors') or {}
        results: List[Dict[str, Any]] = []
        for name in domains_input:
            name_l = name.lower()
            tld = name_l.split('.')[-1] if '.' in name_l else None
            floor = floor_map.get(name_l)
            list_prices = listings_map.get(name_l, [])
            offer_prices = offers_map.get(name_l, [])
            listing_median = (sorted(list_prices)[len(list_prices)//2] if list_prices else None)
            offer_median = (sorted(offer_prices)[len(offer_prices)//2] if offer_prices else None)
            scarcity = self._scarcity_factor(tld, tld_counts)
            quality = self._name_quality(name_l)
            # Weighted components with fallbacks
            comp_values = []
            weights = []
            if floor is not None:
                comp_values.append(floor); weights.append(Decimal('0.4'))
            if offer_median is not None:
                comp_values.append(offer_median); weights.append(Decimal('0.2'))
            if listing_median is not None:
                comp_values.append(listing_median); weights.append(Decimal('0.15'))
            # Convert scarcity & quality to value proxies scaling ~ floor if available else baseline 100
            baseline_anchor = floor or listing_median or offer_median or Decimal(100)
            comp_values.append(baseline_anchor * scarcity); weights.append(Decimal('0.15'))
            comp_values.append(baseline_anchor * quality); weights.append(Decimal('0.1'))
            weighted_sum = sum(v*w for v, w in zip(comp_values, weights))
            weight_total = sum(weights) or Decimal(1)
            final_value = (weighted_sum / weight_total).quantize(Decimal('0.01'))
            # Persist valuation
            valuation = Valuation(domain_name=name_l, model_version=self.model_version, value=final_value, factors={
                'floor_price': str(floor) if floor is not None else None,
                'offer_median': str(offer_median) if offer_median is not None else None,
                'listing_median': str(listing_median) if listing_median is not None else None,
                'scarcity': str(scarcity),
                'quality': str(quality)
            })
            db.add(valuation)
            # Update Domain last_estimated_value
            domain = db.query(Domain).filter(Domain.name == name_l).first()
            if domain:
                domain.last_estimated_value = final_value
            results.append({
                'domain': name_l,
                'value': str(final_value),
                'model_version': self.model_version,
                'factors': valuation.factors
            })
        db.commit()
        return results

valuation_service = ValuationService()
