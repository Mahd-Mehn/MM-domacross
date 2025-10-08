"use client";
import React, { useEffect, useState } from 'react';
import { verifyProofBundle, verifySnapshotSignature } from '@/app/lib/merkleVerify';

interface ProofStatusProps {
  eventId: number;
  apiBase?: string;
  preFetched?: { [eventId:number]: any }; // map from eventId to proof object (as returned from snapshot-with-proofs proofs[])
}

export const ProofStatus: React.FC<ProofStatusProps> = ({ eventId, apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000', preFetched }) => {
  const [loading, setLoading] = useState(true);
  const [validInclusion, setValidInclusion] = useState<boolean | null>(null);
  const [signatureValid, setSignatureValid] = useState<boolean | null>(null);
  const [root, setRoot] = useState<string | null>(null);
  const [anchorTx, setAnchorTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        let proof: any;
        if (preFetched && preFetched[eventId]) {
          proof = preFetched[eventId];
        } else {
          const proofRes = await fetch(`${apiBase}/api/v1/settlement/audit-events/${eventId}/merkle-proof`);
          if (!proofRes.ok) throw new Error(await proofRes.text());
          proof = await proofRes.json();
        }
        setRoot(proof.merkle_root);
        setAnchorTx(proof.anchor_tx_hash || null);
        const leaf = proof.leaf;
        const bundle = { event_id: proof.event_id, merkle_root: proof.merkle_root, path: proof.path, position: proof.position, leaf };
        const inc = await verifyProofBundle(bundle as any);
        if (!cancelled) setValidInclusion(inc);
        if (proof.snapshot_signature) {
          // fetch public key
          const pkRes = await fetch(`${apiBase}/api/v1/settlement/public-key`);
            const pkJson = await pkRes.json();
            const pub = pkJson.public_key_pem_b64;
            const sigOk = await verifySnapshotSignature(proof.merkle_root, proof.snapshot_signature, pub);
            if (!cancelled) setSignatureValid(sigOk);
        } else {
          setSignatureValid(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [eventId, apiBase, preFetched]);

  if (loading) return <div className="text-sm text-gray-500">Verifying proof...</div>;
  if (error) return <div className="text-sm text-red-500">Error: {error}</div>;
  return (
    <div className="border rounded p-3 text-sm space-y-1 bg-gray-50">
      <div><strong>Root:</strong> <span className="font-mono break-all">{root}</span></div>
      <div><strong>Inclusion:</strong> {validInclusion ? <span className="text-green-600">VALID</span> : <span className="text-red-600">INVALID</span>}</div>
      <div><strong>Signature:</strong> {signatureValid === null ? '—' : signatureValid ? <span className="text-green-600">VALID</span> : <span className="text-red-600">INVALID</span>}</div>
      {anchorTx && (<div><strong>Anchor Tx:</strong> <span className="font-mono break-all">{anchorTx}</span></div>)}
    </div>
  );
};
