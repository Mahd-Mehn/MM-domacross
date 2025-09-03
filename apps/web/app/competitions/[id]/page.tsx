"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiJson, authHeader } from "../../../lib/api";
import TradingInterface from "../../../components/TradingInterface";
import DomainBasket from "../../../components/DomainBasket";
import USDCDeposit from "../../../components/USDCDeposit";

interface Competition {
  id: number;
  contract_address: string;
  chain_id: number;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  entry_fee?: string;
  leaderboard: LeaderboardEntry[];
}

interface LeaderboardEntry {
  user_id: number;
  wallet_address: string;
  username?: string;
  portfolio_value: string;
  rank: number;
}

export default function CompetitionDetailPage() {
  const params = useParams();
  const competitionId = params.id as string;
  const queryClient = useQueryClient();

  const { data: competition, isLoading, error } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => apiJson<Competition>(`/api/v1/competitions/${competitionId}`, {
      headers: authHeader(),
    }),
  });

  if (isLoading) return <div>Loading competition details...</div>;
  if (error) return <div>Error loading competition</div>;
  if (!competition) return <div>Competition not found</div>;

  const isActive = new Date() >= new Date(competition.start_time) &&
                   new Date() < new Date(competition.end_time);

  async function join() {
    await apiJson(`/api/v1/competitions/${competitionId}/join`, {
      method: "POST",
      headers: {
        ...authHeader(),
      },
    });
    await queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
  }

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{competition.name}</h1>
        {competition.description && (
          <p className="text-gray-600">{competition.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500">Status</div>
            <div className={`font-semibold ${isActive ? 'text-green-600' : 'text-gray-600'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500">Chain ID</div>
            <div className="font-semibold">{competition.chain_id}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500">Start Time</div>
            <div className="font-semibold">
              {new Date(competition.start_time).toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500">End Time</div>
            <div className="font-semibold">
              {new Date(competition.end_time).toLocaleString()}
            </div>
          </div>
        </div>

        {competition.entry_fee && (
          <div className="mt-4">
            <span className="text-lg font-semibold">Entry Fee: {competition.entry_fee} ETH</span>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>

        {competition.leaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Rank</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">User</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Wallet</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Portfolio Value</th>
                </tr>
              </thead>
              <tbody>
                {competition.leaderboard.map((entry) => (
                  <tr key={entry.user_id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-semibold">
                      #{entry.rank}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {entry.username || 'Anonymous'}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                      {entry.wallet_address.slice(0, 6)}...{entry.wallet_address.slice(-4)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {entry.portfolio_value} ETH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No participants yet.</p>
        )}
      </div>

      {isActive && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Join Competition</h2>
          <USDCDeposit
            competitionId={competitionId}
            contractAddress={competition.contract_address}
            entryFee={competition.entry_fee || "0.01"}
            isActive={isActive}
            hasJoined={false} // TODO: Check from API if user has joined
          />
        </div>
      )}

      {isActive && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Trading</h2>
          <TradingInterface competitionId={competitionId} isActive={isActive} />
        </div>
      )}

      {isActive && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Domain Baskets</h2>
          <DomainBasket competitionId={competitionId} isActive={isActive} />
        </div>
      )}

      {isActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Join This Competition</h3>
          <p className="text-gray-600 mb-4">
            Connect your wallet and join the competition to start trading domains!
          </p>
          <button onClick={join} className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
            Join Competition
          </button>
        </div>
      )}
    </main>
  );
}
