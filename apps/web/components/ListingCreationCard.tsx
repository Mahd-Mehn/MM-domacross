"use client";
import { useState } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { viemToEthersSigner, OrderbookType, createDomaOrderbookClient } from '@doma-protocol/orderbook-sdk';

// Ensure client singleton (simplified)
let _init = false; let _client: any;
function getClient(){
  if(!_init){
    const apiKey = process.env.NEXT_PUBLIC_DOMA_API_KEY;
    _client = createDomaOrderbookClient({ 
      apiClientOptions: { 
        baseUrl: process.env.NEXT_PUBLIC_DOMA_API_URL || 'https://api.doma.xyz',
        defaultHeaders: apiKey ? {
          'Api-Key': apiKey
        } : undefined
      }
    } as any);
    _init = true;
  }
  return _client;
}

interface Props { onCreated?: (id:string)=>void; compact?: boolean }

export function ListingCreationCard({ onCreated, compact }: Props){
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [contract,setContract]=useState('');
  const [tokenId,setTokenId]=useState('');
  const [priceEth,setPriceEth]=useState('');
  const [progress,setProgress]=useState<string>('');
  const [fee,setFee]=useState<string>('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|undefined>();
  const client = getClient();

  async function estimateFee(){
    if(!contract) return;
    try {
  const resp = await client.getOrderbookFee({ contractAddress: contract, orderbook: OrderbookType.DOMA, chainId: 'eip155:1' });
      const bp = resp?.marketplaceFees?.[0]?.basisPoints;
      if(bp) setFee((Number(bp)/100).toFixed(2)+"%"); else setFee('—');
    } catch { setFee('—'); }
  }

  async function submit(){
    if(!walletClient || !address){ setError('Connect wallet'); return; }
    if(!contract || !tokenId || !priceEth){ setError('Fill all fields'); return; }
    setError(undefined); setLoading(true); setProgress('init');
    try {
      const signer = viemToEthersSigner(walletClient,'eip155:1');
      const wei = (BigInt(Math.floor(parseFloat(priceEth)*1e6))* (10n**12n)).toString();
      const res = await client.createListing({
        params:{ items:[{ contract, tokenId, price: wei }], orderbook: OrderbookType.DOMA },
        signer,
        chainId:'eip155:1',
  onProgress:(step:string, pct:number)=> setProgress(`${step} ${pct}%`)
      });
      const orderId = (res as any)?.orderId || (res as any)?.id || 'unknown';
      setProgress('created');
      onCreated?.(orderId);
      setContract(''); setTokenId(''); setPriceEth('');
      setTimeout(()=> setProgress(''), 2500);
    } catch(e:any){ setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/60 p-4 space-y-3 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold tracking-tight">Quick Create Listing</h4>
        {fee && <span className="text-[10px] text-slate-500">Fee {fee}</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <input value={contract} onChange={e=>setContract(e.target.value)} onBlur={estimateFee} placeholder="Contract 0x.." className="text-xs px-2 py-2 rounded bg-slate-900/5 dark:bg-slate-900/40 border border-slate-300/60 dark:border-slate-600/60 outline-none focus:ring-1 ring-brand-400/40" />
        <input value={tokenId} onChange={e=>setTokenId(e.target.value)} placeholder="Token ID" className="text-xs px-2 py-2 rounded bg-slate-900/5 dark:bg-slate-900/40 border border-slate-300/60 dark:border-slate-600/60 outline-none focus:ring-1 ring-brand-400/40" />
        <input value={priceEth} onChange={e=>setPriceEth(e.target.value)} placeholder="Price (ETH)" className="text-xs px-2 py-2 rounded bg-slate-900/5 dark:bg-slate-900/40 border border-slate-300/60 dark:border-slate-600/60 outline-none focus:ring-1 ring-brand-400/40" />
        <button onClick={submit} disabled={loading || !walletClient} className="text-xs font-medium px-3 py-2 rounded bg-brand-500/20 hover:bg-brand-500/30 text-brand-200 disabled:opacity-40">{loading? 'Submitting…':'List'}</button>
      </div>
      {(progress || error) && <div className="text-[11px] flex items-center gap-3">
        {progress && <span className="text-slate-500">{progress}</span>}
        {error && <span className="text-red-400">{error}</span>}
      </div>}
    </div>
  );
}
