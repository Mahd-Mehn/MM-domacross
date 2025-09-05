"use client";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getToken, setToken, clearToken, decodeJwt } from '../lib/token';
import { useAccount, useSignMessage } from 'wagmi';
import { requestNonce, verifySignature } from '../lib/auth';
import { useToasts } from './ToastProvider';

interface AuthState {
  address: string | null;
  token: string | null;
  expiresAt: number | null;
  authenticating: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(){
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('AuthProvider missing');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const toasts = useToasts();
  const [token, setTok] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const inFlightRef = useRef(false);

  // Load existing token
  useEffect(()=> {
    const t = getToken();
    if (t) {
      const dec = decodeJwt(t);
      setTok(t);
      if (dec?.exp) setExpiresAt(dec.exp * 1000);
    }
  },[]);


  const signIn = useCallback(async ()=>{
  if (authenticating || inFlightRef.current) return; // debounce parallel
    if (!isConnected || !address) return;
    if (typeof signMessageAsync !== 'function') {
      console.warn('signMessageAsync unavailable - connector not ready');
      return;
    }
    if (token && expiresAt && expiresAt - Date.now() > 2*60*1000) return; // still fresh
  setAuthenticating(true); inFlightRef.current = true;
    const toastId = toasts.push('Authenticating', 'progress', { progress: 10 });
    const attempt = async () => {
      const { nonce } = await requestNonce(address);
      toasts.updateProgress(toastId, 35, 'Nonce');
      const message = `Sign to authenticate with DomaCross\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });
      toasts.updateProgress(toastId, 70, 'Signature');
      return verifySignature(address, nonce, message, signature);
    };
    try {
      let resp;
      try {
        resp = await attempt();
      } catch (e:any) {
        // Automatic one-time retry for consumed/expired nonce race
        if ((e?.message || '').includes('Nonce invalid') || (e?.message || '').includes('Nonce not present')) {
          resp = await attempt();
        } else {
          throw e;
        }
      }
      setToken(resp.access_token);
      const dec = decodeJwt(resp.access_token);
      setTok(resp.access_token);
      if (dec?.exp) setExpiresAt(dec.exp * 1000);
      toasts.success(toastId, 'Signed in');
    } catch (e:any) {
      console.error('Auth error', e);
      const raw = e?.message || '';
      const msg = raw.includes('chain') ? 'Wallet chain mismatch' : (raw.includes('Nonce') ? 'Auth retry failed' : 'Auth failed');
      toasts.error(toastId, msg);
    } finally {
  setAuthenticating(false); inFlightRef.current = false;
    }
  }, [address, isConnected, signMessageAsync, token, expiresAt, toasts, authenticating]);

  // Auto clear expired + proactive refresh 60s prior (after signIn defined)
  useEffect(()=>{
    if (!token || !expiresAt) return;
    const now = Date.now();
    if (expiresAt <= now) {
      clearToken(); setTok(null); setExpiresAt(null); return;
    }
    const msUntilExpiry = expiresAt - now;
    const expiryTimer = setTimeout(()=>{
      clearToken(); setTok(null); setExpiresAt(null); toasts.push('Session expired', 'error');
    }, msUntilExpiry);
    const lead = 60_000;
    let refreshTimer: any;
    if (msUntilExpiry > lead && isConnected) {
      refreshTimer = setTimeout(()=>{ void signIn(); }, msUntilExpiry - lead);
    }
    return ()=> { clearTimeout(expiryTimer); if (refreshTimer) clearTimeout(refreshTimer); };
  }, [token, expiresAt, toasts, isConnected, signIn]);

  const signOut = useCallback(()=>{
    clearToken();
    setTok(null);
    setExpiresAt(null);
    toasts.push('Signed out', 'info');
  }, [toasts]);

  const value: AuthState = {
    address: address || null,
    token,
    expiresAt,
    authenticating,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
