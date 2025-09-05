"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { viemToEthersSigner, DomaOrderbookError } from "@doma-protocol/orderbook-sdk";
import { orderbookClient } from "../lib/orderbookClient";
import { usePersistBuy } from "../lib/hooks/useMarketplaceActions";
import { useDomainBasket, useTransactionConfirmation } from "../lib/hooks/useContracts";

interface Domain {
  id: string;
  name: string;
  price: string;
  contract: string;
  tokenId: string;
}

interface Basket {
  id: string;
  name: string;
  description: string;
  domains: Domain[];
  totalValue: string;
  creator: string;
  createdAt: string;
}

interface DomainBasketProps {
  competitionId: string;
  isActive: boolean;
}

export default function DomainBasket({ competitionId, isActive }: DomainBasketProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Purchase state for demo buy flow
  const [purchasingBasketId, setPurchasingBasketId] = useState<string | undefined>(undefined);
  const [purchaseStep, setPurchaseStep] = useState<string | undefined>(undefined);
  const [purchaseProgress, setPurchaseProgress] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'market'>('create');
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [userBaskets, setUserBaskets] = useState<Basket[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);
  const [basketName, setBasketName] = useState('');
  const [basketDescription, setBasketDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    createBasket,
    buyBasket,
    hash: basketHash,
    isPending: basketPending
  } = useDomainBasket();

  const { isSuccess: txSuccess } = useTransactionConfirmation(basketHash);
  const persistBuy = usePersistBuy();

  // Mock data for demonstration
  useEffect(() => {
    setBaskets([
      {
        id: '1',
        name: 'Tech Startup Bundle',
        description: 'Collection of premium tech domain names',
        domains: [
          { id: '1', name: 'startup.io', price: '500', contract: '0xabc...', tokenId: '1' },
          { id: '2', name: 'tech.dev', price: '300', contract: '0xdef...', tokenId: '2' },
        ],
        totalValue: '800',
        creator: '0x123...',
        createdAt: '2024-01-15',
      },
      {
        id: '2',
        name: 'Finance Domains',
        description: 'Premium finance and banking domain names',
        domains: [
          { id: '3', name: 'finance.pro', price: '750', contract: '0xghi...', tokenId: '3' },
          { id: '4', name: 'banking.net', price: '600', contract: '0xjkl...', tokenId: '4' },
        ],
        totalValue: '1350',
        creator: '0x456...',
        createdAt: '2024-01-14',
      },
    ]);

    setUserBaskets([
      {
        id: '3',
        name: 'My Tech Portfolio',
        description: 'My personal tech domain collection',
        domains: [
          { id: '5', name: 'mytech.com', price: '1000', contract: '0xmno...', tokenId: '5' },
        ],
        totalValue: '1000',
        creator: 'current_user',
        createdAt: '2024-01-16',
      },
    ]);
  }, []);

  // Handle transaction success
  useEffect(() => {
    if (txSuccess) {
      alert('Transaction completed successfully!');
      setBasketName('');
      setBasketDescription('');
      setSelectedDomains([]);
      setLoading(false);
    }
  }, [txSuccess]);

  const availableDomains: Domain[] = [
    { id: '1', name: 'startup.io', price: '500', contract: '0xabc...', tokenId: '1' },
    { id: '2', name: 'tech.dev', price: '300', contract: '0xdef...', tokenId: '2' },
    { id: '3', name: 'finance.pro', price: '750', contract: '0xghi...', tokenId: '3' },
    { id: '4', name: 'banking.net', price: '600', contract: '0xjkl...', tokenId: '4' },
    { id: '5', name: 'mytech.com', price: '1000', contract: '0xmno...', tokenId: '5' },
  ];

  const toggleDomainSelection = (domain: Domain) => {
    setSelectedDomains(prev =>
      prev.find(d => d.id === domain.id)
        ? prev.filter(d => d.id !== domain.id)
        : [...prev, domain]
    );
  };

  const handleCreateBasket = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    if (!basketName.trim() || selectedDomains.length === 0) {
      alert('Please provide a basket name and select at least one domain');
      return;
    }

    setLoading(true);
    try {
      const domainContracts = selectedDomains.map(d => d.contract);
      const tokenIds = selectedDomains.map(d => d.tokenId);

      await createBasket(
        basketName,
        basketDescription,
        domainContracts,
        tokenIds
      );
    } catch (error) {
      console.error('Error creating basket:', error);
      alert('Failed to create basket');
      setLoading(false);
    }
  };

  const handleBuyBasket = async (basketId: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }
    // Demo purchase flow using Doma Orderbook SDK
    setLoading(true);
    try {
      // Ensure wallet client is available
      if (!walletClient) {
        alert('Wallet client not available. Please reconnect your wallet.');
        setLoading(false);
        return;
      }

      // Use singleton SDK client configured in lib/orderbookClient
      if (!orderbookClient) {
        alert('Orderbook client not configured. Set NEXT_PUBLIC_DOMA_API_URL.');
        setLoading(false);
        return;
      }

      // Convert Viem wallet client to an Ethers signer the SDK expects
      const signer = viemToEthersSigner(walletClient, 'eip155:1');

      // For the demo we treat `basketId` as an orderId placeholder.
      // In a production flow the orderId should come from the marketplace listing metadata.
      const orderId = basketId;

      setPurchasingBasketId(basketId);
      setPurchaseStep('start');

  const result = await (orderbookClient as any).buyListing({
        params: {
          orderId,
        },
        signer,
        chainId: 'eip155:1',
        onProgress: ((step: string, progress: number) => {
          setPurchaseStep(step);
          setPurchaseProgress(progress);
        }) as any,
      });

      console.log('Buy result:', result);
  // Persist buy to backend using existing flow
  await persistBuy.mutateAsync({ orderId, domain: undefined, price: undefined });
  alert('Purchase completed.');
      setPurchasingBasketId(undefined);
      setPurchaseProgress(0);
      setPurchaseStep(undefined);
      setLoading(false);
    } catch (err: any) {
      console.error('Error buying basket:', err);
      if (err instanceof DomaOrderbookError) {
        alert(`Purchase failed: ${err.message} (${err.code})`);
      } else {
        alert('Failed to purchase basket');
      }
      setPurchasingBasketId(undefined);
      setPurchaseProgress(0);
      setPurchaseStep(undefined);
      setLoading(false);
    }
  };

  const calculateTotalValue = (domains: Domain[]) => {
    return domains.reduce((total, domain) => total + parseFloat(domain.price), 0).toString();
  };

  if (!isActive) {
    return (
      <div className="rounded-lg p-8 text-center border border-slate-300/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/40 backdrop-blur transition-colors">
        <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Domain Baskets Not Available</h3>
        <p className="text-slate-600 dark:text-slate-400">Domain basket creation and trading is only available during active competition periods.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300/60 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/60 shadow-glow transition-colors">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200/60 dark:border-slate-700/60">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'create'
                ? 'border-blue-500 text-blue-600 dark:text-blue-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Create Basket
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'manage'
                ? 'border-blue-500 text-blue-600 dark:text-blue-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            My Baskets
          </button>
          <button
            onClick={() => setActiveTab('market')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'market'
                ? 'border-blue-500 text-blue-600 dark:text-blue-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Basket Market
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'create' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">Create Domain Basket</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Basket Name</label>
              <input
                type="text"
                value={basketName}
                onChange={(e) => setBasketName(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white/80 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                placeholder="e.g., Tech Startup Bundle"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Description</label>
              <textarea
                value={basketDescription}
                onChange={(e) => setBasketDescription(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white/80 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                rows={3}
                placeholder="Describe your basket..."
              />
            </div>

            <div className="mb-6">
              <h4 className="text-md font-semibold mb-3">Select Domains</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableDomains.map((domain) => (
                  <div
                    key={domain.id}
                    className={`p-4 border rounded-lg cursor-pointer ${
                      selectedDomains.find(d => d.id === domain.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white/80 dark:bg-slate-800/50'
                    } transition-colors`}
                    onClick={() => toggleDomainSelection(domain)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-slate-800 dark:text-slate-100">{domain.name}</h5>
                        <p className="text-sm text-slate-600 dark:text-slate-400">${domain.price}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedDomains.some(d => d.id === domain.id)}
                        onChange={() => toggleDomainSelection(domain)}
                        className="w-4 h-4 text-blue-600 dark:text-blue-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedDomains.length > 0 && (
              <div className="mb-6 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 transition-colors">
                <h4 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Selected Domains ({selectedDomains.length})</h4>
                <div className="space-y-2 text-slate-700 dark:text-slate-300">
                  {selectedDomains.map((domain) => (
                    <div key={domain.id} className="flex justify-between">
                      <span>{domain.name}</span>
                      <span>${domain.price}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-100">
                    <span>Total Value:</span>
                    <span>${calculateTotalValue(selectedDomains)}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleCreateBasket}
              disabled={loading || basketPending || !basketName.trim() || selectedDomains.length === 0}
              className="w-full bg-emerald-600 dark:bg-emerald-500 text-white py-3 px-4 rounded hover:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading || basketPending ? 'Creating Basket...' : 'Create Basket'}
            </button>
          </div>
        )}

        {activeTab === 'manage' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">My Domain Baskets</h3>
            <div className="space-y-4">
              {userBaskets.map((basket) => (
                <div key={basket.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{basket.name}</h4>
                    <span className="text-lg font-bold text-green-600">${basket.totalValue}</span>
                  </div>
                  <p className="text-gray-600 mb-3">{basket.description}</p>
                  <div className="text-sm text-gray-500 mb-3">
                    Created: {new Date(basket.createdAt).toLocaleDateString()}
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-medium">Domains ({basket.domains.length}):</h5>
                    {basket.domains.map((domain) => (
                      <div key={domain.id} className="flex justify-between text-sm">
                        <span>{domain.name}</span>
                        <span>${domain.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                      Edit Basket
                    </button>
                    <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                      Delete Basket
                    </button>
                  </div>
                </div>
              ))}
              {userBaskets.length === 0 && (
                <p className="text-gray-500 text-center py-8">No baskets created yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Available Domain Baskets</h3>
            <div className="space-y-4">
              {baskets.map((basket) => (
                <div key={basket.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{basket.name}</h4>
                    <span className="text-lg font-bold text-green-600">${basket.totalValue}</span>
                  </div>
                  <p className="text-gray-600 mb-3">{basket.description}</p>
                  <div className="text-sm text-gray-500 mb-3">
                    Creator: {basket.creator} | Created: {new Date(basket.createdAt).toLocaleDateString()}
                  </div>
                  <div className="space-y-1 mb-4">
                    <h5 className="font-medium">Domains ({basket.domains.length}):</h5>
                    {basket.domains.map((domain) => (
                      <div key={domain.id} className="flex justify-between text-sm">
                        <span>{domain.name}</span>
                        <span>${domain.price}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleBuyBasket(basket.id)}
                    disabled={loading || basketPending || purchasingBasketId === basket.id}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {purchasingBasketId === basket.id ? `Buying... (${purchaseProgress}%)` : (loading || basketPending ? 'Buying...' : 'Buy Basket')}
                  </button>
                  {purchasingBasketId === basket.id && (
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Step: {purchaseStep || 'starting'} — {purchaseProgress}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
