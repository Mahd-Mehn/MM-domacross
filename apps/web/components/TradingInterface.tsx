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

  if (!isActive) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-xl font-semibold mb-2">Trading Not Available</h3>
        <p className="text-gray-600">
          Trading is only available during active competition periods.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('market')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'market'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'portfolio'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Portfolio
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'orders'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Orders
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'market' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Available Domains</h3>
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold">{domain.name}</h4>
                    <p className="text-sm text-gray-600">Owner: {domain.owner}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-lg font-bold text-green-600">${domain.price}</span>
                    <button
                      onClick={() => handleCreateOrder(domain.id, domain.price)}
                      disabled={loading || marketplacePending}
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
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
          <div>
            <h3 className="text-lg font-semibold mb-4">My Domain Portfolio</h3>
            <div className="space-y-4">
              {userDomains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold">{domain.name}</h4>
                    <p className="text-sm text-gray-600">Value: ${domain.price}</p>
                  </div>
                  <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                    List for Sale
                  </button>
                </div>
              ))}
              {userDomains.length === 0 && (
                <p className="text-gray-500 text-center py-8">No domains in your portfolio yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">My Active Orders</h3>
            <div className="space-y-4">
              {userOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold">{order.domainName}</h4>
                    <p className="text-sm text-gray-600">Price: ${order.price}</p>
                  </div>
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={loading || marketplacePending}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    {loading || marketplacePending ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                </div>
              ))}
              {userOrders.length === 0 && (
                <p className="text-gray-500 text-center py-8">No active orders.</p>
              )}
            </div>

            <div className="mt-8">
              <h4 className="text-md font-semibold mb-4">Available Orders to Buy</h4>
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-semibold">{order.domainName}</h4>
                      <p className="text-sm text-gray-600">Seller: {order.seller}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-lg font-bold text-green-600">${order.price}</span>
                      <button
                        onClick={() => handleBuyDomain(order.id)}
                        disabled={loading || marketplacePending}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
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
