"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from 'react';
import { orderbookClient } from "../orderbookClient";
import { authHeader, apiJson } from "../api";
import { useWalletClient, useAccount } from "wagmi";
import { viemToEthersSigner, OrderbookType } from "@doma-protocol/orderbook-sdk";
import { useToasts } from "../../components/ToastProvider";

interface BuyParams { orderId?: string; domain?: string; price?: string; }
interface OfferParams { domain: string; contract: string; tokenId: string; price: string; currencyAddress?: string; expirationSeconds?: number; }
interface ListingParams { domain: string; contract: string; tokenId: string; price: string; }

// Default chain (CAIP-2) derive from wallet if not provided
type Caip2 = `eip155:${number}`;
function caip2FromChainId(id?: number): Caip2 { return (`eip155:${id ?? 1}`) as Caip2; }

// Decide execution path: prefer SDK if available, else fallback to API (to be implemented server-side later)
async function sdkUnavailableFallback(path: string, payload: any) {
  return apiJson(path, { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function useCreateListing() {
  const qc = useQueryClient();
  const seqRef = useRef(0);
  const { data: walletClient } = useWalletClient();
  const { chainId, address } = useAccount();
  const toasts = useToasts();
  return useMutation({
    mutationFn: async (p: ListingParams) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/listing', p);
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      const toastId = toasts.push('Creating listing', 'progress', { progress: 5 });
  const result = await orderbookClient.createListing({
        params: {
          source: 'domacross-web',
          items: [{ contract: p.contract, tokenId: p.tokenId, price: p.price }],
          orderbook: OrderbookType.DOMA,
        },
        signer,
        chainId: caip2FromChainId(chainId),
        onProgress: (...args: any[]) => {
          const step = args[0];
          const progress = typeof args[1] === 'number' ? args[1] : 0;
          toasts.updateProgress(toastId, progress, `Listing: ${step}`);
        },
      });
      // Persist off-chain snapshot
  const extId = (result as any)?.orderId || (result as any)?.id;
  await sdkUnavailableFallback('/api/v1/market/listing', { domain: p.domain, contract: p.contract, token_id: p.tokenId, price: p.price, external_order_id: extId });
      toasts.success(toastId, 'Listing created');
      return result;
    },
    onMutate: async (vars) => {
      const key = ['domain', vars.domain.toLowerCase()];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<any>(key);
      if (prev?.domain) {
        qc.setQueryData(key, {
          ...prev,
          listings: [
            { id: ++seqRef.current, price: vars.price, seller: 'you', optimistic: true },
            ...(prev.listings || [])
          ]
        });
      }
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['domain', vars.domain.toLowerCase()], ctx.prev);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['domain', vars.domain.toLowerCase()] });
      qc.invalidateQueries({ queryKey: ['valuation-batch'] });
    }
  });
}

export function useBuyDomain() {
  const qc = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const { chainId, address } = useAccount();
  const toasts = useToasts();
  return useMutation({
    mutationFn: async (p: BuyParams) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/buy', p);
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      if (!p.orderId) throw new Error('orderId required');
      const toastId = toasts.push('Buying listing', 'progress', { progress: 5 });
      const result = await orderbookClient.buyListing({
        params: { orderId: p.orderId as string },
        signer,
        chainId: caip2FromChainId(chainId),
        onProgress: (...args: any[]) => {
          const step = args[0];
          const progress = typeof args[1] === 'number' ? args[1] : 0;
          toasts.updateProgress(toastId, progress, `Buy: ${step}`);
        }
      });
      await sdkUnavailableFallback('/api/v1/market/buy', { order_id: p.orderId, domain: p.domain, price: p.price });
      toasts.success(toastId, 'Purchase complete');
      return result;
    },
    onSuccess: (_d, vars) => {
      if (vars.domain) qc.invalidateQueries({ queryKey: ['domain', vars.domain.toLowerCase()] });
      qc.invalidateQueries({ queryKey: ['valuation-batch'] });
    }
  });
}

// Persist-only hook to store completed buy operations without executing on-chain
export function usePersistBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { orderId: string; domain?: string; price?: string }) => {
      return apiJson('/api/v1/market/buy', {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: p.orderId, domain: p.domain, price: p.price })
      });
    },
    onSuccess: (_d, vars) => {
      if (vars.domain) {
        const lower = vars.domain.toLowerCase();
        qc.invalidateQueries({ queryKey: ['domain', lower] });
      }
      qc.invalidateQueries({ queryKey: ['valuation-batch'] });
    }
  });
}

export function useMakeOffer() {
  const qc = useQueryClient();
  const offerSeqRef = useRef(0);
  const { data: walletClient } = useWalletClient();
  const { chainId, address } = useAccount();
  const toasts = useToasts();
  return useMutation({
    mutationFn: async (p: OfferParams) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/offer', p);
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      const item: any = { contract: p.contract, tokenId: p.tokenId, price: p.price };
      if (p.currencyAddress) item.currencyContractAddress = p.currencyAddress;
      const toastId = toasts.push('Creating offer', 'progress', { progress: 5 });
  const result = await orderbookClient.createOffer({
        params: {
          source: 'domacross-web',
          items: [item],
          orderbook: OrderbookType.DOMA,
        },
        signer,
        chainId: caip2FromChainId(chainId),
        onProgress: (...args: any[]) => {
          const step = args[0];
          const progress = typeof args[1] === 'number' ? args[1] : 0;
          toasts.updateProgress(toastId, progress, `Offer: ${step}`);
        }
      });
  const extId = (result as any)?.orderId || (result as any)?.id;
  await sdkUnavailableFallback('/api/v1/market/offer', { domain: p.domain, contract: p.contract, token_id: p.tokenId, price: p.price, external_order_id: extId });
      toasts.success(toastId, 'Offer created');
      return result;
    },
    onMutate: async (vars) => {
      const key = ['domain', vars.domain.toLowerCase()];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<any>(key);
      if (prev?.domain) {
        qc.setQueryData(key, {
          ...prev,
          offers: [
            { id: ++offerSeqRef.current, price: vars.price, buyer: 'you', optimistic: true },
            ...(prev.offers || [])
          ]
        });
      }
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['domain', vars.domain.toLowerCase()], ctx.prev);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['domain', vars.domain.toLowerCase()] });
      qc.invalidateQueries({ queryKey: ['valuation-batch'] });
    }
  });
}

export function useCancelListing() {
  const qc = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const { chainId } = useAccount();
  const toasts = useToasts();
  return useMutation({
  mutationFn: async (orderId: string) => {
      if (!orderbookClient || !walletClient) {
        return sdkUnavailableFallback('/api/v1/market/cancel-listing', { orderId });
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      const toastId = toasts.push('Cancelling listing', 'progress', { progress: 10 });
      const r = await orderbookClient.cancelListing({ params: { orderId }, signer, chainId: caip2FromChainId(chainId), onProgress: (...args: any[]) => {
        const step = args[0];
        const progress = typeof args[1] === 'number' ? args[1] : 0;
        toasts.updateProgress(toastId, progress, `Cancel: ${step}`);
      } });
      toasts.success(toastId, 'Listing cancelled');
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domain'] });
    }
  });
}

export function useCancelOffer() {
  const qc = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const { chainId } = useAccount();
  const toasts = useToasts();
  return useMutation({
  mutationFn: async (orderId: string) => {
      if (!orderbookClient || !walletClient) {
        return sdkUnavailableFallback('/api/v1/market/cancel-offer', { orderId });
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      const toastId = toasts.push('Cancelling offer', 'progress', { progress: 10 });
      const r = await orderbookClient.cancelOffer({ params: { orderId }, signer, chainId: caip2FromChainId(chainId), onProgress: (...args: any[]) => {
        const step = args[0];
        const progress = typeof args[1] === 'number' ? args[1] : 0;
        toasts.updateProgress(toastId, progress, `Cancel: ${step}`);
      } });
      toasts.success(toastId, 'Offer cancelled');
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domain'] });
    }
  });
}

export function useAcceptOffer() {
  const qc = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const { chainId, address } = useAccount();
  const toasts = useToasts();
  return useMutation({
  mutationFn: async (orderId: string) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/accept-offer', { external_order_id: orderId });
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      if ((orderbookClient as any).acceptOffer) {
        const toastId = toasts.push('Accepting offer', 'progress', { progress: 5 });
        await (orderbookClient as any).acceptOffer({ params: { orderId }, signer, chainId: caip2FromChainId(chainId), onProgress: (...args: any[]) => {
          const step = args[0];
          const progress = typeof args[1] === 'number' ? args[1] : 0;
          toasts.updateProgress(toastId, progress, `Accept: ${step}`);
        } });
        toasts.success(toastId, 'Offer accepted');
      }
      await sdkUnavailableFallback('/api/v1/market/accept-offer', { external_order_id: orderId });
      return { orderId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domain'] });
      qc.invalidateQueries({ queryKey: ['valuation-batch'] });
    }
  });
}

// --- Competition Settlement Hooks ---

interface DistributionItem { address: string; amount: string; }

export function useSubmitCompetitionSettlement() {
  return useMutation({
    mutationFn: async (p: { competitionId: number; txHash: string; distribution?: DistributionItem[] }) => {
      return apiJson(`/api/v1/settlement/competitions/${p.competitionId}/submit`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: p.txHash, distribution: p.distribution })
      });
    }
  });
}

export function useVerifyCompetitionSettlement() {
  return useMutation({
    mutationFn: async (p: { competitionId: number; txHash?: string }) => {
      const params = p.txHash ? `?tx_hash=${encodeURIComponent(p.txHash)}` : '';
      return apiJson(`/api/v1/settlement/competitions/${p.competitionId}/verify${params}`, {
        method: 'POST',
        headers: { ...authHeader() }
      });
    }
  });
}
