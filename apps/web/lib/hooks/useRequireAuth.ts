import { useAuth } from '../../components/AuthProvider';
import { useCallback } from 'react';
import { useToasts } from '../../components/ToastProvider';

export function useRequireAuth(){
  const { token, signIn, address } = useAuth();
  const toasts = useToasts();
  return useCallback(async (): Promise<boolean> => {
    if (token) return true;
    if (!address) { toasts.push('Connect wallet first', 'error'); return false; }
    await signIn();
    if (!token) { toasts.push('Auth needed', 'error'); return false; }
    return true;
  }, [token, signIn, address, toasts]);
}
