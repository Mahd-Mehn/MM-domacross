# DomaCross Frontend

A Next.js application for the DomaCross domain trading competition platform.

## Features

- 🏆 **Domain Trading Competitions**: Participate in time-bound trading competitions
- 💰 **USDC Deposits**: Deposit USDC to join competitions and start trading
- 📊 **Portfolio Management**: Track your domain portfolio and performance
- 🧺 **Domain Baskets**: Create and trade domain baskets (ETFs)
- 🔗 **On-chain Trading**: All transactions happen on the blockchain
- 🌐 **Cross-chain Support**: Support for multiple blockchain networks

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Blockchain Integration**: Wagmi + Viem
- **UI Components**: Custom components with Tailwind
- **Data Fetching**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A wallet (MetaMask, WalletConnect, etc.)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Update the environment variables in `.env.local` with your contract addresses and network configuration.

### Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Environment Variables

See `.env.example` for all required environment variables. Key variables include:

- `NEXT_PUBLIC_NETWORK`: Network to use (domaTestnet, mainnet, sepolia)
- Contract addresses for all deployed smart contracts
- API base URL for the backend
- RPC URLs for different networks

## Project Structure

```
apps/web/
├── app/                    # Next.js app directory
│   ├── competitions/       # Competition pages
│   ├── dashboard/          # User dashboard
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Homepage
│   └── providers.tsx       # Wagmi providers
├── components/             # Reusable components
│   ├── ConnectWallet.tsx   # Wallet connection
│   ├── TradingInterface.tsx # Trading UI
│   ├── DomainBasket.tsx    # Basket creation UI
│   ├── USDCDeposit.tsx     # USDC deposit UI
│   └── PortfolioDashboard.tsx # Portfolio display
├── lib/                    # Utility libraries
│   ├── api.ts              # API client
│   ├── auth.ts             # Authentication helpers
│   ├── config.ts           # App configuration
│   ├── contracts.ts        # Contract ABIs and addresses
│   └── hooks/              # Custom React hooks
│       └── useContracts.ts # Contract interaction hooks
└── public/                 # Static assets
```

## Smart Contract Integration

The frontend integrates with the following smart contracts:

- **CompetitionFactory**: Creates new trading competitions
- **Competition**: Manages individual competition logic
- **DomainMarketplace**: Handles domain buying/selling
- **DomainBasket**: Manages domain basket creation and trading
- **ValuationOracle**: Provides domain price data
- **MockUSDC**: Test USDC token for competitions

## Key Components

### TradingInterface
Main trading interface with tabs for:
- Market: View available domains and create orders
- Portfolio: View user's domain holdings
- Orders: View and manage active orders

### DomainBasket
Domain basket creation and management:
- Create baskets from multiple domains
- Trade baskets as single units
- View market available baskets

### USDCDeposit
Competition entry system:
- Mint test USDC tokens
- Join competitions with entry fee
- Check balance requirements

### PortfolioDashboard
Portfolio tracking and analytics:
- Real-time portfolio value
- Performance metrics
- Trading history
- Holdings overview

## API Integration

The frontend communicates with the FastAPI backend for:
- User authentication and profiles
- Competition data and leaderboards
- Trade history and analytics
- Off-chain data storage

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow React best practices
- Use Tailwind for styling
- Keep components small and focused

### Smart Contract Interactions
- Use the custom hooks in `lib/hooks/useContracts.ts`
- Handle transaction states properly
- Show loading states and error messages
- Confirm transactions before updating UI

### State Management
- Use TanStack Query for server state
- Use Zustand for client state
- Keep local component state minimal

## Deployment

The application can be deployed to:
- Vercel (recommended for Next.js)
- Netlify
- Any Node.js hosting platform

Make sure to set all environment variables in your deployment platform.

## Contributing

1. Follow the existing code style
2. Write clear commit messages
3. Test your changes thoroughly
4. Update documentation as needed

## License

This project is part of the DomaCross platform.
