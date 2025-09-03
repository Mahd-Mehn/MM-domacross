import Link from "next/link";
import ConnectWallet from "../components/ConnectWallet";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";
import { ThemeToggle } from "../components/ThemeToggle";
import { MobileNav } from "../components/MobileNav";

export const metadata = {
  title: "DomaCross",
  description: "Cross-chain domain trading competitions",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased bg-[#0b1220] text-slate-100 selection:bg-brand-500/30">
        <Providers>
          <div className="relative min-h-screen flex flex-col">
            <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 bg-slate-900/80 border-b border-white/10">
              <div className="max-w-7xl mx-auto px-4 md:px-8 flex h-16 items-center gap-6">
                <Link href="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">
                  DomaCross
                </Link>
                <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                  <Link href="/competitions" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Competitions</Link>
                  <Link href="/dashboard" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Dashboard</Link>
                  <Link href="/strategies" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Strategies</Link>
                  <Link href="/settings" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Settings</Link>
                </nav>
                <div className="ml-auto flex items-center gap-3">
                  <MobileNav />
                  <ThemeToggle />
                  <ConnectWallet />
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
                <p>&copy; {new Date().getFullYear()} DomaCross. All rights reserved.</p>
                <div className="flex gap-4">
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
