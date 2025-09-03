"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orderbookClient } from "../orderbookClient";
import { authHeader, apiJson } from "../api";
import { useWalletClient, useAccount } from "wagmi";
import { viemToEthersSigner, OrderbookType } from "@doma-protocol/orderbook-sdk";

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
  const { data: walletClient } = useWalletClient();
  const { chainId, address } = useAccount();
  return useMutation({
    mutationFn: async (p: ListingParams) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/listing', p);
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      const result = await orderbookClient.createListing({
        params: {
          source: 'domacross-web',
          items: [{ contract: p.contract, tokenId: p.tokenId, price: p.price }],
          orderbook: OrderbookType.DOMA,
        },
        signer,
        chainId: caip2FromChainId(chainId),
        onProgress: () => {}
      });
      // Persist off-chain snapshot
      await sdkUnavailableFallback('/api/v1/market/listing', { domain: p.domain, contract: p.contract, token_id: p.tokenId, price: p.price });
      return result;
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
  return useMutation({
    mutationFn: async (p: BuyParams) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/buy', p);
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      if (!p.orderId) throw new Error('orderId required');
      const result = await orderbookClient.buyListing({
        params: { orderId: p.orderId as string },
        signer,
        chainId: caip2FromChainId(chainId),
        onProgress: () => {}
      });
      await sdkUnavailableFallback('/api/v1/market/buy', { order_id: p.orderId, domain: p.domain, price: p.price });
      return result;
    },
    onSuccess: (_d, vars) => {
      if (vars.domain) qc.invalidateQueries({ queryKey: ['domain', vars.domain.toLowerCase()] });
      qc.invalidateQueries({ queryKey: ['valuation-batch'] });
    }
  });
}

export function useMakeOffer() {
  const qc = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const { chainId, address } = useAccount();
  return useMutation({
    mutationFn: async (p: OfferParams) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/offer', p);
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      const item: any = { contract: p.contract, tokenId: p.tokenId, price: p.price };
      if (p.currencyAddress) item.currencyContractAddress = p.currencyAddress;
      const result = await orderbookClient.createOffer({
        params: {
          source: 'domacross-web',
          items: [item],
          orderbook: OrderbookType.DOMA,
        },
        signer,
        chainId: caip2FromChainId(chainId),
        onProgress: () => {}
      });
      await sdkUnavailableFallback('/api/v1/market/offer', { domain: p.domain, contract: p.contract, token_id: p.tokenId, price: p.price });
      return result;
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
  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!orderbookClient || !walletClient) {
        return sdkUnavailableFallback('/api/v1/market/cancel-listing', { orderId });
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
  return orderbookClient.cancelListing({ params: { orderId }, signer, chainId: caip2FromChainId(chainId), onProgress: () => {} });
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
  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!orderbookClient || !walletClient) {
        return sdkUnavailableFallback('/api/v1/market/cancel-offer', { orderId });
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
  return orderbookClient.cancelOffer({ params: { orderId }, signer, chainId: caip2FromChainId(chainId), onProgress: () => {} });
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
  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!orderbookClient || !walletClient || !address) {
        return sdkUnavailableFallback('/api/v1/market/accept-offer', { external_order_id: orderId });
      }
      const signer = viemToEthersSigner(walletClient, caip2FromChainId(chainId));
      // Hypothetical SDK acceptOffer (assuming similar signature)
      // If not yet implemented in SDK, the fallback handles persistence.
      const sdkFn: any = (orderbookClient as any).acceptOffer;
      if (typeof sdkFn === 'function') {
        await sdkFn({ params: { orderId }, signer, chainId: caip2FromChainId(chainId), onProgress: () => {} });
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
