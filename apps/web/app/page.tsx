import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const steps = [
  { title: 'Connect Wallet', desc: 'Link your Web3 wallet to get started' },
  { title: 'List or Trade', desc: 'Create SEO-optimized listings or trade futures' },
  { title: 'Leverage DeFi', desc: 'Use domains as collateral or trade with leverage' },
  { title: 'Win & Earn', desc: 'Compete in tournaments and earn from trades' }
];

const features = [
  { emoji: '🏆', title: 'Competitive Trading', desc: 'Time-bound competitions with dynamic leaderboards and prize pools.' },
  { emoji: '💰', title: 'Collateral Vaults', desc: 'Deposit domains as collateral to borrow funds with competitive APY rates.' },
  { emoji: '📈', title: 'Futures Trading', desc: 'Trade perpetual futures on domains with up to 20x leverage.' },
  { emoji: '📊', title: 'Professional Charts', desc: 'TradingView integration with advanced technical indicators.' },
  { emoji: '💬', title: 'XMTP Chat', desc: 'Instant buyer-seller communication with on-chain offer linking.' },
  { emoji: '🔍', title: 'SEO Domain Pages', desc: 'Each domain gets an indexed page for maximum visibility.' }
];

export default function Home(){
  return (
    <div className="space-y-32">
      {/* HERO */}
      <section className="relative hero-bg rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 shadow-[0_0_40px_-10px_rgba(var(--ds-accent-glow)/0.4)] transition-colors">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_50%,rgba(123,92,255,0.35),transparent_60%)] dark:bg-[radial-gradient(circle_at_30%_50%,rgba(123,92,255,0.4),transparent_60%)]" />
        <div className="relative px-6 md:px-16 py-32 text-center max-w-5xl mx-auto">
          <Badge variant="info" glow className="mb-6">Cross-Chain Domain Trading Arena</Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-8 gradient-text">
            Trade Domains. Leverage DeFi. Dominate Markets.
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-10 transition-colors">
            DomaCross is the first platform combining domain trading competitions with advanced DeFi features. Trade futures, use domains as collateral, and compete for prizes - all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/marketplace"><Button size="lg" className="shadow-glow" shimmer>Explore Marketplace</Button></Link>
            <Link href="/defi"><Button size="lg" variant="outline">DeFi Trading Suite</Button></Link>
            <Link href="/competitions"><Button size="lg" variant="ghost">Join Competition</Button></Link>
          </div>
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
            {steps.map((s,i)=> (
              <div key={s.title} className="rounded-xl p-5 relative backdrop-blur-md border border-slate-300/50 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/60 shadow-glow transition-colors">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-300 text-xs font-semibold">{i+1}</span> Step</div>
                <div className="font-semibold text-slate-800 dark:text-white mb-1 tracking-tight transition-colors">{s.title}</div>
                <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed transition-colors">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section>
        <div className="max-w-6xl mx-auto px-2 md:px-0">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4">Why Choose <span className="gradient-text">DomaCross</span>?</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto transition-colors">Purpose-built for speed, strategy and composability across domain economies.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map(f => (
              <Card key={f.title} className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/60 shadow-glow transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500/30 to-accent/30 flex items-center justify-center text-2xl">
                    {f.emoji}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="mb-2">{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative rounded-3xl overflow-hidden border border-slate-300/40 dark:border-white/10 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-24 px-6 md:px-16 transition-colors">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(29,117,255,0.25),transparent_60%)] dark:bg-[radial-gradient(circle_at_70%_30%,rgba(29,117,255,0.35),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 tracking-tight text-slate-800 dark:text-white transition-colors">Ready to Start Trading?</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg mb-10 transition-colors">Enter the arena, execute high-conviction domain plays, and capture the upside.</p>
            <Link href="/competitions"><Button size="lg" className="shadow-glow" shimmer>Get Started</Button></Link>
        </div>
      </section>
    </div>
  );
}
