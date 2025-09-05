"use client";

import { useState, useEffect } from "react";
import { useToasts } from "./ToastProvider";
import { useAccount, useBalance } from "wagmi";
import { useMockUSDC, useCompetition, useTransactionConfirmation } from "../lib/hooks/useContracts";
import { parseUnits, formatUnits } from "viem";

interface USDCDepositProps {
  competitionId: string;
  contractAddress: string;
  entryFee: string;
  isActive: boolean;
  hasJoined: boolean;
}

export default function USDCDeposit({
  competitionId,
  contractAddress,
  entryFee,
  isActive,
  hasJoined
}: USDCDepositProps) {
  const { address } = useAccount();
  const toasts = useToasts();
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: usdcBalance } = useBalance({
    address,
    token: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // Mock USDC address
  });

  const { mint, hash: mintHash, isPending: mintPending } = useMockUSDC();
  const { joinCompetition, hash: joinHash, isPending: joinPending } = useCompetition(contractAddress);

  const { isSuccess: mintSuccess } = useTransactionConfirmation(mintHash);
  const { isSuccess: joinSuccess } = useTransactionConfirmation(joinHash);

  // Handle successful transactions
  useEffect(() => {
  if (mintSuccess) { toasts.push('USDC minted', 'success'); setLoading(false); }
  if (joinSuccess) { toasts.push('On-chain join tx confirmed', 'success'); setLoading(false); }
  }, [mintSuccess, joinSuccess]);

  const handleMintUSDC = async () => {
    if (!address || !depositAmount) return;

    setLoading(true);
    try {
      await mint(address, parseUnits(depositAmount, 6).toString());
    } catch (error) {
  console.error('Error minting USDC:', error);
  toasts.push('Mint failed', 'error');
      setLoading(false);
    }
  };

  const handleJoinCompetition = async () => {
    if (!address) {
  toasts.push('Connect wallet first', 'error');
      return;
    }

    setLoading(true);
    try {
      await joinCompetition(entryFee);
    } catch (error) {
  console.error('Error joining competition:', error);
  toasts.push('Join tx failed', 'error');
      setLoading(false);
    }
  };

  const usdcBalanceFormatted = usdcBalance ? formatUnits(usdcBalance.value, 6) : '0';
  const requiredAmount = parseFloat(entryFee) * 1.1; // Require 10% extra for gas and trading

  if (!address) {
    return (
      <div className="rounded-lg p-6 text-center border border-amber-300/60 dark:border-amber-400/30 bg-amber-100/80 dark:bg-amber-400/10 backdrop-blur transition-colors">
        <h3 className="text-lg font-semibold mb-2 text-amber-900 dark:text-amber-200">Connect Wallet</h3>
        <p className="text-amber-800/80 dark:text-amber-200/80 text-sm">
          Please connect your wallet to deposit USDC and join the competition.
        </p>
      </div>
    );
  }

  if (hasJoined) {
    return (
      <div className="rounded-lg p-6 text-center border border-emerald-300/60 dark:border-emerald-500/40 bg-emerald-100/80 dark:bg-emerald-500/10 backdrop-blur transition-colors">
        <h3 className="text-lg font-semibold mb-2 text-emerald-900 dark:text-emerald-300 flex items-center justify-center gap-2">✅ <span>Competition Joined</span></h3>
        <p className="text-emerald-900/80 dark:text-emerald-200/80 text-sm">
          You have successfully joined this competition and can now start trading!
        </p>
        <div className="mt-4">
          <p className="text-sm text-emerald-800 dark:text-emerald-300/80">Your USDC Balance: {usdcBalanceFormatted} USDC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6 border border-slate-300/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/70 backdrop-blur shadow-glow transition-colors">
      <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100 transition-colors">Join Competition</h3>

      <div className="space-y-4">
        {/* USDC Balance */}
        <div className="p-4 rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Your USDC Balance:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{usdcBalanceFormatted} USDC</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Entry Fee:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{entryFee} ETH</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Recommended Deposit:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{requiredAmount.toFixed(2)} USDC</span>
          </div>
        </div>

        {/* Mint USDC Section */}
        {parseFloat(usdcBalanceFormatted) < requiredAmount && (
          <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-lg p-4 bg-white/70 dark:bg-slate-900/40 transition-colors">
            <h4 className="font-semibold mb-2">Get Test USDC</h4>
            <p className="text-sm text-gray-600 mb-3">
              Mint test USDC tokens for this competition
            </p>
            <div className="flex space-x-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Amount to mint"
                className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded bg-white/80 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                step="0.01"
              />
              <button
                onClick={handleMintUSDC}
                disabled={loading || mintPending || !depositAmount}
                className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-500 dark:hover:bg-blue-400 disabled:opacity-50 transition-colors"
              >
                {loading || mintPending ? 'Minting...' : 'Mint USDC'}
              </button>
            </div>
          </div>
        )}

        {/* Join Competition Section */}
  <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-lg p-4 bg-white/70 dark:bg-slate-900/40 transition-colors">
          <h4 className="font-semibold mb-2">Join Competition</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 transition-colors">
            Pay the entry fee and start trading domains
          </p>

          {parseFloat(usdcBalanceFormatted) < parseFloat(entryFee) ? (
            <div className="bg-red-100/70 dark:bg-red-500/10 border border-red-300 dark:border-red-500/40 rounded p-3 transition-colors">
              <p className="text-sm text-red-700 dark:text-red-400">
                Insufficient USDC balance. You need at least {entryFee} USDC to join.
              </p>
            </div>
          ) : (
            <button
              onClick={handleJoinCompetition}
              disabled={loading || joinPending || !isActive}
              className="w-full bg-emerald-600 dark:bg-emerald-500 text-white py-3 px-4 rounded hover:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading || joinPending
                ? 'Joining Competition...'
                : isActive
                  ? `Join Competition (${entryFee} ETH)`
                  : 'Competition Not Active'
              }
            </button>
          )}
        </div>

        {/* Competition Rules */}
  <div className="rounded-lg p-4 border border-blue-300/60 dark:border-blue-500/40 bg-blue-100/70 dark:bg-blue-500/10 backdrop-blur transition-colors">
          <h4 className="font-semibold mb-2">Competition Rules</h4>
          <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 transition-colors">
            <li>• Pay entry fee to join the competition</li>
            <li>• Trade domains using your USDC balance</li>
            <li>• Competition runs for the specified duration</li>
            <li>• Winner takes the prize pool and remaining domains</li>
            <li>• All trading happens on-chain</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
