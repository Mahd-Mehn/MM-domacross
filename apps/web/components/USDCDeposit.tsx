"use client";

import { useState, useEffect } from "react";
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
    if (mintSuccess) {
      alert('USDC minted successfully!');
      setLoading(false);
    }
    if (joinSuccess) {
      alert('Successfully joined competition!');
      setLoading(false);
    }
  }, [mintSuccess, joinSuccess]);

  const handleMintUSDC = async () => {
    if (!address || !depositAmount) return;

    setLoading(true);
    try {
      await mint(address, parseUnits(depositAmount, 6).toString());
    } catch (error) {
      console.error('Error minting USDC:', error);
      alert('Failed to mint USDC');
      setLoading(false);
    }
  };

  const handleJoinCompetition = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      await joinCompetition(entryFee);
    } catch (error) {
      console.error('Error joining competition:', error);
      alert('Failed to join competition');
      setLoading(false);
    }
  };

  const usdcBalanceFormatted = usdcBalance ? formatUnits(usdcBalance.value, 6) : '0';
  const requiredAmount = parseFloat(entryFee) * 1.1; // Require 10% extra for gas and trading

  if (!address) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
        <p className="text-gray-600">
          Please connect your wallet to deposit USDC and join the competition.
        </p>
      </div>
    );
  }

  if (hasJoined) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">✅ Competition Joined</h3>
        <p className="text-gray-600">
          You have successfully joined this competition and can now start trading!
        </p>
        <div className="mt-4">
          <p className="text-sm text-gray-500">Your USDC Balance: {usdcBalanceFormatted} USDC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">Join Competition</h3>

      <div className="space-y-4">
        {/* USDC Balance */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Your USDC Balance:</span>
            <span className="font-semibold">{usdcBalanceFormatted} USDC</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">Entry Fee:</span>
            <span className="font-semibold">{entryFee} ETH</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">Recommended Deposit:</span>
            <span className="font-semibold text-blue-600">{requiredAmount.toFixed(2)} USDC</span>
          </div>
        </div>

        {/* Mint USDC Section */}
        {parseFloat(usdcBalanceFormatted) < requiredAmount && (
          <div className="border border-gray-200 rounded-lg p-4">
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
                className="flex-1 p-2 border border-gray-300 rounded"
                step="0.01"
              />
              <button
                onClick={handleMintUSDC}
                disabled={loading || mintPending || !depositAmount}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading || mintPending ? 'Minting...' : 'Mint USDC'}
              </button>
            </div>
          </div>
        )}

        {/* Join Competition Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold mb-2">Join Competition</h4>
          <p className="text-sm text-gray-600 mb-3">
            Pay the entry fee and start trading domains
          </p>

          {parseFloat(usdcBalanceFormatted) < parseFloat(entryFee) ? (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-600">
                Insufficient USDC balance. You need at least {entryFee} USDC to join.
              </p>
            </div>
          ) : (
            <button
              onClick={handleJoinCompetition}
              disabled={loading || joinPending || !isActive}
              className="w-full bg-green-500 text-white py-3 px-4 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold mb-2">Competition Rules</h4>
          <ul className="text-sm text-gray-600 space-y-1">
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
