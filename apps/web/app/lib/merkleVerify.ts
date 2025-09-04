// Simple inclusion proof verification for audit event leaves
// Assumes path array contains sibling hashes from leaf level upward.
export async function verifyInclusion(
  leafObject: any,
  path: string[],
  position: number,
  expectedRoot: string
): Promise<boolean> {
  const stable = JSON.stringify(leafObject, Object.keys(leafObject).sort());
  const data = new TextEncoder().encode(stable);

  async function sha256(buf: Uint8Array): Promise<Uint8Array> {
    if (typeof window !== 'undefined' && (window as any).crypto?.subtle) {
      const digest = await (window as any).crypto.subtle.digest('SHA-256', buf);
      return new Uint8Array(digest);
    }
    const nodeCrypto = require('crypto');
    return new Uint8Array(nodeCrypto.createHash('sha256').update(buf).digest());
  }

  let current = await sha256(data);
  let idx = position;
  for (const siblingHex of path) {
    const sibling = new Uint8Array(Buffer.from(siblingHex.replace(/^0x/, ''), 'hex'));
    let combined: Uint8Array;
    if (idx % 2 === 0) {
      combined = new Uint8Array([...current, ...sibling]);
    } else {
      combined = new Uint8Array([...sibling, ...current]);
    }
    current = await sha256(combined);
    idx = Math.floor(idx / 2);
  }
  const rootHex = '0x' + Buffer.from(current).toString('hex');
  return rootHex === expectedRoot;
}

export interface ProofBundle {
  event_id: number;
  merkle_root: string;
  path: string[];
  position: number;
  leaf: any;
}

export async function verifyProofBundle(bundle: ProofBundle): Promise<boolean> {
  return verifyInclusion(bundle.leaf, bundle.path, bundle.position, bundle.merkle_root);
}

// Signature verification (RSA PKCS1v15 SHA256)
export async function verifySnapshotSignature(root: string, signatureB64: string | null | undefined, publicKeyPemB64: string | null | undefined): Promise<boolean> {
  if (!signatureB64 || !publicKeyPemB64) return false;
  try {
    const pem = atob(publicKeyPemB64);
    const sig = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    // Extract raw PEM body
    const pkcs8 = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s+/g, '');
    const der = Uint8Array.from(atob(pkcs8), c => c.charCodeAt(0));
    const key = await (window as any).crypto.subtle.importKey(
      'spki',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const enc = new TextEncoder().encode(root);
    return await (window as any).crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, enc);
  } catch (e) {
    return false;
  }
}