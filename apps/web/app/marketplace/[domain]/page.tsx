import { DomainMarketPanel } from "../../../components/DomainMarketPanel";
import DisputeBanner from "../../components/DisputeBanner";
import ValuationTransparencyPanel from "../../components/ValuationTransparencyPanel";
import DomainMarketplace from "../../../components/marketplace/DomainMarketplace";

interface Props { 
  params: Promise<{ domain: string }> 
}

export default async function ConsolidatedDomainPage({ params }: Props) {
  const { domain } = await params;
  
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">
                {domain}
              </h1>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-400">Live Trading</span>
              </div>
            </div>
            <DisputeBanner domain={domain} />
          </div>

          {/* Enhanced Domain Trading Panel with Doma SDK Integration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Trading Interface */}
            <div className="lg:col-span-2">
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span>Direct Trading</span>
                  <span className="text-xs bg-brand-500/20 text-brand-300 px-2 py-1 rounded">Doma SDK</span>
                </h2>
                <DomainMarketplace />
              </div>
            </div>

            {/* Side Panel */}
            <div className="space-y-6">
              {/* Original Domain Market Panel */}
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Market Overview</h3>
                <DomainMarketPanel name={domain} />
              </div>

              {/* Quick Stats */}
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Floor Price</span>
                    <span className="text-white font-medium">5.2 ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">24h Volume</span>
                    <span className="text-white font-medium">12.8 ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Offers</span>
                    <span className="text-white font-medium">7</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Sale</span>
                    <span className="text-white font-medium">6h ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Valuation Transparency Panel */}
          <ValuationTransparencyPanel domain={domain} />

          {/* Trading Activity Feed */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {[
                { type: 'listing', price: '5.5 ETH', time: '2m ago', user: '0x1234...5678' },
                { type: 'offer', price: '4.8 ETH', time: '15m ago', user: '0x9876...4321' },
                { type: 'sale', price: '5.2 ETH', time: '1h ago', user: '0x5555...9999' }
              ].map((activity, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'sale' ? 'bg-green-400' : 
                      activity.type === 'listing' ? 'bg-blue-400' : 'bg-yellow-400'
                    }`}></div>
                    <span className="text-white capitalize">{activity.type}</span>
                    <span className="text-slate-400">{activity.user}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{activity.price}</div>
                    <div className="text-xs text-slate-400">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
