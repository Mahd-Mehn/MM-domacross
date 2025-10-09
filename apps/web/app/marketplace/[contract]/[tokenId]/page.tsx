"use client";

import { use, useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { ArrowLeft, MessageCircle, Eye, Clock, TrendingUp, Shield, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Head from 'next/head';
import { useFractionalToken } from '@/lib/hooks/useFractionalTokens';
import { useOrderbook } from '@/lib/hooks/useOrderbook';
import { XMTPChat } from '@/components/XMTPChat';
import { createDomaOrderbookClient, OrderbookType, viemToEthersSigner } from '@doma-protocol/orderbook-sdk';
import { useWalletClient } from 'wagmi';

interface PageProps {
  params: Promise<{
    contract: string;
    tokenId: string;
  }>;
}

export default function DomainDetailPage({ params }: PageProps) {
  const { contract, tokenId } = use(params);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // State for trading
  const [buyAmount, setBuyAmount] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [orderStatus, setOrderStatus] = useState<{ type: 'success' | 'error' | 'info' | null, message: string }>({ type: null, message: '' });
  const [showChat, setShowChat] = useState(false);
  const [offerExpiry, setOfferExpiry] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Fetch fractional token data
  const { data: tokenData, isLoading: tokenLoading } = useFractionalToken(tokenId);
  
  // Fetch live orderbook data
  const { data: orderbookData, isLoading: orderbookLoading } = useOrderbook(tokenData?.domain_name, { intervalMs: 10000 });

  // Initialize Doma SDK client (with type assertion for flexibility)
  const domaClient = createDomaOrderbookClient({
    apiClientOptions: {
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api-testnet.doma.xyz'
    },
    source: 'DomaCross',
    chains: [] as any // Type assertion to bypass strict typing
  } as any);

  // Buy domain using Doma SDK
  const handleBuyDomain = async (orderId: string, price: string) => {
    if (!walletClient || !address) {
      setOrderStatus({ type: 'error', message: 'Please connect your wallet' });
      return;
    }

    setIsProcessing(true);
    try {
      // Convert Viem wallet to Ethers signer
      const signer = viemToEthersSigner(walletClient, 'eip155:1');

      setOrderStatus({ type: 'info', message: 'Initiating purchase...' });

      // Buy the listing using Doma SDK
      const result = await domaClient.buyListing({
        params: {
          orderId: orderId,
        },
        signer,
        chainId: 'eip155:1',
        onProgress: (...args: any[]) => {
          const [step, progress] = args;
          console.log(`Buying: ${step} (${progress}%)`);
          setOrderStatus({ 
            type: 'info', 
            message: `${step}: ${progress}%` 
          });
        },
      });

      setOrderStatus({ 
        type: 'success', 
        message: `Domain purchased successfully!` 
      });
      
      console.log('Purchase result:', result);
      
      // Refresh token data after purchase
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error: any) {
      console.error('Purchase failed:', error);
      setOrderStatus({ 
        type: 'error', 
        message: error.message || 'Failed to purchase domain' 
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setOrderStatus({ type: null, message: '' }), 10000);
    }
  };

  // Create offer using Doma SDK
  const handleCreateOffer = async (price: string) => {
    if (!walletClient || !address) {
      setOrderStatus({ type: 'error', message: 'Please connect your wallet' });
      return;
    }

    setIsProcessing(true);
    try {
      const signer = viemToEthersSigner(walletClient, 'eip155:1');

      setOrderStatus({ type: 'info', message: 'Creating offer...' });

      const result = await domaClient.createOffer({
        params: {
          items: [{
            contract: contract,
            tokenId: tokenId,
            currencyContractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
            price: parseEther(price).toString(),
          }],
          orderbook: OrderbookType.DOMA,
          source: 'DomaCross',
        },
        signer,
        chainId: 'eip155:1',
        onProgress: (...args: any[]) => {
          const [step, progress] = args;
          console.log(`Creating offer: ${step} (${progress}%)`);
          setOrderStatus({ 
            type: 'info', 
            message: `${step}: ${progress}%` 
          });
        },
      });

      setOrderStatus({ 
        type: 'success', 
        message: 'Offer created successfully!' 
      });
      
      console.log('Offer result:', result);
    } catch (error: any) {
      console.error('Offer creation failed:', error);
      setOrderStatus({ 
        type: 'error', 
        message: error.message || 'Failed to create offer' 
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setOrderStatus({ type: null, message: '' }), 10000);
    }
  };

  // Update document metadata for SEO
  useEffect(() => {
    if (tokenData) {
      document.title = `${tokenData.domain_name} - Fractional Domain Trading | DomaCross`;
      
      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', 
          `Trade fractional shares of ${tokenData.domain_name}. Current price: $${tokenData.current_price_usd}. DomaRank: ${tokenData.doma_rank_score || 'N/A'}. Live orderbook and instant chat with sellers.`
        );
      }

      // Add Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', `${tokenData.domain_name} - Fractional Domain Trading`);
      }

      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', 
          `Trade fractional shares of ${tokenData.domain_name} on DomaCross. Real-time orderbook, instant chat, and secure transactions.`
        );
      }

      if (tokenData.image_url) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
          ogImage.setAttribute('content', tokenData.image_url);
        }
      }

      // Add structured data for SEO
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": tokenData.domain_name,
        "description": tokenData.description || `Fractional shares of ${tokenData.domain_name}`,
        "image": tokenData.image_url,
        "offers": {
          "@type": "Offer",
          "price": tokenData.current_price_usd,
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        },
        "aggregateRating": tokenData.doma_rank_score ? {
          "@type": "AggregateRating",
          "ratingValue": tokenData.doma_rank_score,
          "bestRating": "10"
        } : undefined
      };

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }
  }, [tokenData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link 
          href="/marketplace"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        {/* Domain Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{tokenId}</h1>
              <p className="text-slate-400 font-mono text-sm">{contract}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowChat(!showChat)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {showChat ? 'Hide Chat' : 'Chat with Seller'}
              </button>
              <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                <Eye className="w-4 h-4" />
                Watch
              </button>
            </div>
          </div>

          {/* Price and Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Current Price</p>
              <p className="text-2xl font-bold text-white">
                {tokenData?.current_price_usd ? `$${tokenData.current_price_usd}` : '4.5 ETH'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">DomaRank Score</p>
              <p className="text-2xl font-bold text-green-400">
                {tokenData?.doma_rank_score || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Total Supply</p>
              <p className="text-2xl font-bold text-white">
                {tokenData?.total_supply || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Status</p>
              <p className="text-2xl font-bold text-blue-400">Active</p>
            </div>
          </div>
        </div>

        {/* XMTP Chat Section */}
        {showChat && tokenData && (
          <div className="mb-6">
            <XMTPChat 
              recipientAddress={contract}
              domainName={tokenData.domain_name}
              offerId={contract}
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Orderbook & Offers */}
          <div className="lg:col-span-2 space-y-6">
            {/* Orderbook */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Live Orderbook
                {orderbookLoading && <span className="text-xs text-slate-400">(updating...)</span>}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-2">Bids</h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {orderbookData?.bids && orderbookData.bids.length > 0 ? (
                      orderbookData.bids.slice(0, 10).map((bid, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-green-400">{parseFloat(bid.price).toFixed(4)}</span>
                          <span className="text-slate-300">{parseFloat(bid.size).toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">No active bids</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-2">Asks</h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {orderbookData?.asks && orderbookData.asks.length > 0 ? (
                      orderbookData.asks.slice(0, 10).map((ask, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-red-400">{parseFloat(ask.price).toFixed(4)}</span>
                          <span className="text-slate-300">{parseFloat(ask.size).toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">No active asks</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {orderbookData?.updatedAt && (
                <p className="text-xs text-slate-500 mt-3 text-right">
                  Last updated: {new Date(orderbookData.updatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Recent Activity
              </h2>
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">No recent activity</p>
              </div>
            </div>

            {/* Domain Info */}
            {tokenData && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Token Information</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Symbol</span>
                    <span className="text-white font-medium">{tokenData.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Decimals</span>
                    <span className="text-white font-medium">{tokenData.decimals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fractionalized</span>
                    <span className="text-white font-medium">
                      {tokenData.fractionalized_at ? new Date(tokenData.fractionalized_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {tokenData.website && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Website</span>
                      <a href={tokenData.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        Visit
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Trading Panel */}
          <div className="space-y-6">
            {/* Buy/Sell Panel */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Trade Fractional Tokens</h2>
              
              {orderStatus.type && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                  orderStatus.type === 'success' ? 'bg-green-500/10 border border-green-500/20' : 
                  orderStatus.type === 'info' ? 'bg-blue-500/10 border border-blue-500/20' :
                  'bg-red-500/10 border border-red-500/20'
                }`}>
                  {orderStatus.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : orderStatus.type === 'info' ? (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={
                    orderStatus.type === 'success' ? 'text-green-400 text-sm' : 
                    orderStatus.type === 'info' ? 'text-blue-400 text-sm' :
                    'text-red-400 text-sm'
                  }>
                    {orderStatus.message}
                  </span>
                </div>
              )}
              
              {!isConnected ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 mb-4">Connect wallet to trade</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Buy Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-green-400">Buy Order</h3>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Amount (tokens)</label>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Price (USD per token)</label>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={buyPrice}
                        onChange={(e) => setBuyPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    {buyAmount && buyPrice && (
                      <p className="text-sm text-slate-400">
                        Total: ${(parseFloat(buyAmount) * parseFloat(buyPrice)).toFixed(2)}
                      </p>
                    )}
                    <button 
                      onClick={() => handleCreateOffer(buyPrice)}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!buyPrice || isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Create Offer (Doma SDK)'}
                    </button>
                    
                    {/* Quick Buy Button */}
                    {tokenData && (
                      <button 
                        onClick={() => handleBuyDomain(contract, tokenData.current_price_usd)}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Processing...' : `Buy Now - $${parseFloat(tokenData.current_price_usd).toFixed(2)}`}
                      </button>
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-4" />

                  {/* Sell Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-red-400">Sell Order</h3>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Amount (tokens)</label>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Price (USD per token)</label>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                      />
                    </div>
                    {sellAmount && sellPrice && (
                      <p className="text-sm text-slate-400">
                        Total: ${(parseFloat(sellAmount) * parseFloat(sellPrice)).toFixed(2)}
                      </p>
                    )}
                    <button 
                      onClick={async () => {
                        if (!sellAmount || !sellPrice) {
                          setOrderStatus({ type: 'error', message: 'Please enter amount and price' });
                          return;
                        }
                        
                        if (!walletClient || !address) {
                          setOrderStatus({ type: 'error', message: 'Please connect your wallet' });
                          return;
                        }

                        setIsProcessing(true);
                        try {
                          const signer = viemToEthersSigner(walletClient, 'eip155:1');
                          
                          setOrderStatus({ type: 'info', message: 'Creating listing...' });

                          const result = await domaClient.createListing({
                            params: {
                              items: [{
                                contract: contract,
                                tokenId: tokenId,
                                price: parseEther(sellPrice).toString(),
                              }],
                              orderbook: OrderbookType.DOMA,
                              source: 'DomaCross',
                            },
                            signer,
                            chainId: 'eip155:1',
                            onProgress: (...args: any[]) => {
                              const [step, progress] = args;
                              console.log(`Creating listing: ${step} (${progress}%)`);
                              setOrderStatus({ 
                                type: 'info', 
                                message: `${step}: ${progress}%` 
                              });
                            },
                          });

                          setOrderStatus({ type: 'success', message: 'Listing created successfully!' });
                          setSellAmount('');
                          setSellPrice('');
                          console.log('Listing result:', result);
                        } catch (error: any) {
                          console.error('Listing creation failed:', error);
                          setOrderStatus({ type: 'error', message: error.message || 'Failed to create listing' });
                        } finally {
                          setIsProcessing(false);
                          setTimeout(() => setOrderStatus({ type: null, message: '' }), 10000);
                        }
                      }}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!sellAmount || !sellPrice || isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Create Listing (Doma SDK)'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Quick Stats
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">24h Volume</span>
                  <span className="text-white font-medium">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">24h Change</span>
                  <span className="text-green-400 font-medium">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Total Holders</span>
                  <span className="text-white font-medium">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
