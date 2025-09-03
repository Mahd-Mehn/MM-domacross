"use client";

import { useState } from 'react';

interface Strategy {
  id: string;
  name: string;
  description: string;
  author: string;
  performance: number;
}

export default function StrategySharing() {
  const [strategies, setStrategies] = useState<Strategy[]>([
    { id: '1', name: 'High Volume Trader', description: 'Focus on high-volume domains', author: 'Alice', performance: 15.5 },
    { id: '2', name: 'Long-term Hold', description: 'Buy and hold premium domains', author: 'Bob', performance: 8.2 },
  ]);

  const [newStrategy, setNewStrategy] = useState({ name: '', description: '' });

  const handleShare = () => {
    // Logic to share strategy
    const strategy: Strategy = {
      id: Date.now().toString(),
      name: newStrategy.name,
      description: newStrategy.description,
      author: 'Current User',
      performance: 0,
    };
    setStrategies([...strategies, strategy]);
    setNewStrategy({ name: '', description: '' });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Strategy Sharing</h2>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Share Your Strategy</h3>
        <input
          type="text"
          placeholder="Strategy Name"
          value={newStrategy.name}
          onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
          className="w-full p-2 border rounded mb-2"
        />
        <textarea
          placeholder="Strategy Description"
          value={newStrategy.description}
          onChange={(e) => setNewStrategy({ ...newStrategy, description: e.target.value })}
          className="w-full p-2 border rounded mb-2"
          rows={3}
        />
        <button onClick={handleShare} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Share Strategy
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Community Strategies</h3>
        <div className="space-y-4">
          {strategies.map(strategy => (
            <div key={strategy.id} className="bg-white p-4 rounded-lg shadow">
              <h4 className="font-semibold">{strategy.name}</h4>
              <p className="text-gray-600">{strategy.description}</p>
              <p className="text-sm text-gray-500">By {strategy.author} | Performance: {strategy.performance}%</p>
              <button className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                Adopt Strategy
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
