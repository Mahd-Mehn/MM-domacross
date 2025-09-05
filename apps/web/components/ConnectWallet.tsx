"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signIn, signOut, token, authenticating } = useAuth();

  // Auto sign-in after wallet connect if no token
  useEffect(()=>{
    if (isConnected && address && !token && !authenticating) {
      void signIn();
    }
  }, [isConnected, address, token, authenticating, signIn]);

  const handleConnect = () => { connect({ connector: injected() }); };

  const handleDisconnect = () => { disconnect(); signOut(); };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        {!token && <div className="text-xs text-amber-300">{authenticating ? 'Signing…' : 'Sign required'}</div>}
        <button
          onClick={handleDisconnect}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors text-sm"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
  {isPending ? (authenticating ? 'Signing...' : 'Connecting...') : 'Connect Wallet'}
    </button>
  );
}
