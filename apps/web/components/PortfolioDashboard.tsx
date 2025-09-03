"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";

interface PortfolioItem {
  id: string;
  type: 'domain' | 'basket';
  name: string;
  quantity: number;
  purchasePrice: string;
  currentValue: string;
  change: string;
  changePercent: string;
  purchaseDate: string;
}

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  asset: string;
  quantity: number;
  price: string;
  total: string;
  timestamp: string;
  txHash: string;
}

interface PortfolioDashboardProps {
  competitionId: string;
  walletAddress?: string;
}

export default function PortfolioDashboard({ competitionId, walletAddress }: PortfolioDashboardProps) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [totalValue, setTotalValue] = useState('0');
  const [totalChange, setTotalChange] = useState('0');
  const [totalChangePercent, setTotalChangePercent] = useState('0');
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration
  useEffect(() => {
    setPortfolio([
      {
        id: '1',
        type: 'domain',
        name: 'startup.io',
        quantity: 1,
        purchasePrice: '450',
        currentValue: '500',
        change: '50',
        changePercent: '11.11',
        purchaseDate: '2024-01-10',
      },
      {
        id: '2',
        type: 'domain',
        name: 'tech.dev',
        quantity: 1,
        purchasePrice: '280',
        currentValue: '300',
        change: '20',
        changePercent: '7.14',
        purchaseDate: '2024-01-12',
      },
      {
        id: '3',
        type: 'basket',
        name: 'Tech Startup Bundle',
        quantity: 1,
        purchasePrice: '750',
        currentValue: '800',
        change: '50',
        changePercent: '6.67',
        purchaseDate: '2024-01-14',
      },
    ]);

    setTrades([
      {
        id: '1',
        type: 'buy',
        asset: 'startup.io',
        quantity: 1,
        price: '450',
        total: '450',
        timestamp: '2024-01-10T10:30:00Z',
        txHash: '0x123...',
      },
      {
        id: '2',
        type: 'buy',
        asset: 'tech.dev',
        quantity: 1,
        price: '280',
        total: '280',
        timestamp: '2024-01-12T14:15:00Z',
        txHash: '0x456...',
      },
      {
        id: '3',
        type: 'buy',
        asset: 'Tech Startup Bundle',
        quantity: 1,
        price: '750',
        total: '750',
        timestamp: '2024-01-14T09:45:00Z',
        txHash: '0x789...',
      },
    ]);

    // Calculate totals
    const total = portfolio.reduce((sum, item) => sum + parseFloat(item.currentValue), 0);
    const totalPurchase = portfolio.reduce((sum, item) => sum + parseFloat(item.purchasePrice), 0);
    const change = total - totalPurchase;
    const changePercent = totalPurchase > 0 ? ((change / totalPurchase) * 100).toFixed(2) : '0';

    setTotalValue(total.toFixed(2));
    setTotalChange(change.toFixed(2));
    setTotalChangePercent(changePercent);
  }, [portfolio]);

  const refreshPortfolio = async () => {
    setLoading(true);
    try {
      // TODO: Fetch real portfolio data from smart contracts and API
      console.log('Refreshing portfolio data...');
      // Mock refresh
      setTimeout(() => setLoading(false), 1000);
    } catch (error) {
      console.error('Error refreshing portfolio:', error);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Portfolio Summary</h3>
          <button
            onClick={refreshPortfolio}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">${totalValue}</div>
            <div className="text-sm text-gray-500">Total Value</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${parseFloat(totalChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalChange}
            </div>
            <div className="text-sm text-gray-500">Total Change</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${parseFloat(totalChangePercent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalChangePercent}%
            </div>
            <div className="text-sm text-gray-500">Change %</div>
          </div>
        </div>
      </div>

      {/* Portfolio Holdings */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Holdings</h3>
        </div>

        <div className="p-6">
          {portfolio.length > 0 ? (
            <div className="space-y-4">
              {portfolio.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${item.type === 'domain' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                    <div>
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-sm text-gray-600">
                        {item.type === 'domain' ? 'Domain' : 'Basket'} • {item.quantity} unit{item.quantity > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">${item.currentValue}</div>
                    <div className={`text-sm ${parseFloat(item.change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {parseFloat(item.change) >= 0 ? '+' : ''}${item.change} ({item.changePercent}%)
                    </div>
                    <div className="text-xs text-gray-500">
                      Bought: ${item.purchasePrice} on {new Date(item.purchaseDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No holdings in your portfolio yet.</p>
          )}
        </div>
      </div>

      {/* Trading History */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Trading History</h3>
        </div>

        <div className="p-6">
          {trades.length > 0 ? (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <h4 className="font-semibold">
                        {trade.type === 'buy' ? 'Bought' : 'Sold'} {trade.asset}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {trade.quantity} unit{trade.quantity > 1 ? 's' : ''} @ ${trade.price} each
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(trade.timestamp).toLocaleString()} • {trade.txHash}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">${trade.total}</div>
                    <div className={`text-sm ${trade.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.type === 'buy' ? 'Purchase' : 'Sale'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No trading history yet.</p>
          )}
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Chart</h3>
        <div className="h-64 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Performance chart will be displayed here</p>
        </div>
      </div>
    </div>
  );
}
