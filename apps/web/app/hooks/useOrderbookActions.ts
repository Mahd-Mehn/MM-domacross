"use client";
import { useCallback, useState } from 'react';
import { useWalletClient } from 'wagmi';
import { viemToEthersSigner, OrderbookType } from '@doma-protocol/orderbook-sdk';
import { useDomaOrderbook } from '@/app/providers/DomaOrderbookProvider';

interface ProgressState { step: string; progress: number; }

export function useCreateListing(){
  const { data: walletClient } = useWalletClient();
  const client = useDomaOrderbook();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (args: { contract: string; tokenId: string; priceWei: string; chainId?: `eip155:${number}` }) => {
    if(!client) throw new Error('SDK client not ready');
    if(!walletClient) throw new Error('Wallet not connected');
    setLoading(true); setError(null); setProgress(null);
    try {
      const chain = args.chainId || 'eip155:1';
      const signer = viemToEthersSigner(walletClient, chain);
      const res = await client.createListing({
        params: { items: [{ contract: args.contract, tokenId: args.tokenId, price: args.priceWei }], orderbook: OrderbookType.DOMA, source: 'web-app' },
        signer,
        chainId: chain,
        onProgress: (step: string, p: number) => setProgress({ step, progress: p })
      } as any);
      return res;
    } catch(e:any){
      setError(e?.message || 'Unknown error');
      throw e;
    } finally { setLoading(false); }
  }, [client, walletClient]);
  return { run, loading, progress, error };
}

export function useBuyListing(){
  const { data: walletClient } = useWalletClient();
  const client = useDomaOrderbook();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (args: { orderId: string; fulfiller?: string; chainId?: `eip155:${number}` }) => {
    if(!client) throw new Error('SDK client not ready');
    if(!walletClient) throw new Error('Wallet not connected');
    setLoading(true); setError(null); setProgress(null);
    try {
      const chain = args.chainId || 'eip155:1';
      const signer = viemToEthersSigner(walletClient, chain);
      return await client.buyListing({
        params: { orderId: args.orderId },
        signer,
        chainId: chain,
        onProgress: (step: string, p: number) => setProgress({ step, progress: p })
      } as any);
    } catch(e:any){
      setError(e?.message || 'Unknown error');
      throw e;
    } finally { setLoading(false); }
  }, [client, walletClient]);
  return { run, loading, progress, error };
}

export function useCreateOffer(){
  const { data: walletClient } = useWalletClient();
  const client = useDomaOrderbook();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (args: { contract: string; tokenId: string; priceWei: string; expiration?: number; chainId?: `eip155:${number}`; currency?: string }) => {
    if(!client) throw new Error('SDK client not ready');
    if(!walletClient) throw new Error('Wallet not connected');
    setLoading(true); setError(null); setProgress(null);
    try {
      const chain = args.chainId || 'eip155:1';
      const signer = viemToEthersSigner(walletClient, chain);
      return await client.createOffer({
        params: { items: [{ contract: args.contract, tokenId: args.tokenId, price: args.priceWei, currencyContractAddress: args.currency || '0x0000000000000000000000000000000000000000' }], orderbook: OrderbookType.DOMA, expirationTime: args.expiration, source: 'web-app' },
        signer,
        chainId: chain,
        onProgress: (step: string, p: number) => setProgress({ step, progress: p })
      } as any);
    } catch(e:any){
      setError(e?.message || 'Unknown error');
      throw e;
    } finally { setLoading(false); }
  }, [client, walletClient]);
  return { run, loading, progress, error };
}
