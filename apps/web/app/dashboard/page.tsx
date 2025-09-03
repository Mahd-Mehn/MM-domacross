"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson, authHeader } from "../../lib/api";

interface UserPortfolio {
  total_value: string;
  competitions_participating: number;
  domains_owned: number;
}

interface Competition {
  id: number;
  name: string;
  status: string;
  portfolio_value: string;
  rank?: number;
}

export default function DashboardPage() {
  // Mock data for now - in a real app, this would come from the API
  const mockPortfolio: UserPortfolio = {
    total_value: "2.5",
    competitions_participating: 1,
    domains_owned: 3,
  };

  const mockCompetitions: Competition[] = [
    {
      id: 1,
      name: "Q3 Domain Championship",
      status: "active",
      portfolio_value: "1.2",
      rank: 5,
    },
  ];

  return (
    <main>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-2">Total Portfolio Value</h3>
          <p className="text-3xl font-bold text-green-600">{mockPortfolio.total_value} ETH</p>
        </div>

        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-2">Active Competitions</h3>
          <p className="text-3xl font-bold text-blue-600">{mockPortfolio.competitions_participating}</p>
        </div>

        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-2">Domains Owned</h3>
          <p className="text-3xl font-bold text-purple-600">{mockPortfolio.domains_owned}</p>
        </div>
      </div>

      {/* Active Competitions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Your Competitions</h2>

        {mockCompetitions.length > 0 ? (
          <div className="space-y-4">
            {mockCompetitions.map((competition) => (
              <div key={competition.id} className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{competition.name}</h3>
                    <span className={`inline-block px-2 py-1 rounded text-sm ${
                      competition.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {competition.status}
                    </span>
                  </div>
                  {competition.rank && (
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Current Rank</div>
                      <div className="text-2xl font-bold">#{competition.rank}</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Portfolio Value</div>
                    <div className="text-lg font-semibold">{competition.portfolio_value} ETH</div>
                  </div>
                  <div>
                    <button className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border rounded-lg p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">No Active Competitions</h3>
            <p className="text-gray-600 mb-4">
              Join a competition to start trading domains and building your portfolio!
            </p>
            <a
              href="/competitions"
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 inline-block"
            >
              Browse Competitions
            </a>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <p className="text-gray-500">No recent activity yet. Start trading to see your history here!</p>
        </div>
      </div>
    </main>
  );
}
