"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useDomainMarketplace, useTransactionConfirmation } from "../lib/hooks/useContracts";
import { useWebSocket } from "../hooks/useWebSocket";
import { useOrderbookSdk } from "../lib/orderbook/client";
import { pushEvent } from "../lib/events/store";
import { formatUnits, parseUnits as viemParseUnits } from "viem";

interface Domain {
  id: string;
  name: string;
  price: string;
  owner: string;
  contract: string;
  tokenId: string;
}

interface Order {
  id: string;
  seller: string;
  domainName: string;
  price: string;
  contract: string;
  tokenId: string;
}

interface TradingInterfaceProps {
  competitionId: string;
  isActive: boolean;
}

export default function TradingInterface({ competitionId, isActive }: TradingInterfaceProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(()=> { setMounted(true); }, []);
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'orders' | 'offers'>('market');
  const [domains, setDomains] = useState<Domain[]>([]); // placeholder / future expansion
  const [orders, setOrders] = useState<Order[]>([]); // active listings
  const [userDomains, setUserDomains] = useState<Domain[]>([]); // owned domains (placeholder)
  const [userOrders, setUserOrders] = useState<Order[]>([]); // derived from orders where seller == wallet
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [opProgress, setOpProgress] = useState<{ step: string; pct: number; label: string } | null>(null);
  const [createForm, setCreateForm] = useState({ contract: '', tokenId: '', priceEth: '' });
  const [gap, setGap] = useState(false);
  const { createListing, buyListing, cancelListing, createOffer, acceptOffer, cancelOffer, hasSigner, address: walletAddress, getSupportedCurrencies } = useOrderbookSdk();
  const [seq, setSeq] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const stored = window.localStorage.getItem('rt_seq');
    return stored ? parseInt(stored, 10) : 0;
  }); // last applied sequence persisted
  const [offers, setOffers] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [offerForm, setOfferForm] = useState({ contract: '', tokenId: '', priceEth: '', currency: (typeof window!=='undefined' && localStorage.getItem('offer_currency')) || 'ETH' });
  const [currencies, setCurrencies] = useState<{symbol:string; contractAddress:string; decimals:number}[]>([]);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const pendingOptimistic = useRef<Record<string, {type:'listing'|'cancel'|'buy'; timeout: any}>>({});
  const [toasts,setToasts]=useState<{id:number; msg:string; level:'warn'|'info'}[]>([]);
  const toastSeq = useRef(0);
  function pushToast(msg:string, level:'warn'|'info'='info'){ toastSeq.current+=1; setToasts(t=>[...t,{id:toastSeq.current,msg,level}]); }
  useEffect(()=>{ if(!toasts.length) return; const timer=setTimeout(()=> setToasts(t=> t.slice(1)), 4000); return ()=> clearTimeout(timer); },[toasts]);

  // WebSocket for real-time order / listing events
  const { events: wsEvents, subscribe: wsSub, connected: wsConnected } = useWebSocket(
    (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_WS || 'ws://localhost:8000/ws') : '') +
  `?events=trade,valuation_update,leaderboard_delta,listing_created,listing_filled,listing_cancelled,offer_created,offer_accepted,offer_cancelled&competitions=${competitionId}`,
    {
      onEvent: (ev) => {
        if (ev.type === 'hello') return; // bootstrap
        // basic sequence monotonic guard
  if (typeof ev.seq === 'number') {
          if (ev.seq > seq + 1) {
            // gap detected -> incremental fetch using since_seq
            setGap(true);
            void incrementalBackfill(seq);
          }
          if (ev.seq <= seq) return; // stale
          setSeq(ev.seq);
          try { if (typeof window !== 'undefined') localStorage.setItem('rt_seq', String(ev.seq)); } catch {}
        }
  // feed capture
  try { pushEvent(ev as any); } catch {}
        // handle domain related events (placeholder: extend when backend emits order events)
        if (ev.type === 'trade' && ev.domain) {
          setDomains(prev => {
            // simple price echo adjustment if domain present
            return prev.map(d => d.name === ev.domain ? {...d, price: ev.price?.toString?.() || d.price} : d);
          });
        }
        if (ev.type === 'listing_created') {
            setOrders(prev => {
              // Replace optimistic temp listing if matches contract+token pattern in name
              const contract = (ev as any).contract || '';
              const tokenId = (ev as any).token_id || '';
              const optimisticIdx = prev.findIndex(o => o.id.startsWith('temp-') && o.contract === contract && o.tokenId === tokenId);
              if (optimisticIdx >=0) {
                const clone = [...prev];
                clone[optimisticIdx] = { id: ev.id, seller: ev.seller, domainName: ev.domain, price: String(ev.price), contract, tokenId };
                return clone;
              }
              if (prev.find(o => o.id === ev.id)) return prev; // de-dupe
              return [...prev, { id: ev.id, seller: ev.seller, domainName: ev.domain, price: String(ev.price), contract, tokenId }];
            });
        }
        if (ev.type === 'listing_cancelled') {
            setOrders(prev => prev.filter(o => o.id !== ev.id));
        }
    if (ev.type === 'listing_filled') {
      // remove optimistically if still present
      setOrders(prev => prev.filter(o => o.id !== ev.id));
      // clear pending optimistic buy marker
      if(pendingOptimistic.current[ev.id]) { clearTimeout(pendingOptimistic.current[ev.id].timeout); delete pendingOptimistic.current[ev.id]; }
    }
        if (ev.type === 'leaderboard_delta') {
          // Could hook into portfolio valuations later
        }
        if (ev.type === 'offer_created') {
          setOffers(prev => {
            const contract = (ev as any).contract || '';
            const tokenId = (ev as any).token_id || '';
            const optimisticIdx = prev.findIndex(o => o.id.startsWith('temp-offer-') && o.domainName.includes(tokenId));
            if (optimisticIdx >=0) {
              const clone = [...prev];
              clone[optimisticIdx] = { id: ev.id, domainName: ev.domain, price: String(ev.price), offerer: ev.offerer };
              return clone;
            }
            return prev.find(o=>o.id===ev.id)? prev : [...prev, { id: ev.id, domainName: ev.domain, price: String(ev.price), offerer: ev.offerer }];
          });
        }
        if (ev.type === 'offer_cancelled') {
          setOffers(prev => prev.filter(o => o.id !== ev.id));
          setMyOffers(prev => prev.filter(o => o.id !== ev.id));
        }
        if (ev.type === 'offer_accepted') {
          setOffers(prev => prev.filter(o => o.id !== ev.id));
          setMyOffers(prev => prev.filter(o => o.id !== ev.id));
        }
      }
    }
  );

  const {
    createOrder,
    buyDomain,
    cancelOrder,
    hash: marketplaceHash,
    isPending: marketplacePending
  } = useDomainMarketplace();

  const { isSuccess: txSuccess } = useTransactionConfirmation(marketplaceHash);

  // Mock data for demonstration - in production, this would come from the smart contracts
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai';
  const refreshListings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/listings`);
      if (!res.ok) return;
      const data = await res.json();
      // orderfeed returns Listing objects created_at, etc.; normalize
      const mapped: Order[] = data.filter((l: any) => l.active !== false).map((l: any) => ({
        id: l.id,
        seller: l.seller,
        domainName: l.domain,
        price: String(l.price),
        contract: l.contract || '',
        tokenId: l.token_id || ''
      }));
      setOrders(mapped);
      if (walletAddress) setUserOrders(mapped.filter(o => o.seller?.toLowerCase() === walletAddress.toLowerCase()));
      setGap(false);
    } catch (e) {
      // ignore
    }
  };

  const incrementalBackfill = async (lastSeq: number) => {
    try {
      const [lRes, oRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/listings?since_seq=${lastSeq}`),
        fetch(`${API_BASE}/api/v1/offers?since_seq=${lastSeq}`)
      ]);
      if (lRes.ok) {
        const lData = await lRes.json();
        if (Array.isArray(lData) && lData.length>0) {
          setOrders(prev => {
            const existingIds = new Set(prev.map(p=>p.id));
            const merged = [...prev];
            for (const l of lData) {
              if (!existingIds.has(l.id) && l.active !== false) {
                merged.push({ id: l.id, seller: l.seller, domainName: l.domain, price: String(l.price), contract: l.contract||'', tokenId: l.token_id||'' });
              }
            }
            return merged;
          });
        }
      }
      if (oRes.ok) {
        const oData = await oRes.json();
        if (Array.isArray(oData) && oData.length>0) {
          setOffers(prev => {
            const existingIds = new Set(prev.map(p=>p.id));
            const merged = [...prev];
            for (const o of oData) {
              if (!existingIds.has(o.id) && o.active !== false) {
                merged.push({ id: o.id, offerer: o.offerer, domainName: o.domain, price: String(o.price) });
              }
            }
            return merged;
          });
        }
      }
    } catch {}
    finally {
      setGap(false);
    }
  };

  const refreshOffers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/offers`);
      if (!res.ok) return;
      const data = await res.json();
      const mapped = data.filter((o:any)=>o.active!==false).map((o:any)=>({ id:o.id, domainName:o.domain, price:String(o.price), offerer:o.offerer }));
      setOffers(mapped);
      if (walletAddress) setMyOffers(mapped.filter((o: any) => o.offerer?.toLowerCase() === walletAddress.toLowerCase()));
    } catch {}
  };

  useEffect(() => { void refreshListings(); void refreshOffers(); }, [walletAddress]);
  // Load currencies on mount (best effort)
  useEffect(()=>{
    (async()=>{
      try {
        const list: any = await getSupportedCurrencies();
        const cur = list?.currencies || [];
        if (Array.isArray(cur) && cur.length>0) setCurrencies(cur);
      } catch(e:any) {
        setCurrencyError('Currencies load failed');
      }
    })();
  }, [getSupportedCurrencies]);

  // Handle transaction success
  useEffect(() => {
    if (txSuccess) {
      alert('Transaction completed successfully!');
      // Refresh data here
      setLoading(false);
    }
  }, [txSuccess]);

  const handleCreateListing = async () => {
    if (!hasSigner) { alert('Connect wallet'); return; }
    if (!createForm.contract || !createForm.tokenId || !createForm.priceEth) return;
    setCreating(true);
    try {
      const wei = viemParseUnits(createForm.priceEth, 18).toString();
  const tempId = 'temp-' + Date.now();
  setOrders(o => [...o, { id: tempId, seller: walletAddress || 'me', domainName: `${createForm.tokenId}.${createForm.contract.slice(2,8)}`, price: createForm.priceEth, contract: createForm.contract, tokenId: createForm.tokenId }]);
  pendingOptimistic.current[tempId] = { type: 'listing', timeout: setTimeout(()=>{ delete pendingOptimistic.current[tempId]; setOrders(os=> os.filter(x=> x.id!==tempId)); pushToast('Listing not confirmed','warn'); }, 30000)};
      await createListing({ contract: createForm.contract, tokenId: createForm.tokenId, price: wei }, (step, prog) => {
        setOpProgress({ step, pct: prog, label: 'Creating Listing' });
      });
      await refreshListings();
      setCreateForm({ contract: '', tokenId: '', priceEth: '' });
    } catch (e) {
      console.error(e);
      alert('Listing failed');
    } finally {
  setCreating(false);
  setTimeout(()=> setOpProgress(null), 1200);
    }
  };

  const handleCreateOffer = async () => {
    if (!hasSigner) { alert('Connect wallet'); return; }
    if (!offerForm.contract || !offerForm.tokenId || !offerForm.priceEth) return;
    setCreating(true);
    try {
  const selected = currencies.find(c=> c.symbol===offerForm.currency);
  const decimals = selected?.decimals ?? 18;
  const wei = viemParseUnits(offerForm.priceEth, decimals).toString();
      const tempId = 'temp-offer-' + Date.now();
      setOffers(o => [...o, { id: tempId, offerer: walletAddress || 'me', domainName: `${offerForm.tokenId}.${offerForm.contract.slice(2,8)}`, price: offerForm.priceEth }]);
      const currencyContract = currencies.find(c=>c.symbol===offerForm.currency)?.contractAddress;
      await createOffer({ contract: offerForm.contract, tokenId: offerForm.tokenId, price: wei, currencyContractAddress: currencyContract }, (step, prog) => {
        setOpProgress({ step, pct: prog, label: 'Creating Offer' });
      });
      await refreshOffers();
      setOfferForm({ contract:'', tokenId:'', priceEth:'', currency: offerForm.currency });
  try { localStorage.setItem('offer_currency', offerForm.currency); } catch {}
    } catch (e) {
      console.error(e);
      alert('Offer failed');
    } finally {
  setCreating(false);
  setTimeout(()=> setOpProgress(null), 1200);
    }
  };

  const handleCancelOffer = async (offerId: string) => {
    try {
      setOffers(os=>os.filter(o=>o.id!==offerId));
      setMyOffers(os=>os.filter(o=>o.id!==offerId));
  await cancelOffer(offerId, (s,p)=> setOpProgress({ step: s, pct: p, label: 'Cancelling Offer' }));
      await refreshOffers();
    } catch(e) { console.error(e); alert('Cancel failed'); }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      setOffers(os=>os.filter(o=>o.id!==offerId));
  await acceptOffer(offerId, (s,p)=> setOpProgress({ step: s, pct: p, label: 'Accepting Offer' }));
      await refreshOffers();
    } catch(e) { console.error(e); alert('Accept failed'); }
  };

  const handleBuyDomain = async (orderId: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      // optimistic remove from orders list
  setOrders(os => os.filter(o => o.id !== orderId));
  pendingOptimistic.current[orderId] = { type: 'buy', timeout: setTimeout(()=>{ delete pendingOptimistic.current[orderId]; pushToast('Purchase not confirmed','warn'); }, 30000)};
  await buyListing(orderId, address, (step, prog)=> setOpProgress({ step, pct: prog, label: 'Buying Listing' }));
  // inject provisional fill event for UI continuity if authoritative is slow
  setTimeout(()=>{
    if(pendingOptimistic.current[orderId]){
      try { pushEvent({ type:'listing_filled', id: orderId, _optimistic:true } as any); } catch {}
    }
  }, 1200);
  await refreshListings();
    } catch (error) {
      console.error('Error buying domain:', error);
      alert('Failed to purchase domain');
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
  setOrders(os => os.filter(o => o.id !== orderId));
  setUserOrders(os => os.filter(o => o.id !== orderId));
  pendingOptimistic.current[orderId] = { type: 'cancel', timeout: setTimeout(()=>{ delete pendingOptimistic.current[orderId]; pushToast('Cancel not confirmed','warn'); }, 15000)};
  await cancelListing(orderId, (step, prog)=> setOpProgress({ step, pct: prog, label: 'Cancelling Listing' }));
  await refreshListings();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order');
      setLoading(false);
    }
  };

  if (!mounted) {
    return <div className="glass-dark rounded-xl p-10 text-center border border-white/10 text-slate-500 text-sm">Initializing trading interface…</div>;
  }

  if (!isActive) {
    return (
      <div className="glass-dark rounded-xl p-10 text-center border border-white/10">
        <h3 className="text-xl font-semibold mb-3 tracking-tight">Trading Not Available</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">Trading unlocks only while the competition is active. Return once the start time threshold has been met.</p>
      </div>
    );
  }

  return (
    <div className="glass-dark rounded-xl border border-white/10 overflow-hidden">
      <div className="flex gap-1 px-3 pt-3">
        {([
          {key:'market', label:'Market'},
          {key:'portfolio', label:'My Portfolio'},
          {key:'orders', label:'My Orders'},
          {key:'offers', label:'Offers'}
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={()=>setActiveTab(t.key)}
            className={`relative px-4 py-2 text-xs font-medium tracking-wide rounded-md transition-colors ${activeTab===t.key ? 'bg-brand-500/20 text-brand-200 shadow-inner':'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            {t.label}
            {activeTab===t.key && <span className="absolute inset-0 rounded-md ring-1 ring-inset ring-brand-400/40" />}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-2">
          <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse':'bg-slate-500'}`} />
          <span className="text-[10px] uppercase tracking-wide text-slate-500">RT</span>
        </div>
      </div>
      <div className="p-6 md:p-8">
        {toasts.length>0 && (
          <div className="fixed z-40 bottom-4 right-4 space-y-2 w-64">
            {toasts.map(t=> (
              <div key={t.id} className={`text-[11px] px-3 py-2 rounded-md shadow border ${t.level==='warn'? 'bg-amber-500/15 border-amber-400/40 text-amber-200':'bg-slate-700/70 border-slate-600/60 text-slate-200'}`}>{t.msg}</div>
            ))}
          </div>
        )}
        {opProgress && (
          <div className="mb-4 flex items-center gap-3 text-[10px] tracking-wide uppercase text-slate-400">
            <div className="flex-1 h-1 bg-slate-700/40 rounded overflow-hidden">
              <div className="h-full bg-brand-500/60" style={{width: `${Math.min(100, Math.max(0, opProgress.pct))}%`}} />
            </div>
            <span className="text-slate-300">{opProgress.label}: {opProgress.step} {opProgress.pct}%</span>
          </div>
        )}
        {gap && (
          <div className="mb-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 flex items-center justify-between">
            <span>Real-time gap detected. Data refreshed.</span>
            <button onClick={()=>void refreshListings()} className="underline decoration-dotted">Refresh again</button>
          </div>
        )}
        {activeTab === 'market' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Available Domains</h3>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Live Listings</div>
            </div>
            <div className="surface rounded-lg p-4 grid gap-3 md:grid-cols-5 items-end">
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Contract</label>
                <input value={createForm.contract} onChange={e=>setCreateForm(f=>({...f, contract:e.target.value}))} placeholder="0x..." className="w-full bg-white/5 text-xs rounded px-2 py-2 outline-none focus:ring-1 ring-brand-400/40" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Token ID</label>
                <input value={createForm.tokenId} onChange={e=>setCreateForm(f=>({...f, tokenId:e.target.value}))} placeholder="123" className="w-full bg-white/5 text-xs rounded px-2 py-2 outline-none focus:ring-1 ring-brand-400/40" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Price (ETH)</label>
                <input value={createForm.priceEth} onChange={e=>setCreateForm(f=>({...f, priceEth:e.target.value}))} placeholder="0.05" className="w-full bg-white/5 text-xs rounded px-2 py-2 outline-none focus:ring-1 ring-brand-400/40" />
              </div>
              <div>
                <button
                  onClick={handleCreateListing}
                  disabled={creating || !hasSigner || !createForm.contract || !createForm.tokenId || !createForm.priceEth}
                  className="w-full text-xs px-3 py-2 rounded-md bg-brand-500/20 hover:bg-brand-500/30 text-brand-200 disabled:opacity-40"
                >{creating ? 'Creating…' : 'Create Listing'}</button>
              </div>
            </div>
            <div className="space-y-3">
              {domains.map((domain) => (
                <div key={domain.id} className="surface rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{domain.name}</h4>
                    <p className="text-xs text-slate-400">Owner: {domain.owner}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded">${domain.price}</span>
                    {/* Legacy create order button removed (listings now via form above) */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold tracking-tight">My Domain Portfolio</h3>
            <div className="space-y-3">
              {userDomains.map((domain) => (
                <div key={domain.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{domain.name}</h4>
                    <p className="text-xs text-slate-400">Value: ${domain.price}</p>
                  </div>
                  <button className="text-xs px-3 py-2 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300">List for Sale</button>
                </div>
              ))}
              {userDomains.length === 0 && (<p className="text-slate-500 text-center py-12 text-sm">No domains in your portfolio yet.</p>)}
            </div>
          </div>
        )}
        {activeTab === 'orders' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold tracking-tight mb-4">My Active Listings</h3>
              <div className="space-y-3">
                {userOrders.map((order) => (
                  <div key={order.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{order.domainName}</h4>
                      <p className="text-xs text-slate-400">Price: ${order.price}</p>
                    </div>
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={loading || marketplacePending}
                      className="text-xs px-3 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-50"
                    >
                      {loading || marketplacePending ? 'Cancelling...' : 'Cancel Order'}
                    </button>
                  </div>
                ))}
                {userOrders.length === 0 && (<p className="text-slate-500 text-center py-12 text-sm">No active orders.</p>)}
              </div>
            </div>
            <div>
              <h4 className="text-md font-semibold mb-4 tracking-tight">Marketplace Listings</h4>
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{order.domainName}</h4>
                      <p className="text-xs text-slate-400">Seller: {order.seller}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded">${order.price}</span>
                      <button
                        onClick={() => handleBuyDomain(order.id)}
                        disabled={loading || marketplacePending}
                        className="text-xs px-3 py-2 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300 disabled:opacity-50"
                      >
                        {loading || marketplacePending ? 'Buying...' : 'Buy Now'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'offers' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold tracking-tight mb-4">Create Offer</h3>
              <div className="surface rounded-lg p-4 grid gap-3 md:grid-cols-5 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Contract</label>
                  <input value={offerForm.contract} onChange={e=>setOfferForm(f=>({...f, contract:e.target.value}))} placeholder="0x..." className="w-full bg-white/5 text-xs rounded px-2 py-2 outline-none focus:ring-1 ring-brand-400/40" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Token ID</label>
                  <input value={offerForm.tokenId} onChange={e=>setOfferForm(f=>({...f, tokenId:e.target.value}))} placeholder="123" className="w-full bg-white/5 text-xs rounded px-2 py-2 outline-none focus:ring-1 ring-brand-400/40" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Price (ETH)</label>
                  <input value={offerForm.priceEth} onChange={e=>setOfferForm(f=>({...f, priceEth:e.target.value}))} placeholder="0.01" className="w-full bg-white/5 text-xs rounded px-2 py-2 outline-none focus:ring-1 ring-brand-400/40" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Currency</label>
                  <select value={offerForm.currency} onChange={e=> setOfferForm(f=> ({...f, currency: e.target.value}))} className="w-full bg-white/5 text-xs rounded px-2 py-2 outline-none focus:ring-1 ring-brand-400/40">
                    {currencies.length>0 ? currencies.map(c=> <option key={c.contractAddress} value={c.symbol}>{c.symbol}</option>) : <option value="ETH">ETH</option>}
                  </select>
                </div>
                {currencyError && <div className="text-[10px] text-red-400">{currencyError}</div>}
                <div>
                  <button
                    onClick={handleCreateOffer}
                    disabled={creating || !hasSigner || !offerForm.contract || !offerForm.tokenId || !offerForm.priceEth}
                    className="w-full text-xs px-3 py-2 rounded-md bg-brand-500/20 hover:bg-brand-500/30 text-brand-200 disabled:opacity-40"
                  >{creating ? 'Submitting…' : 'Place Offer'}</button>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-md font-semibold mb-4 tracking-tight">My Offers</h4>
              <div className="space-y-3">
                {myOffers.map(o => (
                  <div key={o.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{o.domainName}</h4>
                      <p className="text-xs text-slate-400">Offer: {o.price} ETH</p>
                    </div>
                    <button onClick={()=>handleCancelOffer(o.id)} className="text-xs px-3 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300">Cancel</button>
                  </div>
                ))}
                {myOffers.length === 0 && (<p className="text-slate-500 text-center py-8 text-sm">No active offers.</p>)}
              </div>
            </div>
            <div>
              <h4 className="text-md font-semibold mb-4 tracking-tight">All Offers</h4>
              <div className="space-y-3">
                {offers.map(o => (
                  <div key={o.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{o.domainName}</h4>
                      <p className="text-xs text-slate-400">From: {o.offerer}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">{o.price} ETH</span>
                      <button onClick={()=>handleAcceptOffer(o.id)} className="text-xs px-3 py-2 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300">Accept</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
