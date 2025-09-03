"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiJson, authHeader } from "../../lib/api";

interface Competition {
  id: number;
  contract_address: string;
  chain_id: number;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  entry_fee?: string;
}

export default function CompetitionsPage() {
  const { data: competitions, isLoading, error } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => apiJson<Competition[]>("/api/v1/competitions", {
      headers: authHeader(),
    }),
  });

  if (isLoading) return <div>Loading competitions...</div>;
  if (error) return <div>Error loading competitions</div>;

  return (
    <main>
      <h1 className="text-3xl font-bold mb-6">Domain Trading Competitions</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {competitions?.map((competition) => (
          <div key={competition.id} className="border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">{competition.name}</h2>
            {competition.description && (
              <p className="text-gray-600 mb-4">{competition.description}</p>
            )}

            <div className="space-y-2 text-sm">
              <div>Chain ID: {competition.chain_id}</div>
              <div>Start: {new Date(competition.start_time).toLocaleString()}</div>
              <div>End: {new Date(competition.end_time).toLocaleString()}</div>
              {competition.entry_fee && (
                <div>Entry Fee: {competition.entry_fee} ETH</div>
              )}
            </div>

            <Link
              href={`/competitions/${competition.id}`}
              className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              View Details
            </Link>
          </div>
        ))}

        {competitions?.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500">No competitions available yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
