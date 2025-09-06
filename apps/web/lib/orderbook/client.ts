import {
  createDomaOrderbookClient,
  getDomaOrderbookClient,
  OrderbookType,
  viemToEthersSigner,
  type CreateListingResult,
  type CancelListingResult,
  type BuyListingResult,
  type CreateOfferResult,
  type AcceptOfferResult,
  type CancelOfferResult,
  type GetOrderbookFeeResponse,
  type GetSupportedCurrenciesResponse
} from '@doma-protocol/orderbook-sdk';
import { useWalletClient, useAccount } from 'wagmi';
import { useMemo } from 'react';

// Lazy singleton init (SSR safe guard)
let _inited = false;
export function ensureOrderbookClient() {
  if (!_inited) {
    createDomaOrderbookClient({
      apiClientOptions: {
        baseUrl: process.env.NEXT_PUBLIC_DOMA_API_URL || 'https://api.doma.xyz'
      }
    } as any);
    _inited = true;
  }
  return getDomaOrderbookClient();
}

export interface ListingInputItem {
  contract: string;
  tokenId: string;
  price: string; // wei or raw units expected by SDK
  currencyContractAddress?: string; // optional for offers
}

export function useOrderbookSdk() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const client = ensureOrderbookClient();

  return useMemo(() => ({
    address,
    hasSigner: !!walletClient && !!address,
  createListing: async (item: ListingInputItem, onProgress?: (s:string,p:number)=>void): Promise<CreateListingResult> => {
      if (!walletClient || !address) throw new Error('NO_SIGNER');
      const signer = viemToEthersSigner(walletClient, 'eip155:1');
      const progressWrapper: any = (...args: any[]) => {
        if (onProgress) onProgress(args[0], args[1]);
      };
      return client.createListing({
        params: { items: [item], orderbook: OrderbookType.DOMA, source: 'app' } as any,
        signer: signer as any,
        chainId: 'eip155:1',
        onProgress: progressWrapper
      } as any);
    },
  cancelListing: async (orderId: string, onProgress?: (s:string,p:number)=>void): Promise<CancelListingResult> => {
      if (!walletClient || !address) throw new Error('NO_SIGNER');
      const signer = viemToEthersSigner(walletClient, 'eip155:1');
      const progressWrapper: any = (...args: any[]) => { if (onProgress) onProgress(args[0], args[1]); };
      return client.cancelListing({
        params: { orderId } as any,
        signer: signer as any,
        chainId: 'eip155:1',
        onProgress: progressWrapper
      } as any);
    },
  buyListing: async (orderId: string, fulfiller?: string, onProgress?: (s:string,p:number)=>void): Promise<BuyListingResult> => {
      if (!walletClient || !address) throw new Error('NO_SIGNER');
      const signer = viemToEthersSigner(walletClient, 'eip155:1');
      const progressWrapper: any = (...args: any[]) => { if (onProgress) onProgress(args[0], args[1]); };
      return client.buyListing({
        params: { orderId, fulFillerAddress: fulfiller || address } as any,
        signer: signer as any,
        chainId: 'eip155:1',
        onProgress: progressWrapper
      } as any);
    },
  createOffer: async (item: ListingInputItem, onProgress?: (s:string,p:number)=>void): Promise<CreateOfferResult> => {
      if (!walletClient || !address) throw new Error('NO_SIGNER');
      const signer = viemToEthersSigner(walletClient, 'eip155:1');
      const progressWrapper: any = (...args: any[]) => { if (onProgress) onProgress(args[0], args[1]); };
      return client.createOffer({
        params: { items: [item], orderbook: OrderbookType.DOMA, expirationTime: Math.floor(Date.now()/1000)+86400 } as any,
        signer: signer as any,
        chainId: 'eip155:1',
        onProgress: progressWrapper
      } as any);
    },
  acceptOffer: async (orderId: string, onProgress?: (s:string,p:number)=>void): Promise<AcceptOfferResult> => {
      if (!walletClient || !address) throw new Error('NO_SIGNER');
      const signer = viemToEthersSigner(walletClient, 'eip155:1');
      const progressWrapper: any = (...args: any[]) => { if (onProgress) onProgress(args[0], args[1]); };
      return client.acceptOffer({
        params: { orderId } as any,
        signer: signer as any,
        chainId: 'eip155:1',
        onProgress: progressWrapper
      } as any);
    },
  cancelOffer: async (orderId: string, onProgress?: (s:string,p:number)=>void): Promise<CancelOfferResult> => {
      if (!walletClient || !address) throw new Error('NO_SIGNER');
      const signer = viemToEthersSigner(walletClient, 'eip155:1');
      const progressWrapper: any = (...args: any[]) => { if (onProgress) onProgress(args[0], args[1]); };
      return client.cancelOffer({
        params: { orderId } as any,
        signer: signer as any,
        chainId: 'eip155:1',
        onProgress: progressWrapper
      } as any);
    },
  getMarketplaceFee: async (contractAddress: string): Promise<GetOrderbookFeeResponse> => {
      return client.getOrderbookFee({ contractAddress, orderbook: OrderbookType.DOMA, chainId: 'eip155:1' });
    },
    getSupportedCurrencies: async (): Promise<GetSupportedCurrenciesResponse> => {
      return client.getSupportedCurrencies({ contractAddress: '0x0000000000000000000000000000000000000000', orderbook: OrderbookType.DOMA, chainId: 'eip155:1' });
    }
  }), [walletClient, address, client]);
}
