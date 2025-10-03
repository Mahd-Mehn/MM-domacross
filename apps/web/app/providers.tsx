"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { ThemeProvider } from 'next-themes';
import { AlertProvider } from '../components/ui/Alert';
import { ToastProvider } from '../components/ToastProvider';
import { AuthProvider } from "../components/AuthProvider";
import { DomaOrderbookProvider } from './providers/DomaOrderbookProvider';
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import type { ReactNode } from "react";
import { getCurrentNetwork } from "../lib/config";

// Define Doma testnet chain
const domaTestnet = {
  id: getCurrentNetwork().chainId,
  name: getCurrentNetwork().name,
  network: 'doma-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Doma',
    symbol: 'DOMA',
  },
  rpcUrls: {
    default: {
      http: [getCurrentNetwork().rpcUrl || 'http://127.0.0.1:8545'],
    },
    public: {
      http: [getCurrentNetwork().rpcUrl || 'http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Doma Explorer',
      url: getCurrentNetwork().blockExplorer,
    },
  },
  testnet: true,
} as const;

const config = createConfig({
  chains: [mainnet, sepolia, domaTestnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [domaTestnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AlertProvider>
          <ToastProvider>
            <AuthProvider>
              <DomaOrderbookProvider>
                {children}
              </DomaOrderbookProvider>
            </AuthProvider>
          </ToastProvider>
        </AlertProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
