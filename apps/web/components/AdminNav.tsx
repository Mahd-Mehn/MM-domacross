"use client";
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';

export function AdminNav(){
  const { address } = useAccount();
  const [isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{
    if(!address){ setIsAdmin(false); return; }
    const env = process.env.NEXT_PUBLIC_ADMIN_WALLETS || '';
    const list = env.split(/[,\s]/).map(s=>s.trim().toLowerCase()).filter(Boolean);
    setIsAdmin(list.includes(address.toLowerCase()));
  },[address]);
  if(!isAdmin) return null;
  return <div className="flex gap-1 text-sm font-medium">
    <Link href="/admin/whitelist" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Whitelist</Link>
    <Link href="/admin/kyc" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">KYC</Link>
    <Link href="/admin/config" className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">Config</Link>
  </div>;
}
