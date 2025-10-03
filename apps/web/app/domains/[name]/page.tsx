"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { formatEther, parseEther } from 'viem';
import { useAccount, useWalletClient } from 'wagmi';
import Head from 'next/head';
import { Clock, MessageCircle, TrendingUp, AlertCircle, Eye } from 'lucide-react';
import { useOrderbookSdk } from '../../../lib/orderbook/client';
import { XMTPChat } from '../../../components/XMTPChat';

interface DomainData {
  name: string;
  owner: string;
  price: string;
  tokenId: string;
  contract: string;
  lastSale?: string;
  views?: number;
  offers?: any[];
  priceHistory?: { date: string; price: string }[];
  description?: string;
  attributes?: Record<string, any>;
}

interface TimedOffer {
  id: string;
  offerer: string;
  amount: string;
  expiresAt: number;
  message?: string;
  status: 'active' | 'expired' | 'accepted' | 'rejected';
}

export default function DomainDealPage() {
  const params = useParams();
  const domainName = params.name as string;
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { createListing, buyListing, createOffer: sdkCreateOffer, acceptOffer, hasSigner } = useOrderbookSdk();
  
  const [domain, setDomain] = useState<DomainData | null>(null);
  const [offers, setOffers] = useState<TimedOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'offers' | 'history'>('overview');
  const [showChat, setShowChat] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerDuration, setOfferDuration] = useState('24'); // hours
  const [offerMessage, setOfferMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | undefined>();
  const [recipientAddress, setRecipientAddress] = useState<string | undefined>();
  const [transactionLoading, setTransactionLoading] = useState(false);

  // Fetch domain data
  useEffect(() => {
    fetchDomainData();
    fetchOffers();
  }, [domainName]);

  const fetchDomainData = async () => {
    try {
      // Fetch from orderbook API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/domains/${domainName}`);
      if (response.ok) {
        const data = await response.json();
        setDomain(data);
      }
    } catch (error) {
      console.error('Error fetching domain:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/domains/${domainName}/offers`);
      if (response.ok) {
        const data = await response.json();
        setOffers(data);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  const handleMakeOffer = async () => {
    if (!address || !offerAmount || !hasSigner || !domain?.contract || !domain?.tokenId) return;
    
    setTransactionLoading(true);
    try {
      const expiresAt = Date.now() + (parseInt(offerDuration) * 60 * 60 * 1000);
      
      // Use Doma SDK to create the offer
      const result = await sdkCreateOffer({
        contract: domain.contract,
        tokenId: domain.tokenId,
        price: parseEther(offerAmount).toString()
      }, (step: string, progress: number) => {
        console.log(`Creating offer: ${step} (${progress}%)`);
      });

      if (result) {
        // Also save to backend for tracking
        await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/domains/${domainName}/offers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offerer: address,
            amount: parseEther(offerAmount).toString(),
            expiresAt,
            message: offerMessage,
            txHash: (result as any)?.transactionHash || (result as any)?.hash || '', // Link to on-chain transaction
          }),
        });

        await fetchOffers();
        setOfferAmount('');
        setOfferMessage('');
      }
    } catch (error) {
      console.error('Error making offer:', error);
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleBuyDomain = async (listingId: string) => {
    if (!hasSigner || !domain?.contract || !domain?.tokenId || !domain?.price) return;
    
    setTransactionLoading(true);
    try {
      // Use Doma SDK to buy the listing
      const result = await buyListing(listingId);
      console.log('Buying domain...');

      if (result) {
        // Refresh domain data
        await fetchDomainData();
        alert('Domain purchased successfully!');
      }
    } catch (error) {
      console.error('Error buying domain:', error);
      alert('Failed to purchase domain. Please try again.');
    } finally {
      setTransactionLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt: number) => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // SEO Meta Tags
  const pageTitle = `${domainName} - Domain Deal | DomaCross`;
  const pageDescription = `Trade ${domainName} domain on DomaCross. View live orderbook, make time-boxed offers, and connect with sellers instantly via secure chat.`;
  const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/domains/${domainName}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_BASE_URL}/api/og/${domainName}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": domainName,
            "description": pageDescription,
            "url": canonicalUrl,
            "offers": {
              "@type": "Offer",
              "price": domain?.price || "0",
              "priceCurrency": "ETH",
              "availability": "https://schema.org/InStock"
            }
          })}
        </script>
      </Head>

      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-brand-300 to-accent bg-clip-text text-transparent">{domainName}</h1>
                <p className="text-slate-400 mb-4">{domain?.description}</p>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {domain?.views || 0} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {offers.filter(o => o.status === 'active').length} active offers
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{domain?.price ? formatEther(BigInt(domain.price)) : '0'} ETH</p>
                {domain?.lastSale && (
                  <p className="text-sm text-slate-500">Last sale: {formatEther(BigInt(domain.lastSale))} ETH</p>
                )}
                {domain?.price && address !== domain?.owner && (
                  <button
                    onClick={() => handleBuyDomain('listing-1')}
                    disabled={!isConnected || transactionLoading}
                    className="mt-3 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {transactionLoading ? 'Processing...' : 'Buy Now'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10">
            <div className="border-b border-white/10">
              <div className="flex gap-6 px-6">
                <button
                  className={`py-4 px-2 border-b-2 ${activeTab === 'overview' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
                <button
                  className={`py-4 px-2 border-b-2 ${activeTab === 'offers' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400'}`}
                onClick={() => setActiveTab('offers')}
              >
                Offers ({offers.length})
              </button>
                <button
                  className={`py-4 px-2 border-b-2 ${activeTab === 'history' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400'}`}
                onClick={() => setActiveTab('history')}
              >
                Price History
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-white">About this domain</h3>
                  <p className="text-slate-400">
                    {domain?.description || `${domainName} is a premium domain available for trading on the Doma protocol.`}
                  </p>
                </div>

                {/* Quick Offer Form */}
                <div className="border border-white/10 rounded-lg p-4 bg-slate-800/50">
                  <h3 className="text-lg font-semibold mb-3 text-white">Make a Time-Boxed Offer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="number"
                      placeholder="Offer amount (ETH)"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      className="px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <select
                      value={offerDuration}
                      onChange={(e) => setOfferDuration(e.target.value)}
                      className="px-4 py-2 bg-slate-700/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="1">1 hour</option>
                      <option value="6">6 hours</option>
                      <option value="12">12 hours</option>
                      <option value="24">24 hours</option>
                      <option value="48">48 hours</option>
                      <option value="72">72 hours</option>
                    </select>
                    <button
                      onClick={handleMakeOffer}
                      disabled={!isConnected || !offerAmount}
                      className="w-full mt-3 bg-gradient-to-r from-brand-500 to-accent text-white px-6 py-2 rounded-lg hover:opacity-90 disabled:bg-gray-600"
                    >
                      Make Offer
                    </button>
                  </div>
                  <textarea
                    placeholder="Add a message (optional)"
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    className="col-span-1 md:col-span-3 px-4 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    rows={2}
                  />
                </div>

                {/* Live Orderbook Preview */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-white">Live Orderbook</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-green-400 mb-2">Bids</h4>
                      <div className="space-y-1">
                        {/* Placeholder for bids */}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">0.5 ETH</span>
                          <span className="text-slate-500">2 hours left</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-400 mb-2">Asks</h4>
                      <div className="space-y-1">
                        {/* Placeholder for asks */}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">{domain?.price ? formatEther(BigInt(domain.price)) : '0'} ETH</span>
                          <span className="text-slate-500">Listed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Offers Tab */}
            {activeTab === 'offers' && (
              <div className="space-y-4">
                {offers.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No offers yet. Be the first!</p>
                ) : (
                  offers.map((offer) => (
                    <div key={offer.id} className="border border-white/10 rounded-lg p-4 hover:bg-slate-800/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-white">{formatEther(BigInt(offer.amount))} ETH</p>
                          <p className="text-sm text-slate-400">From: {offer.offerer.slice(0, 6)}...{offer.offerer.slice(-4)}</p>
                          {offer.message && <p className="text-sm mt-2 text-slate-300">{offer.message}</p>}
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            offer.status === 'active' ? 'bg-green-500/20 text-green-400' : 
                            offer.status === 'expired' ? 'bg-gray-500/20 text-gray-400' :
                            offer.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {offer.status}
                          </span>
                          {offer.status === 'active' && (
                            <p className="text-sm text-slate-500 mt-1">
                              <Clock className="inline w-3 h-3 mr-1" />
                              {formatTimeRemaining(offer.expiresAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      {offer.status === 'active' && address === offer.offerer && (
                        <button
                          onClick={() => setShowChat(true)}
                          className="mt-3 flex items-center gap-1 text-brand-400 hover:text-brand-300 text-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Open Chat
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <p className="text-slate-500 text-center py-8">Price history coming soon...</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Button */}
        <button
          onClick={() => {
            setShowChat(!showChat);
            setRecipientAddress(domain?.owner);
          }}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700"
        >
          <MessageCircle className="w-6 h-6" />
        </button>

        {/* XMTP Chat */}
        {showChat && recipientAddress && (
          <XMTPChat
            domainName={domainName}
            offerId={selectedOfferId}
            recipientAddress={recipientAddress}
          />
        )}
      </div>
      </div>
    </>
  );
}
