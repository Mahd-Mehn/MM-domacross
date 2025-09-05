// Token storage abstraction with selectable persistence

const PERSIST_MODE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AUTH_PERSIST) || 'session';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryStore: Record<string,string> = {};
const memory: StorageLike = {
  getItem: k => memoryStore[k] ?? null,
  setItem: (k,v)=> { memoryStore[k]=v; },
  removeItem: k => { delete memoryStore[k]; }
};

function pickStore(): StorageLike {
  if (typeof window === 'undefined') return memory;
  if (PERSIST_MODE === 'local') return window.localStorage;
  if (PERSIST_MODE === 'none' || PERSIST_MODE === 'memory') return memory;
  // default session
  return window.sessionStorage;
}

const store = pickStore();
const KEY = 'dc_token';

export function getToken(){
  return store.getItem(KEY);
}
export function setToken(token: string){
  store.setItem(KEY, token);
}
export function clearToken(){
  store.removeItem(KEY);
}

export function decodeJwt(token: string): { exp?: number; sub?: string; [k:string]:any } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload;
  } catch {
    return null;
  }
}
