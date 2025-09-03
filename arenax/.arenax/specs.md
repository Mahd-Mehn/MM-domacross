Of course. Here is the complete technical specification document written out in Markdown format.

# DomaCross: Cross-Chain Domain Trading Competitions

## Technical Specification Document

**Version:** 1.0
**Date:** September 3, 2025

-----

### 1\. Introduction

#### 1.1. Project Vision

To create a premier, gamified platform for cross-chain domain trading, transforming domain investing from a passive activity into an engaging, competitive, and social experience. DomaCross will be the go-to destination for domain enthusiasts to test their trading skills, manage their portfolios, and connect with a vibrant community.

#### 1.2. Project Goals

  - To develop a decentralized application (dApp) that hosts time-bound domain trading competitions across multiple blockchains.
  - To provide users with sophisticated portfolio management tools, including the creation of domain baskets (ETFs).
  - To foster a social trading environment where users can share strategies and learn from top performers.
  - To generate high-volume, meaningful transactions on the Doma testnet and eventually mainnet.
  - To build a robust and scalable architecture using Next.js, Python, and Solidity.

#### 1.3. Target Audience

  - **Domain Investors & Speculators:** Individuals actively buying, selling, and holding domain names as investments.
  - **Web3 Enthusiasts & Traders:** Users familiar with DeFi, NFTs, and cryptocurrency trading looking for new and exciting platforms.
  - **Competitive Gamers:** Individuals who enjoy skill-based competitions and leaderboard challenges.
  - **Newcomers to Domain Investing:** The platform will provide an accessible on-ramp for those new to the domain market.

-----

### 2\. System Architecture

#### 2.1. Overall Architecture

DomaCross will be a multi-tiered application with the following components:

  - **Frontend:** A Next.js application for the user interface.
  - **Backend:** A Python (FastAPI) application for data management and off-chain logic.
  - **Blockchain:** Solidity smart contracts for on-chain competition logic and asset management.

*(A visual diagram would be placed here showing the interaction between Frontend -\> Backend API -\> Blockchain and Doma Protocol.)*

#### 2.2. Frontend (Next.js & TypeScript)

  - **Framework:** Next.js
  - **Language:** TypeScript
  - **UI Library:** Shadcn/UI, Recharts
  - **State Management:** Zustand
  - **Blockchain Interaction:** Ethers.js/viem

#### 2.3. Backend (Python & FastAPI)

  - **Framework:** FastAPI
  - **Language:** Python
  - **Database:** PostgreSQL
  - **ORM:** SQLAlchemy
  - **Authentication:** JWT (for managing off-chain user sessions)

#### 2.4. Blockchain (Solidity)

  - **Language:** Solidity
  - **Development Environment:** Hardhat
  - **Cross-Chain:** Doma Bridge, Doma State Sync

-----

### 3\. User Flows

#### 3.1. User Onboarding & Authentication

1.  User lands on the homepage.
2.  Clicks "Connect Wallet."
3.  Selects a wallet provider (e.g., MetaMask, WalletConnect).
4.  Approves the connection in their wallet.
5.  A new user profile is created in the backend database, linked to their wallet address.

#### 3.2. Competition Participation

1.  User navigates to the "Competitions" page.
2.  Views a list of `Active`, `Upcoming`, and `Past` competitions.
3.  Selects an active competition to view its detail page.
4.  Clicks "Join Competition."
5.  Signs a transaction to pay the entry fee (if any) and register with the on-chain `Competition` contract.
6.  The user is now a participant and can start trading domains for the competition.

#### 3.3. Portfolio Management

1.  User navigates to their "Dashboard."
2.  Views an overview of their portfolio value, P\&L, and domain holdings across all chains.
3.  Can create a "Domain Basket" by selecting multiple tokenized domains.
4.  This action mints a new NFT representing the basket, which can be traded as a single unit.

#### 3.4. Social Trading

1.  User navigates to the "Leaderboard" of a competition.
2.  Views top-performing traders ranked by portfolio performance.
3.  Clicks on a trader to view their public profile and recent trading activity.
4.  Has the option to "Copy Trade," which will prompt them to execute similar trades as the top performer.

-----

### 4\. Pages & UI/UX

  - **`/` (Homepage):** Marketing content, featured competitions, and a primary call-to-action to connect wallet and explore competitions.
  - **`/competitions` (Competitions Page):** A gallery of all competitions with filtering (by TLD, chain, duration) and search functionality.
  - **`/competitions/[id]` (Competition Detail Page):** In-depth information about a single competition, including rules, prize pool, real-time leaderboard, and an activity feed.
  - **`/dashboard` (User Dashboard):** A personalized view of the user's portfolio, active competitions, performance analytics charts, and recent trades.
  - **`/profile/[address]` (Trader Profile Page):** Public view of a trader's performance, competition history, and current domain holdings.
  - **`/settings` (Settings Page):** Manage profile information (username) and notification preferences.

-----

### 5\. Database Schema (PostgreSQL)

```sql
-- Users Table: Stores basic user information linked to their wallet.
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "wallet_address" VARCHAR(42) UNIQUE NOT NULL,
  "username" VARCHAR(255) UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Competitions Table: Stores details about each competition.
CREATE TABLE "competitions" (
  "id" SERIAL PRIMARY KEY,
  "contract_address" VARCHAR(42) UNIQUE NOT NULL,
  "chain_id" INTEGER NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "start_time" TIMESTAMPTZ NOT NULL,
  "end_time" TIMESTAMPTZ NOT NULL,
  "entry_fee" NUMERIC(18, 8),
  "rules" JSONB
);

-- Participants Table: Links users to the competitions they've joined.
CREATE TABLE "participants" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "competition_id" INTEGER NOT NULL REFERENCES "competitions"("id"),
  "portfolio_value" NUMERIC(18, 8) DEFAULT 0,
  UNIQUE("user_id", "competition_id")
);

-- Trades Table: Caches on-chain trade data for faster querying.
CREATE TABLE "trades" (
  "id" SERIAL PRIMARY KEY,
  "participant_id" INTEGER NOT NULL REFERENCES "participants"("id"),
  "domain_token_address" VARCHAR(42) NOT NULL,
  "domain_token_id" VARCHAR(255) NOT NULL,
  "trade_type" VARCHAR(4) NOT NULL, -- 'BUY' or 'SELL'
  "price" NUMERIC(18, 8) NOT NULL,
  "tx_hash" VARCHAR(66) UNIQUE NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

-----

### 6\. API Endpoints (FastAPI)

#### Users

  - `POST /api/v1/users`: Create a new user profile upon first wallet connection.
  - `GET /api/v1/users/{wallet_address}`: Get user profile details.

#### Competitions

  - `GET /api/v1/competitions`: Get a list of all competitions with filters.
  - `GET /api/v1/competitions/{id}`: Get details for a single competition.
  - `GET /api/v1/competitions/{id}/leaderboard`: Get the leaderboard for a competition, sorted by portfolio value.

#### Portfolio

  - `GET /api/v1/portfolio/{wallet_address}`: Get a user's aggregated cross-chain portfolio data.
  - `GET /api/v1/portfolio/{wallet_address}/history`: Get a user's trade history.

-----

### 7\. Smart Contracts (Solidity)

#### 7.1. `CompetitionFactory.sol`

*Purpose: Deploys new `Competition` contracts with specified parameters.*

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Competition.sol";

contract CompetitionFactory {
    address[] public deployedCompetitions;
    event CompetitionCreated(address indexed competitionAddress, uint256 startTime, uint256 endTime);

    function createCompetition(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _entryFee,
        address _valuationOracle
    ) external {
        Competition newCompetition = new Competition(_startTime, _endTime, _entryFee, _valuationOracle, msg.sender);
        deployedCompetitions.push(address(newCompetition));
        emit CompetitionCreated(address(newCompetition), _startTime, _endTime);
    }
}
```

#### 7.2. `Competition.sol`

*Purpose: Manages the logic for a single trading competition.*

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PortfolioTracker.sol";

contract Competition is Ownable {
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable entryFee;
    PortfolioTracker public immutable portfolioTracker;
    
    address[] public participants;
    mapping(address => bool) public isParticipant;

    event ParticipantJoined(address indexed participant);

    constructor(uint256 _startTime, uint256 _endTime, uint256 _entryFee, address _valuationOracle, address _owner) Ownable(_owner) {
        startTime = _startTime;
        endTime = _endTime;
        entryFee = _entryFee;
        portfolioTracker = new PortfolioTracker(_valuationOracle);
    }

    function join() external payable {
        require(block.timestamp >= startTime && block.timestamp < endTime, "Competition not active");
        require(msg.value == entryFee, "Incorrect entry fee");
        require(!isParticipant[msg.sender], "Already a participant");

        participants.push(msg.sender);
        isParticipant[msg.sender] = true;
        emit ParticipantJoined(msg.sender);
    }

    // Additional functions for distributing prizes would be added here.
}
```

#### 7.3. `PortfolioTracker.sol`

*Purpose: Tracks and calculates the value of a participant's portfolio within a competition.*

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ValuationOracle.sol";

contract PortfolioTracker {
    ValuationOracle public immutable valuationOracle;

    // A real implementation would require a more complex data structure to track individual domains (NFTs).
    // user => value
    mapping(address => uint256) public portfolioValues;

    constructor(address _oracleAddress) {
        valuationOracle = ValuationOracle(_oracleAddress);
    }

    function updatePortfolioValue(address _user, address[] calldata _domainTokens) external {
        // This would be called by a trusted backend or another contract.
        uint256 totalValue = 0;
        for (uint i = 0; i < _domainTokens.length; i++) {
            totalValue += valuationOracle.getDomainPrice(_domainTokens[i]);
        }
        portfolioValues[_user] = totalValue;
    }
}
```

#### 7.4. `ValuationOracle.sol`

*Purpose: Provides on-chain price data for tokenized domains.*

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ValuationOracle is Ownable {
    // This contract would integrate with Doma's rarity scores (Track 4) and market data oracles.
    // For now, it's a simple mock.
    mapping(address => uint256) public domainPrices; // domain token address => price in wei

    event PriceUpdated(address indexed token, uint256 newPrice);

    constructor(address _owner) Ownable(_owner) {}

    function getDomainPrice(address _domainTokenAddress) external view returns (uint256) {
        return domainPrices[_domainTokenAddress];
    }

    function setDomainPrice(address _domainTokenAddress, uint256 _price) external onlyOwner {
        domainPrices[_domainTokenAddress] = _price;
        emit PriceUpdated(_domainTokenAddress, _price);
    }
}
```

-----

### 8\. Implementation Plan

#### Sprint 1: Foundation & Core Contracts (2 Weeks)

  - **Goal:** Setup project scaffolding and deploy core logic.
  - **Tasks:**
      - Initialize Next.js, FastAPI, and Hardhat projects in a monorepo.
      - Develop and test V1 of `CompetitionFactory` and `Competition` contracts.
      - Setup PostgreSQL database and define schema with SQLAlchemy models.
      - Deploy contracts to Doma testnet.

#### Sprint 2: User Onboarding & Competition Display (2 Weeks)

  - **Goal:** Allow users to connect and view competitions.
  - **Tasks:**
      - Implement wallet connection (MetaMask, WalletConnect) on the frontend.
      - Build API endpoints for creating and fetching user profiles.
      - Build the `/competitions` and `/competitions/[id]` pages to display data from the backend.
      - Develop a backend service to listen for `CompetitionCreated` events and populate the database.

#### Sprint 3: Competition Participation & Dashboard (2 Weeks)

  - **Goal:** Enable users to join competitions and view their portfolio.
  - **Tasks:**
      - Implement the "Join Competition" flow, including the on-chain transaction.
      - Develop V1 of the `PortfolioTracker` and `ValuationOracle` contracts.
      - Build the User Dashboard page (`/dashboard`).
      - Create backend services to fetch and aggregate a user's domain holdings using Doma and Alchemy APIs.

#### Sprint 4: Leaderboard & Social Features (2 Weeks)

  - **Goal:** Introduce competitive and social elements.
  - **Tasks:**
      - Build the real-time leaderboard component on the competition detail page.
      - Create a backend job to periodically update portfolio values and rankings.
      - Implement the public trader profile pages (`/profile/[address]`).
      - Design the UI/UX for the "Copy Trading" and "Strategy Sharing" features.

#### Sprint 5: Cross-Chain Integration & Final Testing (2 Weeks)

  - **Goal:** Ensure seamless cross-chain functionality and prepare for launch.
  - **Tasks:**
      - Integrate Doma's bridging capabilities for moving domains between chains for competitions.
      - Implement Doma's State Sync to update leaderboards with cross-chain data.
      - Conduct comprehensive end-to-end testing on the Doma testnet.
      - Perform security audits of all smart contracts.

-----

### 9\. Doma Integration Points

  - **Multi-Chain Domain Support:** Competitions will be configured to accept tokenized domains from any of Doma's 17+ supported blockchains.
  - **Tokenization Process:** The platform will guide users to `testnet.d3.app` to tokenize their domains, a prerequisite for entering them into competitions.
  - **State Sync Technology:** Doma's state synchronization will be crucial for maintaining a consistent and real-time cross-chain leaderboard, aggregating portfolio values from multiple chains.
  - **Testnet Deployment:** The entire application stack will be deployed and rigorously tested on the Doma testnet, using simulated domains and competition environments to validate the `1000+` transaction volume and `100+` user participation targets.