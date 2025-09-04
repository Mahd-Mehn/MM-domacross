## @doma-protocol/orderbook-sdk![TypeScript icon, indicating that this package has built-in type declarations](https://static-production.npmjs.com/255a118f56f5346b97e56325a1217a16.svg "This package contains built-in TypeScript declarations")

0.1.3 • **Public** • Published 3 months ago

# DomaOrderbookSDK

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#domaorderbooksdk)

A TypeScript SDK for interacting with the Doma Orderbook, enabling seamless DOMA Domain trading operations including listings, offers, and transaction management.

## Features

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#features)

* 🛒  **Listing Management** : Create, buy, and cancel Doma Domain listings
* 💰  **Offer System** : Create, accept, and cancel offers on Doma Domains
* 💸  **Fee Handling** : Automatic marketplace fee calculation and management
* 🔗  **Multi-chain Support** : Works across different blockchain networks
* 📊  **Progress Tracking** : Real-time progress callbacks for all operations
* 🛡️  **Type Safety** : Full TypeScript support with comprehensive type definitions
* 🚀  **WETH Support** : Special handling for Wrapped Ethereum transactions
* ⚡  **Viem Compatibility** : Built-in utilities for Viem/Wagmi integration
* 🔧  **Utility Functions** : Fee calculation and currency validation helpers

## Installation

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#installation)

```shell
npm install @doma-protocol/orderbook-sdk
# or
yarn add @doma-protocol/orderbook-sdk
# or
pnpm add @doma-protocol/orderbook-sdk
```

### Optional: Viem Integration

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#optional-viem-integration)

If you're using Viem/Wagmi and want to use the `viemToEthersSigner` utility, you'll also need to install Viem:

```shell
npm install viem
# or
yarn add viem
# or
pnpm add viem
```

Note: Viem is a peer dependency and only required if you want to use the Viem-to-Ethers conversion utility. If you're using Ethers directly, you don't need to install Viem.

## Quick Start

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#quick-start)

### Initialize the SDK

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#initialize-the-sdk)

```ts
import { createDomaOrderbookClient, getDomaOrderbookClient } from '@doma-protocol/orderbook-sdk';

// Initialize the client
const config = {
  apiClientOptions: {
    baseUrl: 'https://api.doma.xyz',
    apiKey: 'your-api-key',
  },
};

const client = createDomaOrderbookClient(config);

// Or get the existing client instance
const client = getDomaOrderbookClient();
```

### Using with Viem/Wagmi

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#using-with-viemwagmi)

If you're using Viem or Wagmi, you can easily convert your wallet client to an Ethers signer:

```ts
import { useWalletClient } from 'wagmi';
import { OrderbookType, viemToEthersSigner } from '@doma-protocol/orderbook-sdk';

function MyComponent() {
  const { data: walletClient } = useWalletClient();

  const handleCreateListing = async () => {
    if (!walletClient) return;

    // Convert Viem wallet client to Ethers signer
    const signer = viemToEthersSigner(walletClient, 'eip155:1');

    const result = await client.createListing({
      params: {
        items: [{
          contract: '0x...',
          tokenId: '123',
          price: '1000000000000000000', // 1 ETH in wei
        }],
        orderbook: OrderbookType.DOMA
      },
      signer,
      chainId: 'eip155:1',
      onProgress: (step, progress) => {
        console.log(`Step: ${step}, Progress: ${progress}%`);
      }
    });
  };

  return <button onClick={handleCreateListing}>Create Listing</button>;
}
```

### Using with Ethers Directly

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#using-with-ethers-directly)

```ts
import { JsonRpcSigner } from 'ethers';
import { OrderbookType } from '@doma-protocol/orderbook-sdk';

// Assuming you have a signer from your wallet connection
const signer: JsonRpcSigner = // ... your signer
const chainId = 'eip155:1'; // Ethereum mainnet

// Create a listing
const listingResult = await client.createListing({
  params: {
    items: [{
      contract: '0x...',
      tokenId: '123',
      price: '1000000000000000000', // 1 ETH in wei
    }],
    orderbook: OrderbookType.DOMA
  },
  signer,
  chainId,
  onProgress: (step, progress) => {
    console.log(`Step: ${step}, Progress: ${progress}%`);
  }
});
```

## Core Functionalities

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#core-functionalities)

### 🛒 Listing Operations

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#-listing-operations)

#### Create Listing

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#create-listing)

Create a new NFT listing on the marketplace.

```ts
const result = await client.createListing({
  params: {
    items: [
      {
        contract: '0x1234567890123456789012345678901234567890',
        tokenId: '1',
        price: '500000000000000000', // 0.5 ETH
      },
    ],
    orderbook: OrderbookType.DOMA,
    // marketplaceFees will be fetched automatically if not provided
  },
  signer,
  chainId: 'eip155:1',
  onProgress: (step, progress) => {
    console.log(`Creating listing: ${step} (${progress}%)`);
  },
});
```

#### Buy Listing

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#buy-listing)

Purchase an existing NFT listing.

```ts
const result = await client.buyListing({
  params: {
    orderId: 'listing-id-123',
    fulFillerAddress: '0x...',
  },
  signer,
  chainId: 'eip155:1',
  onProgress: (step, progress) => {
    console.log(`Buying listing: ${step} (${progress}%)`);
  },
});
```

#### Cancel Listing

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#cancel-listing)

Cancel an active listing.

```ts
const result = await client.cancelListing({
  params: {
    orderId: 'listing-id-123',
  },
  signer,
  chainId: 'eip155:1',
  onProgress: (step, progress) => {
    console.log(`Cancelling listing: ${step} (${progress}%)`);
  },
});
```

### 💰 Offer Operations

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#-offer-operations)

#### Create Offer

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#create-offer)

Create an offer on an NFT.

```ts
const offerResult = await client.createOffer({
  params: {
    items: [
      {
        contract: '0x1234567890123456789012345678901234567890',
        tokenId: '1',
        currencyContractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        price: '100000000000000000', // 0.1 ETH
      },
    ],
    orderbook: OrderbookType.DOMA,
    expirationTime: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  },
  signer,
  chainId: 'eip155:1',
  onProgress: (step, progress) => {
    console.log(`Creating offer: ${step} (${progress}%)`);
  },
});
```

#### Accept Offer

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#accept-offer)

Accept an existing offer on your NFT.

```ts
const result = await client.acceptOffer({
  params: {
    orderId: 'offer-id-123',
  },
  signer,
  chainId: 'eip155:1',
  onProgress: (step, progress) => {
    console.log(`Accepting offer: ${step} (${progress}%)`);
  },
});
```

#### Cancel Offer

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#cancel-offer)

Cancel an active offer.

```ts
const result = await client.cancelOffer({
  params: {
    orderId: 'offer-id-123',
  },
  signer,
  chainId: 'eip155:1',
  onProgress: (step, progress) => {
    console.log(`Cancelling offer: ${step} (${progress}%)`);
  },
});
```

### 🔧 Utility Functions

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#-utility-functions)

#### Get Marketplace Fees

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#get-marketplace-fees)

Retrieve marketplace fees for a contract and orderbook combination.

```ts
const feeResponse = await client.getOrderbookFee({
  contractAddress: '0x1234567890123456789012345678901234567890',
  orderbook: OrderbookType.DOMA,
  chainId: 'eip155:1',
});

console.log('Marketplace fees:', feeResponse.marketplaceFees);
// Example output: [{ recipient: '0x...', basisPoints: 250, feeType: 'DOMA' }] // 2.5% fee
```

#### Get Supported Currencies

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#get-supported-currencies)

Get list of supported payment currencies for a contract.

```ts
const currenciesResponse = await client.getSupportedCurrencies({
  contractAddress: '0x1234567890123456789012345678901234567890', // not used at the moment
  orderbook: OrderbookType.DOMA, // not used at the moment / will only return DOMA Orderbook for now
  chainId: 'eip155:1',
});

console.log('Supported currencies:', currenciesResponse.currencies);
// Example output:
// [
//   { contractAddress: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum', decimals: 18 },
//   { contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 18 }
// ]
```

### 💸 Fee Management

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#-fee-management)

The SDK automatically handles marketplace fees, but you can also manually specify them:

```ts
// Fees are fetched automatically
const result = await client.createListing({
  params: {
    items: [{ contract: '0x...', tokenId: '1', price: '1000000000000000000' }],
    orderbook: OrderbookType.DOMA,
    // No need to specify marketplaceFees - they'll be fetched automatically
  },
  signer,
  chainId: 'eip155:1',
  onProgress: () => {},
});

// Or manually specify fees
const resultWithManualFees = await client.createListing({
  params: {
    items: [{ contract: '0x...', tokenId: '1', price: '1000000000000000000' }],
    orderbook: OrderbookType.DOMA,
    marketplaceFees: [
      { recipient: '0x...', basisPoints: 250 }, // 2.5% fee
    ],
  },
  signer,
  chainId: 'eip155:1',
  onProgress: () => {},
});
```

## API Reference

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#api-reference)

### Core Method Signatures

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#core-method-signatures)

#### `createListing(options)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#createlistingoptions)

**Parameters:**

* `params: CreateListingParams` - Listing configuration
* `signer: JsonRpcSigner` - Ethereum signer instance
* `chainId: Caip2ChainId` - Blockchain network identifier
* `onProgress: OnProgressCallback` - Progress tracking callback

**Returns:** `Promise<CreateListingResult>`

#### `buyListing(options)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#buylistingoptions)

**Parameters:**

* `params: BuyListingParams` - Purchase parameters
* `signer: JsonRpcSigner` - Buyer's signer
* `chainId: Caip2ChainId` - Network identifier
* `onProgress: OnProgressCallback` - Progress callback

**Returns:** `Promise<BuyListingResult>`

#### `createOffer(options)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#createofferoptions)

**Parameters:**

* `params: CreateOfferParams` - Offer details
* `signer: JsonRpcSigner` - Offeror's signer
* `chainId: Caip2ChainId` - Network identifier
* `onProgress: OnProgressCallback` - Progress callback

**Returns:** `Promise<CreateOfferResult>`

#### `acceptOffer(options)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#acceptofferoptions)

**Parameters:**

* `params: AcceptOfferParams` - Acceptance parameters
* `signer: JsonRpcSigner` - NFT owner's signer
* `chainId: Caip2ChainId` - Network identifier
* `onProgress: OnProgressCallback` - Progress callback

**Returns:** `Promise<AcceptOfferResult>`

#### `cancelListing(options)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#cancellistingoptions)

**Parameters:**

* `params: CancelListingParams` - Cancellation parameters
* `signer: JsonRpcSigner` - Listing creator's signer
* `chainId: Caip2ChainId` - Network identifier
* `onProgress: OnProgressCallback` - Progress callback

**Returns:** `Promise<CancelListingResult>`

#### `cancelOffer(options)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#cancelofferoptions)

**Parameters:**

* `params: CancelOfferParams` - Cancellation parameters
* `signer: JsonRpcSigner` - Offer creator's signer
* `chainId: Caip2ChainId` - Network identifier
* `onProgress: OnProgressCallback` - Progress callback

**Returns:** `Promise<CancelOfferResult>`

#### `getOrderbookFee(params)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#getorderbookfeeparams)

**Parameters:**

* `params: GetOrderbookFeeRequest`
  * `contractAddress: string` - NFT contract address
  * `orderbook: OrderbookType` - Orderbook type
  * `chainId: Caip2ChainId` - Network identifier

**Returns:** `Promise<GetOrderbookFeeResponse>`

#### `getSupportedCurrencies(params)`

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#getsupportedcurrenciesparams)

**Parameters:**

* `params: GetSupportedCurrenciesRequest`
  * `contractAddress: string` - NFT contract address
  * `orderbook: OrderbookType` - Orderbook type
  * `chainId: Caip2ChainId` - Network identifier

**Returns:** `Promise<GetSupportedCurrenciesResponse>`

## Configuration

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#configuration)

### DomaOrderbookSDKConfig

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#domaorderbooksdkconfig)

```ts
interface DomaOrderbookSDKConfig {
  apiClientOptions: {
    baseUrl: string;
    apiKey?: string;
  };
}
```

## Framework Integration

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#framework-integration)

### Next.js with Wagmi

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#nextjs-with-wagmi)

```ts
'use client';

import { useWalletClient, useAccount } from 'wagmi';
import { OrderbookType, viemToEthersSigner, createDomaOrderbookClient } from '@doma-protocol/orderbook-sdk';

export function ListingComponent() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const client = createDomaOrderbookClient({
    apiClientOptions: {
      baseUrl: process.env.NEXT_PUBLIC_DOMA_API_URL!,
      apiKey: process.env.NEXT_PUBLIC_DOMA_API_KEY
    }
  });

  const createListing = async () => {
    if (!walletClient || !address) return;

    const signer = viemToEthersSigner(walletClient, 'eip155:1');

    await client.createListing({
      params: {
        items: [{
          contract: '0x...',
          tokenId: '1',
          price: '1000000000000000000'
        }],
        orderbook: OrderbookType.DOMA,
      },
      signer,
      chainId: 'eip155:1',
      onProgress: (step, progress) => {
        console.log(`${step}: ${progress}%`);
      }
    });
  };

  return (
    <button onClick={createListing} disabled={!walletClient}>
      Create Listing
    </button>
  );
}
```

## Error Handling

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#error-handling)

The SDK uses a comprehensive error system with specific error codes:

```ts
import { DomaOrderbookError, DomaOrderbookErrorCode } from '@doma-protocol/orderbook-sdk';

try {
  await client.createListing({...});
} catch (error) {
  if (error instanceof DomaOrderbookError) {
    switch (error.code) {
      case DomaOrderbookErrorCode.SIGNER_NOT_PROVIDED:
        console.log('Please connect your wallet');
        break;
      case DomaOrderbookErrorCode.FETCH_FEES_FAILED:
        console.log('Failed to fetch marketplace fees');
        break;
      case DomaOrderbookErrorCode.CLIENT_NOT_INITIALIZED:
        console.log('SDK not initialized');
        break;
      default:
        console.log('Unknown error:', error.message);
    }
  }
}
```

## Progress Tracking

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#progress-tracking)

All major operations support progress tracking through callbacks:

```ts
const onProgress = (step: string, progress: number) => {
  console.log(`Current step: ${step}`);
  console.log(`Progress: ${progress}%`);

  // Update your UI progress
  updateProgressBar(progress);
};

await client.createListing({
  // ... other params
  onProgress,
});
```

## Chain ID Format

[](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#chain-id-format)

Use CAIP-2 format for chain IDs:

* Ethereum Mainnet: `eip155:1`
* Polygon: `eip155:137`
* Arbitrum: `eip155:42161`
* Optimism: `eip155:10`
