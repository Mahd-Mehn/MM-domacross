"use client";

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Shield, TrendingUp, AlertTriangle, DollarSign, Percent } from 'lucide-react';
import { collateralService, CollateralPosition } from '@/lib/defi/collateralService';
import { useFractionalTokens } from '@/lib/hooks/useFractionalTokens';

export function CollateralPanel() {
  const { address, isConnected } = useAccount();
  const { data: tokensData } = useFractionalTokens();
  const tokens = tokensData?.tokens || [];

  const [selectedToken, setSelectedToken] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [positions, setPositions] = useState<CollateralPosition[]>([]);
  const [borrowingPower, setBorrowingPower] = useState<any>(null);

  const handleCalculateBorrowingPower = async () => {
    if (!selectedToken || !collateralAmount) return;

    const token = tokens.find(t => t.token_address === selectedToken);
    if (!token) return;

    const currentPrice = parseFloat(token.current_price_usd);
    const power = await collateralService.getBorrowingPower(
      selectedToken,
      collateralAmount,
      currentPrice
    );

    setBorrowingPower(power);
  };

  const handleDeposit = async () => {
    if (!selectedToken || !collateralAmount || !address) return;

    try {
      const position = await collateralService.depositCollateral(
        selectedToken,
        collateralAmount,
        address
      );
      setPositions([...positions, position]);
      setCollateralAmount('');
      alert('Collateral deposited successfully!');
    } catch (error) {
      alert('Failed to deposit collateral');
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-8">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Connect Wallet</h3>
          <p className="text-slate-400">Connect your wallet to use collateral features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deposit Collateral Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          Deposit Collateral
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select Fractional Token
            </label>
            <select
              value={selectedToken}
              onChange={(e) => {
                setSelectedToken(e.target.value);
                setBorrowingPower(null);
              }}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select a token...</option>
              {tokens.map((token) => (
                <option key={token.token_address} value={token.token_address}>
                  {token.domain_name} - ${parseFloat(token.current_price_usd).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Collateral Amount
            </label>
            <input
              type="number"
              value={collateralAmount}
              onChange={(e) => {
                setCollateralAmount(e.target.value);
                setBorrowingPower(null);
              }}
              placeholder="0.0"
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleCalculateBorrowingPower}
            disabled={!selectedToken || !collateralAmount}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Calculate Borrowing Power
          </button>

          {borrowingPower && (
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Borrowing Power</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Max Borrow (75% LTV)</p>
                  <p className="text-lg font-bold text-green-400">
                    ${borrowingPower.maxBorrowUSD}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Liquidation Price</p>
                  <p className="text-lg font-bold text-red-400">
                    ${borrowingPower.liquidationPrice}
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10">
                <button
                  onClick={handleDeposit}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold transition-colors"
                >
                  Deposit Collateral
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Borrow Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Borrow Against Collateral
        </h2>

        {positions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">No collateral positions yet</p>
            <p className="text-sm text-slate-500 mt-2">
              Deposit collateral above to start borrowing
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Borrow Amount (USD)
              </label>
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
              />
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Interest Rate</span>
                <span className="text-sm font-semibold text-white flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  5.0% APR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Liquidation Threshold</span>
                <span className="text-sm font-semibold text-white">75% LTV</span>
              </div>
            </div>

            <button
              disabled={!borrowAmount}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Borrow
            </button>
          </div>
        )}
      </div>

      {/* Active Positions */}
      {positions.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-yellow-400" />
            Your Positions
          </h2>

          <div className="space-y-4">
            {positions.map((position) => {
              const risk = collateralService.checkLiquidationRisk(position);
              return (
                <div
                  key={position.id}
                  className="bg-slate-900/50 rounded-lg p-4 border border-white/5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{position.domainName}</h3>
                      <p className="text-xs text-slate-400">
                        Position #{position.id.slice(-8)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                      risk.riskLevel === 'safe' ? 'bg-green-500/20 text-green-400' :
                      risk.riskLevel === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                      risk.riskLevel === 'danger' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {risk.riskLevel === 'safe' ? <Shield className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {risk.riskLevel.toUpperCase()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">Collateral</p>
                      <p className="font-semibold text-white">{position.collateralAmount} tokens</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Borrowed</p>
                      <p className="font-semibold text-white">${position.borrowedAmount}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Health Factor</p>
                      <p className="font-semibold text-white">
                        {position.healthFactor === Infinity ? '∞' : position.healthFactor.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Interest Rate</p>
                      <p className="font-semibold text-white">{position.interestRate}%</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                    <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded text-sm font-semibold transition-colors">
                      Repay
                    </button>
                    <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded text-sm font-semibold transition-colors">
                      Withdraw
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">How it works</h3>
        <ul className="text-xs text-slate-300 space-y-1">
          <li>• Deposit fractional domain tokens as collateral</li>
          <li>• Borrow up to 75% of your collateral value</li>
          <li>• Interest rate: 5% APR</li>
          <li>• Maintain health factor above 1.0 to avoid liquidation</li>
          <li>• Repay anytime to unlock your collateral</li>
        </ul>
      </div>
    </div>
  );
}
