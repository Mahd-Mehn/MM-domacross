"use client";

import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { FileText, DollarSign, Clock, Shield, TrendingUp, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { useOrderbookSdk } from '../../lib/orderbook/client';
import { OrderbookType, viemToEthersSigner } from '@doma-protocol/orderbook-sdk';
import { useAlert } from '../../components/ui/Alert';
import Link from 'next/link';

export default function TradingPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const sdk = useOrderbookSdk();
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<'list' | 'manage'>('list');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [tld, setTld] = useState('eth');
  const [listingPrice, setListingPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock domains owned by the user
  const userDomains = [
    { name: 'myportfolio', tld: 'eth', tokenId: '12345', value: '2.5' },
    { name: 'coolproject', tld: 'eth', tokenId: '12346', value: '1.8' },
    { name: 'defiking', tld: 'eth', tokenId: '12347', value: '4.2' },
  ];

  // Mock active listings
  const activeListings = [
    {
      id: '1',
      domainName: 'myportfolio.eth',
      price: parseEther('3'),
      listedAt: new Date('2025-09-15'),
      expiresAt: new Date('2025-10-15'),
      views: 245,
      offers: 2,
      status: 'active' as const,
    },
  ];

  const handleCreateListing = async () => {
    if (!sdk || !walletClient || !address) {
      showAlert('error', 'Wallet not connected', 'Please connect your wallet to create a listing.');
      return;
    }

    if (!listingPrice || parseFloat(listingPrice) <= 0) {
      showAlert('error', 'Invalid price', 'Please enter a valid listing price.');
      return;
    }

    setLoading(true);
    try {
      // Get the domain to list
      const domainToList = customDomain || selectedDomain;
      if (!domainToList) {
        showAlert('error', 'No domain selected', 'Please select or enter a domain to list.');
        return;
      }

      // In production, this would get the actual contract and token ID
      const mockContract = '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'; // ENS contract
      const mockTokenId = '123456';

      // Convert Viem wallet client to Ethers signer for the SDK
      const signer = viemToEthersSigner(walletClient, 'eip155:1');

      // Create the listing
      const result = await sdk.createListing({
        contract: mockContract,
        tokenId: mockTokenId,
        price: parseEther(listingPrice).toString(),
      }, (step: string, progress: number) => {
        console.log(`Creating listing: ${step} (${progress}%)`);
      });

      showAlert('success', 
        'Domain Listed Successfully!', 
        `${domainToList}.${tld} has been listed for ${listingPrice} ETH. Your listing is now live on the marketplace.`
      );

      // Reset form
      setSelectedDomain('');
      setCustomDomain('');
      setListingPrice('');
      setDescription('');
      setDuration('30');

    } catch (error: any) {
      console.error('Failed to create listing:', error);
      showAlert('error', 
        'Listing Failed', 
        error.message || 'Unable to create listing. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!sdk || !walletClient || !address) {
      showAlert('error', 'Wallet not connected', 'Please connect your wallet to cancel the listing.');
      return;
    }

    setLoading(true);
    try {
      const signer = viemToEthersSigner(walletClient, 'eip155:1');

      await sdk.cancelListing(listingId, (step: string, progress: number) => {
        console.log(`Cancelling listing: ${step} (${progress}%)`);
      });

      showAlert('success', 'Listing Cancelled', 'Your listing has been successfully cancelled.');
    } catch (error: any) {
      console.error('Failed to cancel listing:', error);
      showAlert('error', 'Cancellation Failed', error.message || 'Unable to cancel listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-400/20 to-accent/20 backdrop-blur-sm py-12 border-b border-white/10 mb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-brand-500/20 rounded-lg">
              <FileText className="w-8 h-8 text-brand-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">
                Domain Trading Center
              </h1>
              <p className="text-slate-400 mt-1">
                List your domains with zero friction • SEO-optimized pages • Time-boxed offers
              </p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Total Listings</p>
                <TrendingUp className="w-4 h-4 text-brand-400" />
              </div>
              <p className="text-2xl font-bold text-white">1,234</p>
              <p className="text-xs text-green-400 mt-1">+12% this week</p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Avg. Sale Price</p>
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-white">4.8 ETH</p>
              <p className="text-xs text-slate-400 mt-1">Across all domains</p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Success Rate</p>
                <CheckCircle className="w-4 h-4 text-accent" />
              </div>
              <p className="text-2xl font-bold text-white">87%</p>
              <p className="text-xs text-slate-400 mt-1">Domains sold</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'list'
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create New Listing
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'manage'
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Manage Listings
          </button>
        </div>

        {/* Create Listing Tab */}
        {activeTab === 'list' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Listing Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-6">List Your Domain</h2>

                {/* Domain Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Domain from Wallet
                    </label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => {
                        setSelectedDomain(e.target.value);
                        setCustomDomain('');
                      }}
                      disabled={!!customDomain}
                      className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                    >
                      <option value="">Select a domain...</option>
                      {userDomains.map((domain) => (
                        <option key={domain.tokenId} value={domain.name}>
                          {domain.name}.{domain.tld} (Est. {domain.value} ETH)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-slate-500">OR</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Enter Domain Manually
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customDomain}
                        onChange={(e) => {
                          setCustomDomain(e.target.value);
                          setSelectedDomain('');
                        }}
                        disabled={!!selectedDomain}
                        placeholder="yourdomain"
                        className="flex-1 px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                      />
                      <select
                        value={tld}
                        onChange={(e) => setTld(e.target.value)}
                        className="px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="eth">.eth</option>
                        <option value="ens">.ens</option>
                        <option value="xyz">.xyz</option>
                      </select>
                    </div>
                  </div>

                  {/* Listing Price */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Listing Price (ETH)
                    </label>
                    <input
                      type="number"
                      value={listingPrice}
                      onChange={(e) => setListingPrice(e.target.value)}
                      placeholder="0.0"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Listing Duration
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your domain, its history, potential uses..."
                      rows={4}
                      className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleCreateListing}
                    disabled={!isConnected || loading || (!selectedDomain && !customDomain) || !listingPrice}
                    className="w-full py-3 bg-gradient-to-r from-brand-500 to-accent text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? 'Creating Listing...' : 'Create Listing'}
                  </button>
                </div>
              </div>
            </div>

            {/* Info Panel */}
            <div className="space-y-6">
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Zero-Friction Benefits</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                    <span className="text-slate-300">
                      <strong className="text-white">SEO-Optimized Pages:</strong> Each domain gets its own indexed page
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                    <span className="text-slate-300">
                      <strong className="text-white">Time-Boxed Offers:</strong> Create urgency with expiring deals
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                    <span className="text-slate-300">
                      <strong className="text-white">XMTP Chat:</strong> Instant buyer-seller communication
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                    <span className="text-slate-300">
                      <strong className="text-white">Live Orderbook:</strong> Real-time bid/ask spreads
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-yellow-400 font-medium mb-1">Listing Fees</p>
                    <p className="text-slate-400">
                      2.5% platform fee on successful sales. No upfront listing costs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Platform Fee</span>
                  <span className="text-white">2.5%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Gas Estimate</span>
                  <span className="text-white">~0.002 ETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Time to List</span>
                  <span className="text-white">~15 seconds</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manage Listings Tab */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            {activeListings.length === 0 ? (
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-12 text-center">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">No active listings</p>
                <p className="text-sm text-slate-500 mt-2">
                  Create your first listing to start selling domains
                </p>
                <button
                  onClick={() => setActiveTab('list')}
                  className="mt-4 px-6 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 transition-colors"
                >
                  Create Listing
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{listing.domainName}</h3>
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-slate-500">Price: </span>
                            <span className="text-white font-medium">{formatEther(listing.price)} ETH</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-400">{listing.views} views</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Offers: </span>
                            <span className="text-white font-medium">{listing.offers}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-xs mt-3">
                          <div>
                            <span className="text-slate-500">Listed: </span>
                            <span className="text-slate-400">{listing.listedAt.toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Expires: </span>
                            <span className="text-yellow-400">{listing.expiresAt.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/domains/${listing.domainName.split('.')[0]}`}>
                          <button className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm">
                            View Page
                          </button>
                        </Link>
                        <button
                          onClick={() => handleCancelListing(listing.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
