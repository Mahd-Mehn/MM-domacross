"use client";

import dynamic from 'next/dynamic';

// Client-only wallet connect to avoid SSR markup divergence
const ConnectWallet = dynamic(() => import('./ConnectWallet'), { 
  ssr: false,
  loading: () => (
    <div className="px-4 py-2 bg-slate-800 text-slate-400 rounded-lg animate-pulse">
      Wallet...
    </div>
  )
});

export default ConnectWallet;
