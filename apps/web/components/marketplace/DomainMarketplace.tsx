"use client";

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
  Globe,
  TrendingUp,
  Tag,
  Zap,
  Plus,
  ShoppingCart,
  DollarSign,
  Clock,
  Eye,
  MessageCircle,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAlert } from '../ui/Alert';
import { getDeFiService, SUPPORTED_CHAINS, type SupportedChainId, type DomainListing, type DomainOffer } from '../../lib/defi/defiService';
import Link from 'next/link';

const safePriceToBigInt = (price: string | number): bigint => {
  try {
    if (typeof price === 'number') {
      return BigInt(Math.floor(price));
    }
    if (typeof price === 'string') {
      // Remove decimal places and convert to BigInt
      const cleanPrice = price.split('.')[0];
      return BigInt(cleanPrice);
    }
    return BigInt(0);
  } catch (error) {
    console.warn('Failed to convert price to BigInt:', price, error);
    return BigInt(0);
  }
};

interface MarketplaceStats {
  totalTransactions: number;
  activeListings: number;
  activeOffers: number;
  totalVolume: string;
  last24hTransactions: number;
}

export default function DomainMarketplace() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { showAlert } = useAlert();
  const defiService = getDeFiService();

  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'offers' | 'history'>('browse');
  const [selectedChain, setSelectedChain] = useState<SupportedChainId>(SUPPORTED_CHAINS.ETHEREUM);
  const [listings, setListings] = useState<DomainListing[]>([]);
  const [offers, setOffers] = useState<DomainOffer[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [listingForm, setListingForm] = useState({
    contract: '',
    tokenId: '',
    price: '',
    currency: 'ETH'
  });
  const [offerForm, setOfferForm] = useState({
    contract: '',
    tokenId: '',
    price: '',
    expirationHours: 24
  });

  useEffect(() => {
    loadMarketplaceData();
  }, [selectedChain]);

  const loadMarketplaceData = async () => {
    try {
      setLoading(true);
      
      // Load fractional tokens from the API
      const fractionalTokensResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/fractional-tokens`)
        .then(r => r.ok ? r.json() : { tokens: [] })
        .catch(() => ({ tokens: [] }));

      const tokens = fractionalTokensResponse.tokens || [];
      
      // Convert fractional tokens to listing format
      const listingsData: DomainListing[] = tokens.map((token: any, index: number) => ({
        orderId: token.token_address || `token-${index}`,
        contract: token.token_address || '0x0000000000000000000000000000000000000000',
        tokenId: token.domain_name || `token-${index}`,
        price: token.current_price_usd ? (parseFloat(token.current_price_usd) * 1e18).toString() : '4500000000000000000', // Default 4.5 ETH
        currency: 'ETH',
        seller: token.token_address ? token.token_address.slice(0, 42) : '0x0000000000000000000000000000000000000000',
        status: 'active',
        createdAt: token.fractionalized_at || new Date().toISOString(),
        chainId: selectedChain
      }));

      // Load stats
      const statsData = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/marketplace/stats?chain=${selectedChain}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);

      setListings(listingsData);
      if (statsData) {
        setStats(statsData);
      } else {
        // Fallback stats if API is unavailable
        setStats({
          totalTransactions: 0,
          activeListings: listingsData.length,
          activeOffers: 0,
          totalVolume: '0',
          last24hTransactions: 0
        });
      }
    } catch (error) {
      console.log('Marketplace data loading error details:', error);
      // Use console.log instead of console.error to avoid Next.js error overlay
      showAlert('error', 'Load Failed', 'Unable to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListing = async () => {
    if (!walletClient || !listingForm.contract || !listingForm.tokenId || !listingForm.price) return;

    setLoading(true);
    try {
      const result = await defiService.createDomainListing(
        walletClient,
        listingForm.contract,
        listingForm.tokenId,
        parseEther(listingForm.price).toString(),
        selectedChain,
        (step, progress) => {
          console.log(`Creating listing: ${step} (${progress}%)`);
        }
      );

      showAlert('success', 'Listing Created!', 
        `Successfully created listing ${result.orderId}. Transaction: ${result.txHash}`
      );

      // Reset form and reload data
      setListingForm({ contract: '', tokenId: '', price: '', currency: 'ETH' });
      await loadMarketplaceData();
    } catch (error) {
      console.error('Listing creation failed:', error);
      showAlert('error', 'Listing Failed', 'Unable to create listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async () => {
    if (!walletClient || !offerForm.contract || !offerForm.tokenId || !offerForm.price) return;

    setLoading(true);
    try {
      const result = await defiService.createDomainOffer(
        walletClient,
        offerForm.contract,
        offerForm.tokenId,
        parseEther(offerForm.price).toString(),
        offerForm.expirationHours,
        selectedChain,
        (step, progress) => {
          console.log(`Creating offer: ${step} (${progress}%)`);
        }
      );

      showAlert('success', 'Offer Created!', 
        `Successfully created offer ${result.orderId}. Transaction: ${result.txHash}`
      );

      // Reset form and reload data
      setOfferForm({ contract: '', tokenId: '', price: '', expirationHours: 24 });
      await loadMarketplaceData();
    } catch (error) {
      console.error('Offer creation failed:', error);
      showAlert('error', 'Offer Failed', 'Unable to create offer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyListing = async (orderId: string) => {
    if (!walletClient) return;

    setLoading(true);
    try {
      const result = await defiService.buyDomainListing(
        walletClient,
        orderId,
        selectedChain,
        (step, progress) => {
          console.log(`Purchasing: ${step} (${progress}%)`);
        }
      );

      showAlert('success', 'Purchase Complete!', 
        `Successfully purchased domain! Transaction: ${result.txHash}`
      );

      await loadMarketplaceData();
    } catch (error) {
      console.error('Purchase failed:', error);
      showAlert('error', 'Purchase Failed', 'Unable to complete purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getChainName = (chainId: SupportedChainId) => {
    switch (chainId) {
      case SUPPORTED_CHAINS.ETHEREUM: return 'Ethereum';
      case SUPPORTED_CHAINS.POLYGON: return 'Polygon';
      case SUPPORTED_CHAINS.ARBITRUM: return 'Arbitrum';
      case SUPPORTED_CHAINS.OPTIMISM: return 'Optimism';
      case SUPPORTED_CHAINS.BASE: return 'Base';
      default: return 'Unknown';
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Domain Marketplace</h2>
            <p className="text-slate-400 text-sm">Trade domains with Doma Protocol integration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-400" />
          <span className="text-sm text-green-400">Multi-chain SDK Active</span>
        </div>
      </div>

      {/* Chain Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Select Chain</label>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(SUPPORTED_CHAINS).map(([name, chainId]) => (
            <button
              key={chainId}
              onClick={() => setSelectedChain(chainId)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChain === chainId
                  ? 'bg-brand-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {getChainName(chainId)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Volume</span>
            </div>
            <p className="text-lg font-bold text-white">{formatEther(safePriceToBigInt(stats.totalVolume))} ETH</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Listings</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.activeListings}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-slate-400">Offers</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.activeOffers}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400">Transactions</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.totalTransactions}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-slate-400">24h Activity</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.last24hTransactions}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-slate-800/30 rounded-lg p-1">
        {[
          { id: 'browse', label: 'Browse Listings', icon: ShoppingCart },
          { id: 'create', label: 'Create Listing', icon: Tag },
          { id: 'offers', label: 'Make Offer', icon: DollarSign },
          { id: 'history', label: 'My Activity', icon: Clock }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-brand-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Available Listings</h3>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-400 mx-auto"></div>
              <p className="text-slate-400 mt-2">Loading listings...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No listings available</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {listings.map((listing, index) => {
                const priceInEth = formatEther(safePriceToBigInt(listing.price));
                const formattedPrice = parseFloat(priceInEth) > 1000 
                  ? `${(parseFloat(priceInEth) / 1000).toFixed(2)}K`
                  : parseFloat(priceInEth).toFixed(4);
                
                return (
                  <Link 
                    key={`${listing.orderId}-${listing.contract}-${listing.tokenId}-${index}`}
                    href={`/marketplace/${listing.contract}/${listing.tokenId}`}
                    className="bg-slate-800/50 rounded-lg p-4 border border-white/5 hover:border-brand-500/50 transition-all hover:scale-105 cursor-pointer group"
                  >
                    <div className="mb-3">
                      <p className="text-white font-semibold text-lg group-hover:text-brand-400 transition-colors truncate">{listing.tokenId}</p>
                      <p className="text-xs text-slate-500 font-mono truncate">{listing.contract.slice(0, 10)}...{listing.contract.slice(-8)}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-400">Price</span>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{formattedPrice} <span className="text-sm text-slate-400">{listing.currency}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">~0 offers</span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Recently
                        </span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Chat functionality placeholder
                          }}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-1.5 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          Chat
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // View functionality - will navigate to detail page
                            window.location.href = `/marketplace/${listing.contract}/${listing.tokenId}`;
                          }}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-1.5 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="max-w-md mx-auto space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Create Domain Listing</h3>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contract Address</label>
            <input
              type="text"
              value={listingForm.contract}
              onChange={(e) => setListingForm(prev => ({ ...prev, contract: e.target.value }))}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              placeholder="0x..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Token ID</label>
            <input
              type="text"
              value={listingForm.tokenId}
              onChange={(e) => setListingForm(prev => ({ ...prev, tokenId: e.target.value }))}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Price (ETH)</label>
            <input
              type="number"
              step="0.01"
              value={listingForm.price}
              onChange={(e) => setListingForm(prev => ({ ...prev, price: e.target.value }))}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              placeholder="1.0"
            />
          </div>
          <button
            onClick={handleCreateListing}
            disabled={loading || !isConnected || !listingForm.contract || !listingForm.tokenId || !listingForm.price}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Creating...' : 'Create Listing'}
          </button>
        </div>
      )}

      {activeTab === 'offers' && (
        <div className="max-w-md mx-auto space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Make Domain Offer</h3>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contract Address</label>
            <input
              type="text"
              value={offerForm.contract}
              onChange={(e) => setOfferForm(prev => ({ ...prev, contract: e.target.value }))}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              placeholder="0x..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Token ID</label>
            <input
              type="text"
              value={offerForm.tokenId}
              onChange={(e) => setOfferForm(prev => ({ ...prev, tokenId: e.target.value }))}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Offer Price (WETH)</label>
            <input
              type="number"
              step="0.01"
              value={offerForm.price}
              onChange={(e) => setOfferForm(prev => ({ ...prev, price: e.target.value }))}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              placeholder="0.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Expiration (Hours)</label>
            <select
              value={offerForm.expirationHours}
              onChange={(e) => setOfferForm(prev => ({ ...prev, expirationHours: parseInt(e.target.value) }))}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white"
            >
              <option value={24}>24 Hours</option>
              <option value={48}>48 Hours</option>
              <option value={72}>72 Hours</option>
              <option value={168}>1 Week</option>
            </select>
          </div>
          <button
            onClick={handleCreateOffer}
            disabled={loading || !isConnected || !offerForm.contract || !offerForm.tokenId || !offerForm.price}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Creating...' : 'Make Offer'}
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">My Marketplace Activity</h3>
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Transaction history will appear here</p>
            <p className="text-sm text-slate-500 mt-1">
              Connect your wallet to view your marketplace activity
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
