"use client";

import { useState } from 'react';

interface Trader {
  address: string;
  username: string;
  portfolioValue: number;
}

export default function CopyTrade({ trader }: { trader: Trader }) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyTrade = () => {
    setIsCopying(true);
    // Logic to copy trader's positions
    // This would integrate with wallet and contracts
    setTimeout(() => setIsCopying(false), 2000);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold">Copy {trader.username}</h3>
      <p>Portfolio: ${trader.portfolioValue}</p>
      <button
        onClick={handleCopyTrade}
        disabled={isCopying}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {isCopying ? 'Copying...' : 'Copy Trade'}
      </button>
    </div>
  );
}
