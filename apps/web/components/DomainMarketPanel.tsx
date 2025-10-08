"use client";

import { useDomain, useListings, useOffers, useValuation } from "../lib/hooks/useDomainData";
import { useOrderbook } from "../lib/hooks/useOrderbook";
import { useBuyDomain, useMakeOffer, useCancelListing, useCancelOffer, useAcceptOffer } from "../lib/hooks/useMarketplaceActions";
import { useState } from "react";
import DisputeBanner from "../app/components/DisputeBanner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function DomainMarketPanel({ name }: { name: string }) {
  const domainQ = useDomain(name);
  const listingsQ = useListings(name);
  const offersQ = useOffers(name);
  const valuationQ = useValuation(name);
  const orderbookQ = useOrderbook(name, { intervalMs: 20_000 });
  const buyMut = useBuyDomain();
  const offerMut = useMakeOffer();
  const cancelListingMut = useCancelListing();
  const cancelOfferMut = useCancelOffer();
  const acceptOfferMut = useAcceptOffer();
  const [actionPrice, setActionPrice] = useState("");
  const lower = name.toLowerCase();

  return (
    <div className="grid md:grid-cols-3 gap-6">
    <Card className="glass-dark md:col-span-1 space-y-2">
        <CardHeader>
          <CardTitle className="text-sm">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
      <DisputeBanner domain={lower} />
          {domainQ.isLoading && <div>Loading domain...</div>}
          {domainQ.error && <div className="text-red-400">Error loading domain</div>}
          {domainQ.data && (
            <ul className="space-y-1">
              <li><span className="text-slate-400">Name:</span> {domainQ.data.domain.name}</li>
              <li><span className="text-slate-400">Last Floor:</span> {domainQ.data.domain.last_floor_price ?? '—'}</li>
              <li><span className="text-slate-400">Est. Value:</span> {domainQ.data.domain.last_estimated_value ?? valuationQ.data?.value ?? '—'}</li>
              <li><span className="text-slate-400">Valuation Model:</span> {valuationQ.data?.model_version ?? '—'}</li>
            </ul>
          )}
          <div className="pt-3 flex gap-2 items-center">
            <input
              type="text"
              placeholder="Price"
              value={actionPrice}
              onChange={e => setActionPrice(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-xs flex-1 focus:outline-none"
            />
            <Button size="sm" disabled={!actionPrice || buyMut.isPending} onClick={() => buyMut.mutate({ domain: lower, price: actionPrice })}>Buy</Button>
            <Button size="sm" variant="outline" disabled={!actionPrice || offerMut.isPending} onClick={() => offerMut.mutate({ domain: lower, price: actionPrice, contract: '0x0000000000000000000000000000000000000000', tokenId: '0' })}>Offer</Button>
          </div>
          {(buyMut.isPending || offerMut.isPending) && <div className="text-amber-400 text-[10px]">Submitting...</div>}
        </CardContent>
      </Card>
      <Card className="glass-dark md:col-span-1">
        <CardHeader><CardTitle className="text-sm">Listings</CardTitle></CardHeader>
        <CardContent className="max-h-64 overflow-auto text-xs space-y-1">
          {listingsQ.data.slice(0,10).map(l => (
            <div key={l.id} className="flex items-center justify-between gap-2 group">
              <div className="flex flex-col">
                <span className="text-slate-400">{l.price}</span>
                <span className="truncate max-w-[120px] text-[10px] text-slate-500" title={l.seller}>{l.seller}</span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                <Button size="sm" variant="outline" disabled={cancelListingMut.isPending} onClick={() => cancelListingMut.mutate(String(l.id))}>Cancel</Button>
              </div>
            </div>
          ))}
          {listingsQ.data.length === 0 && <div className="text-slate-500">No listings</div>}
        </CardContent>
      </Card>
      <Card className="glass-dark md:col-span-1">
        <CardHeader><CardTitle className="text-sm">Offers / Orderbook</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-slate-300 text-[11px]">Offers</div>
            {offersQ.data.slice(0,10).map(o => (
              <div key={o.id} className="flex items-center justify-between gap-2 group">
                <div className="flex flex-col">
                  <span className="text-slate-400">{o.price}</span>
                  <span className="truncate max-w-[120px] text-[10px] text-slate-500" title={o.buyer}>{o.buyer}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                  <Button size="sm" variant="outline" disabled={acceptOfferMut.isPending} onClick={() => acceptOfferMut.mutate(String(o.id))}>Accept</Button>
                  <Button size="sm" variant="ghost" disabled={cancelOfferMut.isPending} onClick={() => cancelOfferMut.mutate(String(o.id))}>X</Button>
                </div>
              </div>
            ))}
            {offersQ.data.length === 0 && <div className="text-slate-500">No offers</div>}
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-slate-300 text-[11px]">Orderbook</div>
            {orderbookQ.data && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-[10px] text-slate-500 mb-1">Bids</div>
                  {orderbookQ.data.bids.slice(0,5).map((b,i)=>(<div key={i} className="text-emerald-400">{b.price}</div>))}
                  {orderbookQ.data.bids.length===0 && <div className="text-slate-500">—</div>}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-slate-500 mb-1">Asks</div>
                  {orderbookQ.data.asks.slice(0,5).map((a,i)=>(<div key={i} className="text-rose-400">{a.price}</div>))}
                  {orderbookQ.data.asks.length===0 && <div className="text-slate-500">—</div>}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
