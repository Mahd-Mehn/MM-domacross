# Doma Fractionalization

Doma fractionalization enables the conversion of domain NFTs into fungible tokens. This functionality allows domain investors to access liquidity while retaining ownership of their domains. It also enables crypto investors to gain partial ownership of valuable domains by holding the fractionalized fungible tokens.

## Overview

Below is an overview of the components that communicate with the Doma Fractionalization smart contract.

<figure><img src="https://3605822629-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fte9OGCgBObOj1vn0919Q%2Fuploads%2FiDTg7J4Fj39aZpCDad3v%2FScreenshot%202025-06-26%20at%2012.03.01%E2%80%AFPM.png?alt=media&#x26;token=923a261d-0d65-440b-bfe1-8c4b1edaef6d" alt=""><figcaption></figcaption></figure>

* **Doma Fractionalization:** The core contract for domain fractionalization deployed on Doma Chain. By interacting with the smart contract, users can fractionalize and buy out domain ownership tokens, mint fractional tokens which are fungible, and exchange fractional tokens after a buyout. Additionally, the contract interacts with decentralized exchanges (DEXs) to fetch the prices of fractional tokens.
* **Fractional Token (**[**ERC-20**](https://eips.ethereum.org/EIPS/eip-20)**):** A fungible token contract for each fractionalized domain ownership token (NFT). These tokens can only be minted and burned by the Doma Fractionalization contract to prevent dilution. They can be bridged to other chains like Base and Solana. When minting tokens during the initial fractionalization, or when redeeming fractional tokens after a buyout, the user must bridge the domain ownership token or fractional token back to Doma Chain.
* **Bridged Fractional Token:** The fractional token bridged to chains other than Doma Chain. It enables trading of fractional tokens on a wider range of exchanges, thereby enhancing liquidity
* **Bridged USDC:** The stablecoin used to buy out the original ownership token or to redeem income by exchanging fractional tokens after a buyout.
* **DEX(s):** The DEX(s) provide a liquidity platform for users to swap to and from fractional tokens. They also serve as the price source for all fractional tokens used by the Doma Fractionalization contract.

For more information on the Doma Record and Domain Ownership Token, please refer to [this page](https://docs.doma.xyz/api-reference/doma-smart-contracts-api).

## Main Use Cases

### Fractionalize Domain NFTs

To obtain fractional tokens from a Domain Ownership Token (NFT), the user must fractionalize the NFT by interacting with the Doma Fractionalization smart contract. Upon fractionalization, the smart contract mints the corresponding fractional tokens and transfers them to a Doma-approved launchpad in a single transaction. The launchpad is responsible for raising funds and launching the fractional token on supported DEXs.

When minting the fractional tokens, the user specifies the total supply and other token metadata. A small portion of the supply is held by the Doma Fractionalization contract as a protocol fee.

After a domain NFT is fractionalized, anyone can buy out the NFT by paying the required buy out price. Once the NFT is reassigned to a new owner, it follows the standard Doma Protocol domain ownership rules.

To protect against price volatility, the original domain NFT owner may set a minimum buy out price in USDC. A buyer must pay a price that is greater than or equal to the minimum buy out price. The exact formula for determining the buy out price is covered in the next section.

### Buy Out Domain NFTs

Doma Fractionalization allows domain NFTs to remain tradable even after they have been fractionalized. This means that any user can buy out a fractionalized domain NFT by interacting with the Doma Fractionalization smart contract. Since a fractionalized domain NFT may have increased market value due to demand for its fractional tokens, the buyout price is defined as follows:

$$
Price_{buyout} = Max(MBP, FDMC)
$$

where MBP is short for the minimum buyout price set by the user when fractionalizing the domain NFT. FDMC is short for the fully diluted market cap, which is calculated by:

$$
FDMC_{token} = TotalSupply_{token} * Price_{token}
$$

Please note that the user performing the buy out may be different from the original NFT owner. In such cases, the Doma Protocol will initiate a process to update domain ownership records accordingly.

Once the domain NFT is bought out, the associated fractional tokens no longer represent ownership of the domain. However, holders of these tokens can still trade these tokens on exchanges, or redeem them for a portion of the buy out proceeds by interacting with the Doma Fractionalization smart contract (as explained in the next section).

### Exchange Fractional Tokens After Buying Out

When a domain NFT is bought out, the original fractional tokens no longer represent ownership of the domain. To protect the value of these tokens, the Doma Protocol allows holders to redeem them for USDC based on the buy out price of the domain:

$$
Price_{token} = \frac {Price_{buyout}}  {TotalSupply_{token}}
$$

After the buy out, the new domain owner may choose to re-fractionalize the domain by issuing a new set of fractional tokens through a separate ERC-20 contract. These new tokens are technically distinct and do not affect the value or redeemability of the original tokens.

## Doma Fractionalization Smart Contract

### Fractionalize Domain NFT

This function allows the owner of a domain NFT to fractionalize it by minting fungible fractional tokens. The tokens are sent to a Doma-approved launchpad, while a small percentage is reserved by the fractionalization contract as a protocol fee.

```solidity
/**
 * @notice Fractionalize domain ownership token (NFT) and mint fractional token for the domain NFT.
 * @param tokenId The token ID of the domain ownership token.
 * @param fractionalTokenInfo The structure that defines the fractional token information.
 * @param minimumBuyoutPrice The name of the fractional token.
 */
function fractionalizeOwnershipToken(
    uint256 tokenId,
    FractionalTokenInfo memory fractionalTokenInfo,
    uint256 minimumBuyoutPrice
) external

/**
 * @notice the fractional token information structure
 * @param name The name of the token
 * @param symbol The symbol of the token
 */
struct FractionalTokenInfo {
    string name;
    string symbol;
}
```

### Buy out Domain NFT

This function is called when a user wants to buy out a domain NFT by paying the buy out price in full.

```solidity
/**
 * @notice Buy out domain ownership token.
 * @param tokenId The ID of the token.
 */
function buyoutOwnershipToken(uint256 tokenId) external
```

### Exchange Fractional Token

This function allows holders of fractional tokens to swap them for USDC after the associated domain NFT has been bought out. Once exchanged, the fractional tokens are automatically burned by the fractionalization contract.

```solidity
/**
 * @notice Exchange the fractional token for USDC.
 * @param fractionalToken The addess of fractional token to be exchange from.
 * @param amount The amount of fractional token to exchange.
 */
function exchangeFractionalToken(
    address indexed fractionalToken,
    uint256 amount
) public;
```

### Get Domain NFT Buy Out Price

This function allows users who are interested in buying the fractionalized domain NFT to query the current buyout price, denominated in USDC.

```solidity
/**
 * @notice Get the buy out price of a domain ownership token.
 * @param tokenId The ID of the ownership token.
 */
function getOwnershipTokenBuyoutPrice(
    uint256 tokenId
) external view returns (uint256)
```

### Non-Standard Events

In addition to standard ERC-20 and ERC-721 events, custom events are emitted to track  fractionalization-related activities.

```solidity
/**
 * @notice Emitted when a domain NFT is fractionalized.
 * @param tokenAddress The address of domain NFT that has been fractionalized.
 * @param tokenId The ID of the domain NFT.
 * @param fractionalTokenAddress The address of the fractional token.
 * @param fractionalTokenInfo The fractional token information (e.g. name, symbol).
 * @param minimumBuyoutPrice The minimum buy out price set by the caller.
 * @param tokenizationVersion The version of the fractional token for the domain NFT.
 */
event NameTokenFractionalized(
    address indexed tokenAddress,
    uint256 indexed tokenId,
    address fractionalTokenAddress,
    FractionalTokenInfo fractionalTokenInfo,
    uint256 minimumBuyoutPrice,
    uint256 tokenizationVersion
);

/**
 * @notice Emitted when a domain NFT is brought out.
 * @param tokenAddress The address of the domain NFT that has been brought out.
 * @param tokenId The ID of the domain NFT.
 * @param fractionalTokenAddress The address of the fractional token.
 * @param buyoutPrice The buy out price in USDC that has been paid.
 * @param newOwner The new owner of the domain NFT.
 * @param tokenizationVersion The version of the fractional token for the domain NFT.
 */
event NameTokenBoughtOut(
    address indexed tokenAddress,
    uint256 indexed tokenId,
    address fractionalTokenAddress,
    uint256 buyoutPrice,
    address indexed newOwner,
    uint256 tokenizationVersion
);
```
