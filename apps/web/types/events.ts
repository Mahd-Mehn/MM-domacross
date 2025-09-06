// Central event typing (frontend view)
export interface BaseEvent { type: string; seq?: number; ts?: number }
export interface ListingCreatedEvent extends BaseEvent { type: 'listing_created'; id: string; domain: string; price: number; seller: string; competition_id?: string }
export interface ListingFilledEvent extends BaseEvent { type: 'listing_filled'; id: string; domain: string; price: number; seller: string; buyer: string; competition_id?: string }
export interface ListingCancelledEvent extends BaseEvent { type: 'listing_cancelled'; id: string; domain: string; price: number; seller: string; competition_id?: string }
export interface OfferCreatedEvent extends BaseEvent { type: 'offer_created'; id: string; domain: string; price: number; offerer: string; competition_id?: string }
export interface OfferAcceptedEvent extends BaseEvent { type: 'offer_accepted'; id: string; domain: string; price: number; offerer: string; seller: string; competition_id?: string }
export interface OfferCancelledEvent extends BaseEvent { type: 'offer_cancelled'; id: string; domain: string; price: number; offerer: string; competition_id?: string }
export interface TradeEvent extends BaseEvent { type: 'trade'; domain: string; price: number; side: string }
export interface NavUpdateEvent extends BaseEvent { type: 'nav_update' }
export interface ValuationUpdateEvent extends BaseEvent { type: 'valuation_update'; domain: string; value: string; previous_value?: string; change_pct?: number; model_version?: string }
export interface LeaderboardDeltaEvent extends BaseEvent { type: 'leaderboard_delta'; user?: string; address?: string; score?: number; rank?: number; delta?: number; competition_id?: string }
export type OrderbookEvent = ListingCreatedEvent | ListingFilledEvent | ListingCancelledEvent | OfferCreatedEvent | OfferAcceptedEvent | OfferCancelledEvent | TradeEvent | NavUpdateEvent | ValuationUpdateEvent | LeaderboardDeltaEvent | BaseEvent;

export function isSequenced(ev: OrderbookEvent): ev is OrderbookEvent & { seq: number } { return typeof ev.seq === 'number'; }
