# Doma Smart Contracts API

## Protocol Overview

Below is a brief overview of the Smart Contracts that form Doma Protocol.

<img src="https://3605822629-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fte9OGCgBObOj1vn0919Q%2Fuploads%2Fz4GpfoIsjS02Chl7q6Hz%2Ffile.excalidraw.svg?alt=media&#x26;token=ad9acd02-2708-4179-b6c2-8ba4a5b00cb5" alt="" class="gitbook-drawing">

* **Doma Record:** Main contract that holds information about a domain and issues Name Tokens. Serves as a coordination point for cross-chain operations. Exposes a Registrar-facing API that provides a full suite of operations to manage domains.
* **Doma Forwarder:** [EIP-2771](https://eips.ethereum.org/EIPS/eip-2771) Trusted Forwarder, that relays meta transactions from a Registrar to Doma Record contract. Optional, since Registrars can submit transactions directly to the Doma Record contract.
* **Doma Gateway:** [ERC-7786](https://erc7786.org/) Gateway Sourc&#x65;**,** deployed on each supported chain. This contract allows sending messages to contracts on other chains.
* **Proxy Doma Record:** Supporting contract, facilitates communication between users and contracts on each tokenization chain with the Doma Record contract. Used to abstract Doma Chain from end-users and provides core domain-management operations (like claiming and bridging).
* **Ownership Token:** Regular [ERC-721 ](https://eips.ethereum.org/EIPS/eip-721)NFT contract (or equivalent on non-EVM chains), with some modifications to support expiration and compliance operations.

## EVM-compatible chains

### **Proxy Doma Record Contracts**

Methods on this contract require protocol fees to be paid by a user. Fees are denominated in USDC, but are paid in native gas coin.

#### **Request Tokenization**

This method requires a voucher signed by a sponsoring Registrar using [EIP-712 ](https://eips.ethereum.org/EIPS/eip-712)standard. This voucher is obtained when user initiates a tokenization on a Registrar.

```solidity
/**
 * @notice Request tokenization of given names.
 * Relays message to Doma Record contract on Doma Chain, for Registrar to approve or reject.
 * @param voucher Tokenization voucher. Used to pre-clear tokenization, before final approval.
 * @param signature Signature of the voucher, signed by a Registrar.
 */
function requestTokenization(
    TokenizationVoucher calldata voucher,
    bytes calldata signature
) public payable;

 /**
 * @notice Tokenization voucher, obtained from a Registrar.
 * @param names List of names to tokenize.
 * @param nonce Unique nonce to prevent voucher reuse (replay attacks).
 * @param expiresAt Expiration date of the voucher (UNIX seconds).
 * @param ownerAddress Minted Ownership Token owner address. Must be equal to transaction sender.
 */
struct TokenizationVoucher {
    IDomaRecord.NameInfo[] names;
    uint256 nonce;
    uint256 expiresAt;
    address ownerAddress;
}
```

#### **Claim Domain Ownership**

This method requires a proof of provided contacts voucher signed by either Doma PII Storage, or by Registrar. Can only be called on a chain with a valid Ownership token. Will work even if domain is in expired state, to be able to claim and renew.

```solidity
/**
* @notice Claim ownership of a given Domain, using Ownership token.
* Relays message to Doma Record contract on Doma Chain.
* @param tokenId Id of an Ownership Token.
* @param isSynthetic Whether it's a regular or permissioned (synthetic) ownership token.
* @param proofOfContactsVoucher Voucher that proves Registrant contact information has been verified and stored in an off-chain storage.
* @param signature Signature of the voucher, signed by an off-chain storage (either Registrar or Doma-provided storage).
*/
function claimOwnership(
   uint256 tokenId,
   bool isSynthetic,
   ProofOfContactsVoucher calldata proofOfContactsVoucher,
   bytes calldata signature
) public payable;

/**
* @notice Proof of Contacts voucher, obtained from a Registrar or Doma-provided storage.
* @param registrantHandle Handle of a registrant in an off-chain storage.
* @param proofSource Source of the proof-of-contacts voucher. 1 - Registrar, 2 - Doma.
* @param nonce Unique nonce to prevent voucher reuse (replay attacks).
* @param expiresAt Expiration date of the voucher (UNIX seconds).
*/
struct ProofOfContactsVoucher {
   uint256 registrantHandle;
   IDomaRecord.ProofOfContactsSource proofSource;
   uint256 nonce;
   uint256 expiresAt;
}
```

#### **Bridge**

Move token to another supported chain, can only be called on a source chain.

<pre class="language-solidity"><code class="lang-solidity"><strong>/**
</strong>* @notice Move token to another chain.
* Relays message to Doma Record contract on Doma Chain.
* @param tokenId Id of an Ownership Token.
* @param isSynthetic Whether it's a regular or permissioned (synthetic) ownership token.
* @param targetChainId CAIP-2 Chain ID of the target chain.
* @param targetOwnerAddress Wallet address on a target chain.
*/
function bridge(
   uint256 tokenId,
   bool isSynthetic,
   string calldata targetChainId,
   string calldata targetOwnerAddress
) public payable;
</code></pre>

#### Detokenize

Request domain detokenization. Will only work with an Ownership token, and requires domain ownership to be claimed. Method does not require fees. Synthetic Ownership Token could be used only if there's no other Synthetic Token in existence.

```solidity
/**
* @dev Request detokenization of a Domain, using Ownership token.
* Relays message to Doma Record contract on Doma Chain, for validation and further processing.
* @param tokenId Id of an Ownership Token.
* @param isSynthetic Whether it's a regular or permissioned (synthetic) ownership token.
*/
function requestDetokenization(uint256 tokenId, bool isSynthetic) public;
```

### **Ownership Token Contract**

Ownership token contract is a regular ERC-721 token with some additional functionality and restrictions:

* Additional `expirationOf` function is provided to check expiration date. After expiration, token will become non-transferrable, and could either be renewed or deleted by a registrar.
* Additional `registrarOf` function is provided to get owning registrar IANA id.
* Token could be burned by a Registrar, if conditions are met (domain is claimed by a current token owner).
* Registrar retains the right to burn token even if conditions are not met (domain is not claimed by a current token owner), for compliance reason (e.g. in case of lost UDRP dispute over the domain).
* Registrar can lock token transfer for compliance reasons (e.g. in case of UDPR dispute is in progress).
* [ERC-2981](https://eips.ethereum.org/EIPS/eip-2981) standard is used to configure roaylties information.

#### Get Expiration Date

```solidity
/**
* @notice Returns expiration date for a token. After this date, token transfer will be blocked.
* @param id Token ID.
* @return uint256 Unix timestamp in seconds.
*/
function expirationOf(uint256 id) external view returns (uint256) {
   return _expirations[id];
}
```

#### Get Registrar IANA id

```solidity
/**
* @notice Returns registrar IANA ID for a token.
* @param id Token ID.
* @return uint256 Registrar IANA ID.
*/
function registrarOf(uint256 id) external view returns (uint256) {
   return _registrarIanaIds[id];
}
```

#### Get Transfer Lock Status

```solidity
/**
* @notice Returns transfer lock status for a token. If 'true', token cannot be transferred.
* @param id Token ID.
*/
function lockStatusOf(uint256 id) external view returns (bool) {
   return _transferLocks[id];
}
```

#### Non-Standard Events

In additional to standard ERC-721 events, new events are emitted to track tokens lifecycle.

<pre class="language-solidity"><code class="lang-solidity"><strong>/**
</strong>* @notice Emitted when an ownership token is minted.
* Emitted together with standard ERC-721 Transfer event, but contains additional information.
* @param tokenId The ID of the ownership token.
* @param registrarIanaId The IANA ID of a sponsoring registrar.
* @param to The address that received the ownership token.
* @param sld The second-level domain of the name. E.g. "example" in "example.com".
* @param tld The top-level domain of the name. E.g. "com" in "example.com".
* @param expiresAt The expiration date of the name (UNIX seconds).
* @param correlationId Correlation id associated with a mint event. Used by registrars to track on-chain operations.
*/
event OwnershipTokenMinted(
   uint256 indexed tokenId,
   uint256 registrarIanaId,
   address to,
   string sld,
   string tld,
   uint256 expiresAt,
   string correlationId
);
<strong>
</strong><strong>/**
</strong>* @notice Emitted when name token is renewed.
* @param tokenId The ID of the name token.
* @param expiresAt The expiration date of the name token (UNIX seconds).
* @param correlationId Correlation id associated with a renewal event. Used by registrars to track on-chain operations.
*/
event NameTokenRenewed(uint256 indexed tokenId, uint256 expiresAt, string correlationId);

/**
* @notice Emitted when name token is burned.
* Similar to ERC721 `Transfer` event with zero `to`, but with an additional correlation id included.
* @param tokenId The ID of the name token.
* @param owner Owner address at the time of burning.
* @param correlationId Correlation id associated with a burn event. Used by registrars to track on-chain operations.
*/
event NameTokenBurned(uint256 indexed tokenId, address owner, string correlationId);

/**
* @notice Emitted when name token is locked or unlocked.
* @param tokenId The ID of the name token.
* @param isTransferLocked Whether token transfer is locked or not.
* @param correlationId Correlation id associated with a lock status change event. Used by registrars to track on-chain operations.
*/
event LockStatusChanged(uint256 indexed tokenId, bool isTransferLocked, string correlationId);

/**
* @notice Emitted when metadata is updated for a token.
* Can happen when token is renewed.
* Follows IERC4906 Metadata Update Extension.
*/
event MetadataUpdate(uint256 tokenId);
</code></pre>

## Solana

On Solana, Doma Protocol integrates with Solana Records Service (SRS) program to issue and tokenize domains.

<img src="https://3605822629-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fte9OGCgBObOj1vn0919Q%2Fuploads%2Fhko3V860K0SjbfGLLky7%2Ffile.excalidraw.svg?alt=media&#x26;token=39bfb596-e766-4446-9871-18f7903534e4" alt="" class="gitbook-drawing">

* Doma Protocol owns a Permissioned Class on the SRS program, which is used to issue and manage tokenized domains.
* [Token 22](https://spl.solana.com/token-2022) is used as an underlying NFT standard.
* SRS Program retains full control over minted NFTs (since it can sign on behalf of mint account, which has full authority delegation), so compliance operations are performed through SRS, using Proxy Doma Record PDA as a Class Authority to authorize operations.
* Doma Gateway exists as part of Proxy Doma Record Program.
