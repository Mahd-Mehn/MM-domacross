# Doma Marketplace

Doma Marketplace is provided to simplify trading of tokenized names on-chain. It has following components:

* [Orderbook Rest API](api-reference/orderbook-api) for on-chain trading using [SeaPort protocol](https://github.com/ProjectOpenSea/seaport).
* [Poll API](api-reference/poll-api) for marketplace-related events.
* Marketplace-related data (listings, offers) in [Doma Subgraph](api-reference/doma-multi-chain-subgraph).
* Syndicated listings and offers from external marketplaces (OpenSea).
* [`@doma-protocol/orderbook-sdk`](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk) to simplify integrations of Doma Marketplace.

### How to Use Orderbook API

* It's highly recommended to use [`@doma-protocol/orderbook-sdk`](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk) to interact with [Orderbook API](api-reference/orderbook-api), since it abstracts underlying complexities of working with Seaport Protocol, granting on-chain approvals, and computing fees.
* When not using [`@doma-protocol/orderbook-sdk`](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk),  [`seaport-js`](https://github.com/ProjectOpenSea/seaport-js) library is recommended (which is used by SDK under the hood).

### Marketplace Fees

Doma Orderbook API enforces inclusion of following fees into consideration items:

* Doma Protocol Fee
  * Receiver Address: `0x2E7cC63800e77BB8c662c45Ef33D1cCc23861532`
  * Percentag&#x65;_: 0.5%_
* Name Token Royalties. Can be fetched by calling [`royaltyInfo`](https://eips.ethereum.org/EIPS/eip-2981) method on an [Ownership Token Smart contract](../api-reference/doma-smart-contracts-api#ownership-token-contract).
* OpenSea Fee (only when creating a listing/offer on OpenSea orderbook). Collection fee value can be fetched using [Get Collection API](https://docs.opensea.io/reference/get_collection) (required fee values from response should be included).
  * Since OpenSea API will also include royalty items, they should be filtered out to prevent double inclusion into considerations.

To simplify fees calculation, [Fee Information API](../api-reference/orderbook-api#get-v1-orderbook-fee-orderbook-chainid-contractaddress) is provided.&#x20;

{% hint style="success" %}
When using [`@doma-protocol/orderbook-sdk`](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk), fees are calculated automatically.
{% endhint %}

### Supported Currencies

Currently, following currencies are supported on Doma Marketplace:

* **Mainnets**:
  * _TBD_
* **Testnets**:
  * Sepolia:
    * Gas Token (ETH)
    * USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
  * Base Sepolia:
    * Gas Token (ETH)
    * USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`&#x20;
  * Doma:
    * Gas Token (ETH)
    * USDC: `0x2f3463756C59387D6Cd55b034100caf7ECfc757b`

Supported currencies can be fetched programmatically using [Currencies API](../api-reference/orderbook-api#get-v1-orderbook-currencies-chainid-contractaddress-orderbook).

{% hint style="success" %}
[`@doma-protocol/orderbook-sdk`](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk) provides a helper [`getSupportedCurrencies`](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk#user-content-get-supported-currencies) method, which returns list of all supported currencies.
{% endhint %}

### Making ETH Offers

Since SeaPort doesn't support making offers in ETH (as it's a native gas token, not an ERC-20), ETH should be wrapped to wETH using a wrapper contract.

Supported wETH contract addresses:

* **Mainnets**:
  * _TBD_
* **Testnets**:
  * Sepolia: `0x7b79995e5f793a07bc00c21412e50ecae098e7f9`
  * Base Sepolia: `0x4200000000000000000000000000000000000006`
  * Doma Testnet: `0x6f898cd313dcEe4D28A87F675BD93C471868B0Ac`

{% hint style="success" %}
When using [`@doma-protocol/orderbook-sdk`](https://www.npmjs.com/package/@doma-protocol/orderbook-sdk), wrapping is performed automatically.
{% endhint %}
