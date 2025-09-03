"use client";

import { useState } from 'react';

const chains = [
  { id: 1, name: 'Ethereum', rpc: 'https://mainnet.infura.io/v3/YOUR_KEY' },
  { id: 137, name: 'Polygon', rpc: 'https://polygon-rpc.com' },
  // Add more chains
];

export default function ChainSelector({ onChainSelect }: { onChainSelect: (chain: any) => void }) {
  const [selectedChain, setSelectedChain] = useState(chains[0]);

  const handleSelect = (chain: any) => {
    setSelectedChain(chain);
    onChainSelect(chain);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">Select Chain</label>
      <select
        value={selectedChain.id}
        onChange={(e) => {
          const chain = chains.find(c => c.id === parseInt(e.target.value));
          if (chain) handleSelect(chain);
        }}
        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
      >
        {chains.map(chain => (
          <option key={chain.id} value={chain.id}>{chain.name}</option>
        ))}
      </select>
    </div>
  );
}
