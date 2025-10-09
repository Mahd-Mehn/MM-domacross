import { createDomaOrderbookClient } from '@doma-protocol/orderbook-sdk';

const base = process.env.NEXT_PUBLIC_DOMA_API_URL || process.env.NEXT_PUBLIC_ORDERBOOK_API_BASE;
const apiKey = process.env.NEXT_PUBLIC_DOMA_API_KEY || process.env.NEXT_PUBLIC_ORDERBOOK_API_KEY;

export const orderbookClient = base ? createDomaOrderbookClient({
	source: 'domacross-web',
	chains: [],
	apiClientOptions: {
		baseUrl: base,
		apiKey: apiKey
	}
}) : null;
