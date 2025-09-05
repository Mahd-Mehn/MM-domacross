"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useDomainMarketplace, useTransactionConfirmation } from "../lib/hooks/useContracts";

interface Domain {
  id: string;
  name: string;
  price: string;
  owner: string;
  contract: string;
  tokenId: string;
}

interface Order {
  id: string;
  seller: string;
  domainName: string;
  price: string;
  contract: string;
  tokenId: string;
}

interface TradingInterfaceProps {
  competitionId: string;
  isActive: boolean;
}

export default function TradingInterface({ competitionId, isActive }: TradingInterfaceProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(()=> { setMounted(true); }, []);
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'orders'>('market');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userDomains, setUserDomains] = useState<Domain[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    createOrder,
    buyDomain,
    cancelOrder,
    hash: marketplaceHash,
    isPending: marketplacePending
  } = useDomainMarketplace();

  const { isSuccess: txSuccess } = useTransactionConfirmation(marketplaceHash);

  // Mock data for demonstration - in production, this would come from the smart contracts
  useEffect(() => {
    setDomains([
      { id: '1', name: 'example.com', price: '500', owner: '0x123...', contract: '0xabc...', tokenId: '1' },
      { id: '2', name: 'test.net', price: '300', owner: '0x456...', contract: '0xdef...', tokenId: '2' },
      { id: '3', name: 'demo.org', price: '200', owner: '0x789...', contract: '0xghi...', tokenId: '3' },
    ]);

    setOrders([
      { id: '1', seller: '0x123...', domainName: 'premium.io', price: '1000', contract: '0xabc...', tokenId: '1' },
      { id: '2', seller: '0x456...', domainName: 'startup.dev', price: '750', contract: '0xdef...', tokenId: '2' },
    ]);

    setUserDomains([
      { id: '4', name: 'myportfolio.com', price: '800', owner: address || 'current_user', contract: '0xjkl...', tokenId: '4' },
    ]);
  }, [address]);

  // Handle transaction success
  useEffect(() => {
    if (txSuccess) {
      alert('Transaction completed successfully!');
      // Refresh data here
      setLoading(false);
    }
  }, [txSuccess]);

  const handleCreateOrder = async (domainId: string, price: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      const domain = domains.find(d => d.id === domainId);
      if (!domain) return;

      await createOrder(
        address,
        domain.contract,
        domain.tokenId,
        parseUnits(price.toString(), 6).toString() // USDC has 6 decimals
      );
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order');
      setLoading(false);
    }
  };

  const handleBuyDomain = async (orderId: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      await buyDomain(orderId);
    } catch (error) {
      console.error('Error buying domain:', error);
      alert('Failed to purchase domain');
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      await cancelOrder(orderId);
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order');
      setLoading(false);
    }
  };

  if (!mounted) {
    return <div className="glass-dark rounded-xl p-10 text-center border border-white/10 text-slate-500 text-sm">Initializing trading interface…</div>;
  }

  if (!isActive) {
    return (
      <div className="glass-dark rounded-xl p-10 text-center border border-white/10">
        <h3 className="text-xl font-semibold mb-3 tracking-tight">Trading Not Available</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">Trading unlocks only while the competition is active. Return once the start time threshold has been met.</p>
      </div>
    );
  }

  return (
    <div className="glass-dark rounded-xl border border-white/10 overflow-hidden">
      <div className="flex gap-1 px-3 pt-3">
        {([
          {key:'market', label:'Market'},
          {key:'portfolio', label:'My Portfolio'},
          {key:'orders', label:'My Orders'}
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={()=>setActiveTab(t.key)}
            className={`relative px-4 py-2 text-xs font-medium tracking-wide rounded-md transition-colors ${activeTab===t.key ? 'bg-brand-500/20 text-brand-200 shadow-inner':'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            {t.label}
            {activeTab===t.key && <span className="absolute inset-0 rounded-md ring-1 ring-inset ring-brand-400/40" />}
          </button>
        ))}
      </div>
      <div className="p-6 md:p-8">
        {activeTab === 'market' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Available Domains</h3>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Mock Data</div>
            </div>
            <div className="space-y-3">
              {domains.map((domain) => (
                <div key={domain.id} className="surface rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{domain.name}</h4>
                    <p className="text-xs text-slate-400">Owner: {domain.owner}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded">${domain.price}</span>
                    <button
                      onClick={() => handleCreateOrder(domain.id, domain.price)}
                      disabled={loading || marketplacePending}
                      className="text-xs px-3 py-2 rounded-md bg-brand-500/20 hover:bg-brand-500/30 text-brand-200 disabled:opacity-50"
                    >
                      {loading || marketplacePending ? 'Creating...' : 'Create Order'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold tracking-tight">My Domain Portfolio</h3>
            <div className="space-y-3">
              {userDomains.map((domain) => (
                <div key={domain.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{domain.name}</h4>
                    <p className="text-xs text-slate-400">Value: ${domain.price}</p>
                  </div>
                  <button className="text-xs px-3 py-2 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300">List for Sale</button>
                </div>
              ))}
              {userDomains.length === 0 && (<p className="text-slate-500 text-center py-12 text-sm">No domains in your portfolio yet.</p>)}
            </div>
          </div>
        )}
        {activeTab === 'orders' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold tracking-tight mb-4">My Active Orders</h3>
              <div className="space-y-3">
                {userOrders.map((order) => (
                  <div key={order.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{order.domainName}</h4>
                      <p className="text-xs text-slate-400">Price: ${order.price}</p>
                    </div>
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={loading || marketplacePending}
                      className="text-xs px-3 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-50"
                    >
                      {loading || marketplacePending ? 'Cancelling...' : 'Cancel Order'}
                    </button>
                  </div>
                ))}
                {userOrders.length === 0 && (<p className="text-slate-500 text-center py-12 text-sm">No active orders.</p>)}
              </div>
            </div>
            <div>
              <h4 className="text-md font-semibold mb-4 tracking-tight">Available Orders to Buy</h4>
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="surface rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{order.domainName}</h4>
                      <p className="text-xs text-slate-400">Seller: {order.seller}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded">${order.price}</span>
                      <button
                        onClick={() => handleBuyDomain(order.id)}
                        disabled={loading || marketplacePending}
                        className="text-xs px-3 py-2 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300 disabled:opacity-50"
                      >
                        {loading || marketplacePending ? 'Buying...' : 'Buy Now'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
