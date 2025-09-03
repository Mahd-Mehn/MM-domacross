import { apiJson } from "../lib/api";

export type NonceResponse = { address: string; nonce: string };
export type TokenResponse = { access_token: string; token_type: string };

export async function requestNonce(address: string): Promise<NonceResponse> {
  return apiJson<NonceResponse>(`/auth/nonce`, {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function verifySignature(
  address: string,
  nonce: string,
  message: string,
  signature: string
): Promise<TokenResponse> {
  return apiJson<TokenResponse>(`/auth/verify`, {
    method: "POST",
    body: JSON.stringify({ address, nonce, message, signature }),
  });
}
