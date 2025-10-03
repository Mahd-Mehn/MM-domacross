"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount } from 'wagmi';

interface XMTPContextType {
  client: any | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const XMTPContext = createContext<XMTPContextType | undefined>(undefined);

export function XMTPProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { address, isConnected: isWalletConnected } = useAccount();

  const connect = async () => {
    if (!isWalletConnected || !address) {
      console.log('Wallet not connected');
      return;
    }

    try {
      // XMTP client initialization would go here
      // For now, we'll just simulate a connection
      console.log('XMTP connecting...');
      setIsConnected(true);
      setClient({ address }); // Mock client
    } catch (error) {
      console.error('Failed to connect to XMTP:', error);
    }
  };

  const disconnect = () => {
    setClient(null);
    setIsConnected(false);
  };

  useEffect(() => {
    if (!isWalletConnected) {
      disconnect();
    }
  }, [isWalletConnected]);

  const value = {
    client,
    isConnected,
    connect,
    disconnect,
  };

  return (
    <XMTPContext.Provider value={value}>
      {children}
    </XMTPContext.Provider>
  );
}

export function useXMTP() {
  const context = useContext(XMTPContext);
  if (context === undefined) {
    throw new Error('useXMTP must be used within an XMTPProvider');
  }
  return context;
}
