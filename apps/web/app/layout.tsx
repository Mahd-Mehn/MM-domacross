import Link from "next/link";
import ConnectWallet from "../components/ConnectWallet";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "DomaCross",
  description: "Cross-chain domain trading competitions",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="flex justify-between items-center p-3 border-b border-gray-200 bg-white">
            <nav className="flex gap-4 items-center">
              <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-800">
                DomaCross
              </Link>
              <Link href="/competitions" className="text-gray-600 hover:text-gray-900 transition-colors">
                Competitions
              </Link>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                Dashboard
              </Link>
            </nav>
            <ConnectWallet />
          </header>
          <main className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
