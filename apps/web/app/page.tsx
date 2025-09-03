import Link from "next/link";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

const steps = [
  { title: 'Connect Wallet', desc: 'Link your Web3 wallet to get started' },
  { title: 'Join Competition', desc: 'Choose a competition and pay the entry fee' },
  { title: 'Trade Domains', desc: 'Buy and sell tokenized domains strategically' },
  { title: 'Win Prizes', desc: 'Top performers share the prize pool' }
];

const features = [
  { emoji: '🏆', title: 'Competitive Trading', desc: 'Time-bound competitions with dynamic leaderboards and prize pools.' },
  { emoji: '🌐', title: 'Cross-Chain Support', desc: 'Seamless multi-chain domain trading powered by Doma infrastructure.' },
  { emoji: '📊', title: 'Advanced Analytics', desc: 'Granular performance metrics, historical actions and valuation trends.' }
];

export default function Home(){
  return (
    <div className="space-y-32">
      {/* HERO */}
      <section className="relative hero-bg rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_40px_-10px_rgba(29,117,255,0.4)]">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_50%,rgba(123,92,255,0.4),transparent_60%)]" />
        <div className="relative px-6 md:px-16 py-32 text-center max-w-5xl mx-auto">
          <Badge variant="info" glow className="mb-6">Cross-Chain Domain Trading Arena</Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-8 gradient-text">
            Compete. Strategize. Dominate Domains.
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-10">
            DomaCross turns decentralized domain trading into a real-time competitive sport. Prove your edge across chains, optimize portfolio velocity, and rise to the top.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/competitions"><Button size="lg" className="shadow-glow" shimmer>Browse Competitions</Button></Link>
            <Link href="/dashboard"><Button size="lg" variant="outline">View Dashboard</Button></Link>
            <Link href="/strategies"><Button size="lg" variant="ghost">Strategy Sharing</Button></Link>
          </div>
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
            {steps.map((s,i)=> (
              <div key={s.title} className="glass-dark rounded-xl p-5 relative">
                <div className="text-sm text-slate-400 mb-2 flex items-center gap-2"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold">{i+1}</span> Step</div>
                <div className="font-semibold text-white mb-1 tracking-tight">{s.title}</div>
                <div className="text-slate-400 text-sm leading-relaxed">{s.desc}</div>
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
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Purpose-built for speed, strategy and composability across domain economies.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map(f => (
              <Card key={f.title} className="glass-dark">
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
      <section className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-24 px-6 md:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(29,117,255,0.35),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 tracking-tight">Ready to Start Trading?</h2>
            <p className="text-slate-400 text-lg mb-10">Enter the arena, execute high-conviction domain plays, and capture the upside.</p>
            <Link href="/competitions"><Button size="lg" className="shadow-glow" shimmer>Get Started</Button></Link>
        </div>
      </section>
    </div>
  );
}
