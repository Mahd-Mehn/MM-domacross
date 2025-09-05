Demo Doma Orderbook Buy Flow

This small doc explains the demo buy flow implemented in `components/DomainBasket.tsx`.

Environment
- NEXT_PUBLIC_DOMA_API_URL (optional) - API base URL for the Doma orderbook. Defaults to https://api.doma.xyz when not set.
- NEXT_PUBLIC_DOMA_API_KEY (optional) - API key (not required for demo mode).

How the demo works
- Clicking "Buy Basket" calls the Doma SDK `buyListing` method using the connected wallet.
- The demo treats the `basket.id` as the orderId placeholder. Replace this with a real marketplace orderId in production.
- Progress is displayed inline and the button is disabled while the purchase is in progress.

Notes
- The demo uses `viemToEthersSigner` to convert the wagmi/viem wallet client to an Ethers-compatible signer.
- Type casts are used in a few places to keep the demo minimal; please replace with proper types and error handling for production.
