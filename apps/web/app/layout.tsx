import Link from "next/link";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { AdminNav } from "@/components/AdminNav";
import ClientConnectWallet from "@/components/ClientConnectWallet";
export const metadata = {
  title: "DomaCross",
  description: "Cross-chain domain trading competitions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
  <body suppressHydrationWarning className="min-h-full antialiased selection:bg-brand-500/30" style={{background:'var(--ds-bg)', color:'var(--ds-text)'}}>
        <Providers>
          <div className="relative min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 md:px-8 flex h-16 items-center gap-6">
                <Link href="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">
                  DomaCross
                </Link>
                <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                  <Link href="/marketplace" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">Marketplace</Link>
                  <Link href="/defi" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">DeFi</Link>
                  <Link href="/competitions" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Competitions</Link>
                  <Link href="/dashboard" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Dashboard</Link>
                  <Link href="/etfs" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">ETFs</Link>
                  <Link href="/strategies" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Strategies</Link>
                  <Link href="/settings" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Settings</Link>
                  <AdminNav />
                </nav>
                <div className="ml-auto flex items-center gap-3">
                  <MobileNav />
                  <ThemeToggle />
                  <ClientConnectWallet />
                </div>
              </div>
            </header>
            <main className="flex-1 w-full">
              <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {children}
              </div>
            </main>
            <footer className="mt-16 border-t border-white/5 py-10 text-center text-xs text-slate-500">
              <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <ClientYear />
                <div className="flex gap-4">
                  <Link href="/marketplace" className="hover:text-slate-300">Marketplace</Link>
                  <Link href="/competitions" className="hover:text-slate-300">Competitions</Link>
                  <Link href="/strategies" className="hover:text-slate-300">Strategies</Link>
                  <Link href="/settings" className="hover:text-slate-300">Settings</Link>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}

// Client-only year to avoid SSR/client mismatch if build crosses a year boundary
function ClientYear(){
  if (typeof window === 'undefined') return <p>&copy; DomaCross. All rights reserved.</p>;
  return <p>&copy; {new Date().getFullYear()} DomaCross. All rights reserved.</p>;
}
