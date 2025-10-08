"use client";

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertCircle } from 'lucide-react';
import { useOrderbookSdk } from '../../lib/orderbook/client';
import { useAlert } from '../ui/Alert';
import { getDeFiService } from '../../lib/defi/defiService';
import { useFractionalTokens } from '../../lib/hooks/useFractionalTokens';
import type { FuturesContract, FuturesPosition, FuturesOrder, OrderBookEntry } from '../../lib/defi/types';

interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  currentPrice: bigint;
}

function OrderBook({ bids, asks, currentPrice }: OrderBookProps) {
  const maxTotal = Math.max(
    ...bids.map(b => Number(formatEther(b.total))),
    ...asks.map(a => Number(formatEther(a.total)))
  );

  return (
    <div className="bg-slate-800/50 rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium text-white mb-3">Order Book</h3>
      
      {/* Asks (Sells) */}
      <div className="space-y-1 mb-3">
        {asks.slice(0, 5).reverse().map((ask, i) => (
          <div key={i} className="relative">
            <div
              className="absolute inset-0 bg-red-500/10"
              style={{ width: `${(Number(formatEther(ask.total)) / maxTotal) * 100}%` }}
            />
            <div className="relative flex justify-between text-xs px-2 py-1">
              <span className="text-red-400">{formatEther(ask.price)}</span>
              <span className="text-slate-400">{formatEther(ask.size)}</span>
              <span className="text-slate-500">{formatEther(ask.total)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Current Price */}
      <div className="border-y border-white/10 py-2 mb-3">
        <div className="flex justify-between items-center px-2">
          <span className="text-xs text-slate-400">Mark Price</span>
          <span className="text-sm font-bold text-white">{formatEther(currentPrice)} ETH</span>
        </div>
      </div>

      {/* Bids (Buys) */}
      <div className="space-y-1">
        {bids.slice(0, 5).map((bid, i) => (
          <div key={i} className="relative">
            <div
              className="absolute inset-0 bg-green-500/10"
              style={{ width: `${(Number(formatEther(bid.total)) / maxTotal) * 100}%` }}
            />
            <div className="relative flex justify-between text-xs px-2 py-1">
              <span className="text-green-400">{formatEther(bid.price)}</span>
              <span className="text-slate-400">{formatEther(bid.size)}</span>
              <span className="text-slate-500">{formatEther(bid.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FuturesTrading() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const sdk = useOrderbookSdk();
  const { showAlert } = useAlert();
  const defiService = getDeFiService();
  const { data: fractionalTokensData, isLoading: tokensLoading } = useFractionalTokens();
  
  const [selectedContract, setSelectedContract] = useState<FuturesContract | null>(null);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [positions, setPositions] = useState<FuturesPosition[]>([]);
  const [orders, setOrders] = useState<FuturesOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Convert fractional tokens to futures contracts (ONLY source of contracts)
  const allContracts: FuturesContract[] = (fractionalTokensData?.tokens || []).map((token, index) => {
    const priceUsd = parseFloat(token.current_price_usd || '0');
    const priceEth = priceUsd / 2000; // Assume $2000/ETH
    const priceWei = parseEther(priceEth.toFixed(18));
    
    // Add slight variation for mark and index prices
    const markPriceWei = parseEther((priceEth * 1.002).toFixed(18));
    const indexPriceWei = parseEther((priceEth * 0.998).toFixed(18));
    
    return {
      id: `token-${token.token_address}`,
      domainName: token.domain_name,
      expiryDate: new Date('2025-12-31'), // Perpetual
      strikePrice: priceWei,
      currentPrice: priceWei,
      markPrice: markPriceWei,
      indexPrice: indexPriceWei,
      volume24h: parseEther((Math.random() * 100).toFixed(2)), // Simulated volume
      openInterest: parseEther(token.total_supply || '0'),
      fundingRate: 0.0001 + (Math.random() * 0.0002), // 0.01% - 0.03%
      isPerpetual: true,
      contractType: 'perpetual' as const,
      tokenAddress: token.token_address
    };
  });

  // Generate orderbook from selected contract
  const generateOrderBook = (contract: FuturesContract | null) => {
    if (!contract) {
      return { bids: [], asks: [] };
    }

    const currentPrice = Number(formatEther(contract.currentPrice));
    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];

    // Generate 5 bid levels (below current price)
    for (let i = 0; i < 5; i++) {
      const priceOffset = (i + 1) * 0.001; // 0.1% steps
      const price = parseEther((currentPrice * (1 - priceOffset)).toFixed(18));
      const size = parseEther((10 + Math.random() * 20).toFixed(2));
      const total = BigInt(Number(price) * Number(size));
      bids.push({ price, size, total });
    }

    // Generate 5 ask levels (above current price)
    for (let i = 0; i < 5; i++) {
      const priceOffset = (i + 1) * 0.001; // 0.1% steps
      const price = parseEther((currentPrice * (1 + priceOffset)).toFixed(18));
      const size = parseEther((10 + Math.random() * 20).toFixed(2));
      const total = BigInt(Number(price) * Number(size));
      asks.push({ price, size, total });
    }

    return { bids, asks };
  };

  const orderBook = generateOrderBook(selectedContract);

  // Generate positions from fractional tokens (user's holdings)
  const generatePositions = (): FuturesPosition[] => {
    if (!address || !fractionalTokensData?.tokens) return [];

    // Simulate user having positions in first 2 tokens
    return fractionalTokensData.tokens.slice(0, 2).map((token, index) => {
      const priceUsd = parseFloat(token.current_price_usd || '0');
      const priceEth = priceUsd / 2000;
      const entryPriceEth = priceEth * (0.95 + Math.random() * 0.1);
      const currentPriceWei = parseEther(priceEth.toFixed(18));
      const entryPriceWei = parseEther(entryPriceEth.toFixed(18));
      const sizeWei = parseEther((Math.random() * 5 + 1).toFixed(2));
      const leverageNum = 2 + Math.floor(Math.random() * 3);
      
      const pnl = (priceEth - entryPriceEth) * Number(formatEther(sizeWei));
      const unrealizedPnl = parseEther(pnl.toFixed(18));

      return {
        id: `pos-${token.token_address}-${index}`,
        trader: address,
        contractId: `token-${token.token_address}`,
        domainName: token.domain_name,
        side: index % 2 === 0 ? 'long' as const : 'short' as const,
        size: sizeWei,
        entryPrice: entryPriceWei,
        markPrice: currentPriceWei,
        unrealizedPnl,
        realizedPnl: parseEther('0'),
        margin: parseEther((Number(formatEther(sizeWei)) * priceEth / leverageNum).toFixed(18)),
        leverage: leverageNum,
        liquidationPrice: parseEther((entryPriceEth * 0.7).toFixed(18)),
        createdAt: new Date(),
      };
    });
  };

  useEffect(() => {
    if (allContracts.length > 0) {
      setSelectedContract(allContracts[0]);
    }
    if (address) {
      setPositions(generatePositions());
    }
  }, [address, fractionalTokensData]);

  const handleOpenPosition = async () => {
    if (!address || !selectedContract || !size || !walletClient) return;
    
    setLoading(true);
    try {
      // Calculate margin requirement
      const sizeNum = parseFloat(size);
      const leverageNum = parseFloat(leverage);
      const priceNum = Number(formatEther(selectedContract.currentPrice));
      const marginRequired = (sizeNum * priceNum / leverageNum * 1000000).toString(); // Convert to USDC wei (6 decimals)
      
      // Use DeFi service to open position
      const result = await defiService.openFuturesPosition(
        selectedContract.id,
        side,
        parseEther(size).toString(),
        leverageNum,
        marginRequired,
        walletClient
      );
      
      const leverageText = leverageNum > 1 ? ` with ${leverage}x leverage` : '';
      showAlert('success', 
        `${side.toUpperCase()} Position Opened!`, 
        `Successfully opened a ${side} position of ${size} ETH on ${selectedContract.domainName}${leverageText}. Monitor your position in the Active Positions section.`
      );
      
      // Refresh positions
      if (address) {
        const userPositions = await defiService.getFuturesPositions(address);
        setPositions(userPositions);
      }
      
      setSize('');
      setPrice('');
    } catch (error) {
      console.error('Failed to open position:', error);
      showAlert('error', 
        'Position Failed', 
        'Unable to open position. Please check your margin requirements and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getPnLColor = (pnl: bigint) => {
    const value = Number(formatEther(pnl));
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  const calculateMargin = () => {
    if (!size || !leverage || !selectedContract) return '0';
    const sizeNum = parseFloat(size);
    const leverageNum = parseFloat(leverage);
    const priceNum = Number(formatEther(selectedContract.currentPrice));
    return (sizeNum * priceNum / leverageNum).toFixed(4);
  };

  return (
    <div className="space-y-6">
      {/* Contract Selector */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
          <span>Perpetual Futures</span>
          {tokensLoading && <span className="text-sm text-slate-400">Loading tokens...</span>}
          {!tokensLoading && allContracts.length > 0 && (
            <span className="text-sm text-green-400">{allContracts.length} fractional tokens available</span>
          )}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {allContracts.map((contract) => (
            <button
              key={contract.id}
              onClick={() => setSelectedContract(contract)}
              className={`p-4 rounded-lg border transition-all ${
                selectedContract?.id === contract.id
                  ? 'bg-brand-500/10 border-brand-500/50'
                  : 'bg-slate-800/50 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-medium">{contract.domainName}</span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                  {contract.contractType}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Mark Price</p>
                  <p className="text-white font-medium">{formatEther(contract.markPrice)} ETH</p>
                </div>
                <div>
                  <p className="text-slate-500">24h Volume</p>
                  <p className="text-white font-medium">{formatEther(contract.volume24h)} ETH</p>
                </div>
                <div>
                  <p className="text-slate-500">Funding Rate</p>
                  <p className="text-yellow-400 font-medium">{(contract.fundingRate * 100).toFixed(3)}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Open Interest</p>
                  <p className="text-white font-medium">{formatEther(contract.openInterest)} ETH</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedContract && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Form */}
            <div className="bg-slate-800/50 rounded-lg border border-white/10 p-4">
              <h3 className="text-sm font-medium text-white mb-4">Place Order</h3>
              
              {/* Side Selector */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setSide('long')}
                  className={`py-2 rounded-lg font-medium transition-all ${
                    side === 'long'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'bg-slate-700/50 text-slate-400 border border-white/10'
                  }`}
                >
                  Long
                </button>
                <button
                  onClick={() => setSide('short')}
                  className={`py-2 rounded-lg font-medium transition-all ${
                    side === 'short'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-slate-700/50 text-slate-400 border border-white/10'
                  }`}
                >
                  Short
                </button>
              </div>

              {/* Order Type */}
              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">Order Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as 'market' | 'limit' | 'stop')}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </div>

              {/* Size */}
              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">Size (ETH)</label>
                <input
                  type="number"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Price (for limit/stop orders) */}
              {orderType !== 'market' && (
                <div className="mb-4">
                  <label className="block text-xs text-slate-400 mb-2">Price (ETH)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}

              {/* Leverage Slider */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">Leverage</span>
                  <span className="text-white font-medium">{leverage}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-slate-500">1x</span>
                  <span className="text-slate-500">20x</span>
                </div>
              </div>

              {/* Margin Info */}
              <div className="bg-slate-900/50 rounded-lg p-3 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Required Margin</span>
                  <span className="text-white">{calculateMargin()} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Entry Price</span>
                  <span className="text-white">
                    {orderType === 'market'
                      ? formatEther(selectedContract.markPrice)
                      : price || '0'} ETH
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Liquidation Price</span>
                  <span className="text-orange-400">
                    {size && leverage
                      ? (Number(formatEther(selectedContract.markPrice)) * (1 - 0.8 / parseFloat(leverage))).toFixed(4)
                      : '0'} ETH
                  </span>
                </div>
              </div>

              <button
                onClick={handleOpenPosition}
                disabled={!isConnected || loading || !size}
                className={`w-full py-2 font-medium rounded-lg transition-all ${
                  side === 'long'
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Processing...' : `Open ${side.toUpperCase()} Position`}
              </button>
            </div>

            {/* Order Book */}
            <OrderBook
              bids={orderBook.bids}
              asks={orderBook.asks}
              currentPrice={selectedContract.markPrice}
            />

            {/* Contract Info */}
            <div className="bg-slate-800/50 rounded-lg border border-white/10 p-4">
              <h3 className="text-sm font-medium text-white mb-4">Contract Info</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Contract Type</span>
                  <span className="text-white">{selectedContract.contractType}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Index Price</span>
                  <span className="text-white">{formatEther(selectedContract.indexPrice)} ETH</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Mark Price</span>
                  <span className="text-white">{formatEther(selectedContract.markPrice)} ETH</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Funding Rate</span>
                  <span className="text-yellow-400">{(selectedContract.fundingRate * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Next Funding</span>
                  <span className="text-white">in 3h 45m</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">24h Volume</span>
                  <span className="text-white">{formatEther(selectedContract.volume24h)} ETH</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Open Interest</span>
                  <span className="text-white">{formatEther(selectedContract.openInterest)} ETH</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <div className="text-xs">
                      <p className="text-yellow-400 font-medium mb-1">Risk Warning</p>
                      <p className="text-slate-400">
                        Futures trading carries high risk. You may lose more than your initial margin.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Positions */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Active Positions</h3>
        
        {positions.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No active positions</p>
            <p className="text-sm text-slate-500 mt-1">
              Open a position to start trading
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-white/10">
                  <th className="text-left pb-3">Contract</th>
                  <th className="text-left pb-3">Side</th>
                  <th className="text-right pb-3">Size</th>
                  <th className="text-right pb-3">Entry Price</th>
                  <th className="text-right pb-3">Mark Price</th>
                  <th className="text-right pb-3">PnL</th>
                  <th className="text-right pb-3">ROE</th>
                  <th className="text-right pb-3">Margin</th>
                  <th className="text-right pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                  const roe = (Number(formatEther(position.unrealizedPnl)) / Number(formatEther(position.margin)) * 100);
                  return (
                    <tr key={position.id} className="text-sm border-b border-white/5">
                      <td className="py-3">
                        <p className="text-white font-medium">{position.domainName}</p>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          position.side === 'long'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {position.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right py-3 text-white">
                        {formatEther(position.size)}
                      </td>
                      <td className="text-right py-3 text-white">
                        {formatEther(position.entryPrice)}
                      </td>
                      <td className="text-right py-3 text-white">
                        {formatEther(position.markPrice)}
                      </td>
                      <td className={`text-right py-3 font-medium ${getPnLColor(position.unrealizedPnl)}`}>
                        {Number(formatEther(position.unrealizedPnl)) > 0 ? '+' : ''}
                        {formatEther(position.unrealizedPnl)} ETH
                      </td>
                      <td className={`text-right py-3 font-medium ${getPnLColor(position.unrealizedPnl)}`}>
                        {roe > 0 ? '+' : ''}{roe.toFixed(2)}%
                      </td>
                      <td className="text-right py-3 text-white">
                        {formatEther(position.margin)}
                      </td>
                      <td className="text-right py-3">
                        <button className="text-xs bg-red-500/10 text-red-400 px-3 py-1 rounded hover:bg-red-500/20 transition-colors">
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
