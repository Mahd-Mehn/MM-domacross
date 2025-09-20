// DeFi Types for DomaCross Platform
import { Address } from 'viem';

// Collateral Vault Types
export interface VaultPosition {
  id: string;
  owner: Address;
  domainName: string;
  tokenId: string;
  collateralValue: bigint;
  borrowedAmount: bigint;
  healthFactor: number;
  liquidationPrice: bigint;
  apy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LendingPool {
  totalSupply: bigint;
  totalBorrowed: bigint;
  utilizationRate: number;
  supplyAPY: number;
  borrowAPY: number;
  availableLiquidity: bigint;
}

// Futures Trading Types
export interface FuturesContract {
  id: string;
  domainName: string;
  expiryDate: Date;
  strikePrice: bigint;
  currentPrice: bigint;
  volume24h: bigint;
  openInterest: bigint;
  fundingRate: number;
  markPrice: bigint;
  indexPrice: bigint;
  contractType: 'perpetual' | 'dated';
}

export interface FuturesPosition {
  id: string;
  trader: Address;
  contractId: string;
  domainName: string;
  side: 'long' | 'short';
  size: bigint;
  entryPrice: bigint;
  markPrice: bigint;
  unrealizedPnl: bigint;
  realizedPnl: bigint;
  margin: bigint;
  leverage: number;
  liquidationPrice: bigint;
  createdAt: Date;
}

// Order Types
export interface FuturesOrder {
  id: string;
  trader: Address;
  contractId: string;
  side: 'long' | 'short';
  orderType: 'market' | 'limit' | 'stop' | 'stop-limit';
  size: bigint;
  price?: bigint;
  stopPrice?: bigint;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  filledSize: bigint;
  averagePrice: bigint;
  createdAt: Date;
  updatedAt: Date;
}

// Lending/Borrowing Types
export interface LoanRequest {
  domainName: string;
  tokenId: string;
  requestedAmount: bigint;
  duration: number; // in days
  collateralRatio: number; // e.g., 150 = 150%
}

export interface Loan {
  id: string;
  borrower: Address;
  lender?: Address;
  domainName: string;
  tokenId: string;
  principal: bigint;
  interest: bigint;
  totalDue: bigint;
  dueDate: Date;
  status: 'active' | 'repaid' | 'defaulted' | 'liquidated';
  healthFactor: number;
  collateralValue: bigint;
  createdAt: Date;
}

// Chart Data Types
export interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: bigint;
  size: bigint;
  total: bigint;
}

export interface MarketStats {
  price24h: bigint;
  volume24h: bigint;
  high24h: bigint;
  low24h: bigint;
  priceChange24h: number;
  volumeChange24h: number;
  marketCap: bigint;
  totalValueLocked: bigint;
}

// Risk Management
export interface RiskMetrics {
  portfolioValue: bigint;
  totalCollateral: bigint;
  totalDebt: bigint;
  netValue: bigint;
  overallHealthFactor: number;
  liquidationRisk: 'low' | 'medium' | 'high' | 'critical';
  var95: bigint; // Value at Risk 95%
  maxDrawdown: number;
}

// Transaction Types
export interface DeFiTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidate' | 'open_position' | 'close_position';
  user: Address;
  amount: bigint;
  asset?: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  gasUsed?: bigint;
  gasPrice?: bigint;
}

// Yield Farming
export interface YieldStrategy {
  id: string;
  name: string;
  description: string;
  apy: number;
  tvl: bigint;
  risk: 'low' | 'medium' | 'high';
  minDeposit: bigint;
  lockPeriod?: number; // in days
  rewardsToken: string;
}

// SDK Integration Types
export interface DeFiSDKConfig {
  vaultAddress: Address;
  futuresAddress: Address;
  lendingPoolAddress: Address;
  oracleAddress: Address;
  treasuryAddress: Address;
}

// Events
export interface DeFiEvent {
  type: 'vault_created' | 'loan_initiated' | 'position_opened' | 'position_closed' | 'liquidation' | 'margin_call';
  data: any;
  timestamp: Date;
  txHash?: string;
}
