"use client";

import { useState, useRef } from 'react';

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
  const seqRef = useRef(2); // initial seeded strategies count

  const handleShare = () => {
    // Logic to share strategy
    seqRef.current += 1;
    const strategy: Strategy = {
      id: String(seqRef.current),
      name: newStrategy.name,
      description: newStrategy.description,
      author: 'Current User',
      performance: 0,
    };
    setStrategies([...strategies, strategy]);
    setNewStrategy({ name: '', description: '' });
  };

  return (
    <main className="space-y-10 max-w-5xl mx-auto px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Strategy Sharing</h1>
        <p className="text-slate-400 text-sm max-w-2xl">Publish and discover domain trading strategies. Share allocation logic & rationale; iterate as performance evolves.</p>
      </header>
      <section className="glass-dark rounded-xl p-6 border border-white/10 space-y-5">
        <h2 className="text-lg font-semibold tracking-tight">Share Your Strategy</h2>
        <div className="space-y-3 text-sm">
          <input
            type="text"
            placeholder="Strategy Name"
            value={newStrategy.name}
            onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
            className="w-full bg-slate-800/60 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 placeholder:text-slate-500"
          />
          <textarea
            placeholder="Strategy Description"
            value={newStrategy.description}
            onChange={(e) => setNewStrategy({ ...newStrategy, description: e.target.value })}
            className="w-full bg-slate-800/60 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 placeholder:text-slate-500 text-sm"
            rows={4}
          />
          <div className="flex justify-end">
            <button onClick={handleShare} disabled={!newStrategy.name || !newStrategy.description} className="text-sm px-4 py-2 rounded-md bg-gradient-to-r from-brand-500 to-accent text-white font-medium hover:from-brand-400 hover:to-accent disabled:opacity-40 disabled:cursor-not-allowed shadow-glow transition-colors">
              Share Strategy
            </button>
          </div>
        </div>
      </section>
      <section className="space-y-5">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Community Strategies</h2>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{strategies.length} Published</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {strategies.map(strategy => {
            const perfPositive = strategy.performance >= 0;
            return (
              <div key={strategy.id} className="glass-dark rounded-xl p-5 border border-white/10 flex flex-col gap-3 hover:border-brand-400/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-semibold tracking-tight text-slate-100">{strategy.name}</h3>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${perfPositive ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20' : 'bg-red-500/10 text-red-300 border border-red-400/20'}`}>{perfPositive ? '+' : ''}{strategy.performance}%</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-4 min-h-[3rem]">{strategy.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>By {strategy.author}</span>
                  <button className="px-3 py-1 rounded-md bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 text-[11px] border border-white/10">Adopt</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
