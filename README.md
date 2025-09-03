# DomaCross: Cross-Chain Domain Trading Competitions

A decentralized platform for competitive domain trading built on Doma's multi-chain infrastructure.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL
- Redis
- Docker & Docker Compose

### 1. Environment Setup

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Required: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# Optional: Blockchain RPC URLs, JWT keys
```

### 2. Start Infrastructure

```bash
# Start databases and services
docker-compose up -d db redis

# Wait for services to be ready
sleep 10
```

### 3. Setup Backend

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Seed database with test data
python seed.py

# Start API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Setup Frontend

```bash
cd apps/web

# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Deploy Smart Contracts (Optional)

```bash
cd contracts

# Install dependencies
npm install

# Deploy to local network
npx hardhat run scripts/deploy.ts --network hardhat

# Or deploy to testnet (configure .env first)
npx hardhat run scripts/deploy.ts --network doma_testnet
```

## 🏗️ Architecture

### Frontend (Next.js + TypeScript)
- **Location**: `apps/web/`
- **Features**: Wallet connection, competition browsing, dashboard
- **Tech Stack**: Next.js, React, Tailwind CSS, Wagmi, React Query

### Backend (FastAPI + Python)
- **Location**: `apps/api/`
- **Features**: Authentication, competition management, portfolio tracking
- **Tech Stack**: FastAPI, SQLAlchemy, PostgreSQL, Redis

### Smart Contracts (Solidity)
- **Location**: `contracts/`
- **Features**: Competition logic, portfolio tracking, prize distribution
- **Tech Stack**: Hardhat, OpenZeppelin, Solidity

## 📁 Project Structure

```
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── app/
│   │   │   ├── models/      # Database models
│   │   │   ├── routers/     # API endpoints
│   │   │   ├── schemas/     # Pydantic schemas
│   │   │   ├── services/    # Business logic
│   │   │   └── main.py      # FastAPI app
│   │   ├── requirements.txt
│   │   └── seed.py          # Database seeder
│   └── web/                 # Next.js frontend
│       ├── app/             # Next.js app router
│       ├── components/      # React components
│       ├── lib/             # Utilities
│       └── package.json
├── contracts/               # Solidity smart contracts
│   ├── contracts/           # Contract source files
│   ├── scripts/             # Deployment scripts
│   ├── test/                # Contract tests
│   └── hardhat.config.ts
├── infra/                   # Infrastructure configs
│   └── docker/              # Dockerfiles
├── docker-compose.yml       # Local development setup
└── .env.example             # Environment template
```

## 🔑 Key Features

### ✅ Implemented
- **Wallet Authentication**: EIP-191 signature-based auth
- **Competition Management**: Create, join, and track competitions
- **Portfolio Tracking**: Real-time portfolio valuation
- **Leaderboard System**: Rank participants by performance
- **Cross-Chain Ready**: Architecture supports multiple blockchains
- **Database Schema**: Complete PostgreSQL schema
- **API Endpoints**: RESTful APIs for all features
- **Smart Contracts**: Competition, portfolio, and oracle contracts
- **Frontend UI**: Modern React components with Tailwind CSS

### 🚧 In Progress
- **Real-time Updates**: WebSocket connections for live data
- **Advanced Trading**: Domain buying/selling interface
- **Prize Distribution**: Automated winner payouts
- **Cross-Chain Integration**: Doma bridge integration

## 🧪 Testing

### Smart Contracts
```bash
cd contracts
npx hardhat test
```

### API
```bash
cd apps/api
# Run with pytest or manual testing
```

### Frontend
```bash
cd apps/web
npm run build  # Check for build errors
```

## 🚢 Deployment

### Production Setup
1. Configure production environment variables
2. Deploy smart contracts to Doma testnet/mainnet
3. Build and deploy API to cloud (Railway, Heroku, etc.)
4. Build and deploy frontend to Vercel/Netlify
5. Set up monitoring and logging

### Docker Deployment
```bash
# Build all services
docker-compose build

# Start production stack
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: See `/docs` folder (coming soon)

---

Built with ❤️ for the Doma ecosystem Monorepo

Local-first dev on your VM with an AWS Terraform skeleton for later migration.

- Web: Next.js (apps/web)
- API: FastAPI (apps/api)
- Contracts: Hardhat (contracts)
- Docker: infra/docker/* and docker-compose.yml
- Terraform: infra/terraform/* (AWS skeleton)

## Quickstart (Local VM)

1. Copy envs
   cp .env.example .env

2. Start stack
   docker compose up --build

- Web: http://localhost:3000
- API: http://localhost:8000/health
- Postgres: localhost:5432 (in container)
- Redis: localhost:6379 (in container)

## AWS (Later)
- See infra/terraform/ for skeleton modules (ECS/RDS/Redis/ALB/WAF/Secrets).
- Provide variables via tfvars and AWS credentials.
