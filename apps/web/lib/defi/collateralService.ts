/**
 * Collateral Service for Fractional Domain Tokens
 * Allows users to deposit fractional tokens as collateral and borrow against them
 */

export interface CollateralPosition {
  id: string;
  userAddress: string;
  tokenAddress: string;
  domainName: string;
  collateralAmount: string; // Amount of tokens deposited
  collateralValueUSD: string; // USD value of collateral
  borrowedAmount: string; // Amount borrowed in USD
  interestRate: number; // Annual interest rate (%)
  liquidationThreshold: number; // Percentage (e.g., 75 means liquidate at 75% LTV)
  healthFactor: number; // > 1 is healthy, < 1 is at risk
  createdAt: Date;
  lastUpdated: Date;
}

export interface BorrowingPower {
  maxBorrowUSD: string;
  availableToBorrow: string;
  currentLTV: number; // Loan-to-Value ratio
  liquidationPrice: string;
}

export class CollateralService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl?: string) {
    this.apiBaseUrl = apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || '';
  }

  /**
   * Calculate borrowing power based on collateral
   * @param collateralValueUSD USD value of collateral
   * @param collateralRatio Maximum LTV ratio (default 75%)
   */
  calculateBorrowingPower(
    collateralValueUSD: number,
    collateralRatio: number = 0.75
  ): number {
    return collateralValueUSD * collateralRatio;
  }

  /**
   * Calculate health factor for a position
   * Health Factor = (Collateral Value * Liquidation Threshold) / Borrowed Amount
   * > 1 = Healthy
   * < 1 = At risk of liquidation
   */
  calculateHealthFactor(
    collateralValueUSD: number,
    borrowedAmount: number,
    liquidationThreshold: number = 0.75
  ): number {
    if (borrowedAmount === 0) return Infinity;
    return (collateralValueUSD * liquidationThreshold) / borrowedAmount;
  }

  /**
   * Calculate current LTV (Loan-to-Value) ratio
   */
  calculateLTV(collateralValueUSD: number, borrowedAmount: number): number {
    if (collateralValueUSD === 0) return 0;
    return (borrowedAmount / collateralValueUSD) * 100;
  }

  /**
   * Calculate liquidation price for the collateral
   */
  calculateLiquidationPrice(
    collateralAmount: number,
    borrowedAmount: number,
    liquidationThreshold: number = 0.75
  ): number {
    if (collateralAmount === 0) return 0;
    return borrowedAmount / (collateralAmount * liquidationThreshold);
  }

  /**
   * Calculate interest accrued on a loan
   * @param principal Borrowed amount
   * @param annualRate Annual interest rate (as decimal, e.g., 0.05 for 5%)
   * @param daysElapsed Days since loan was taken
   */
  calculateInterest(
    principal: number,
    annualRate: number,
    daysElapsed: number
  ): number {
    return principal * annualRate * (daysElapsed / 365);
  }

  /**
   * Deposit fractional tokens as collateral
   */
  async depositCollateral(
    tokenAddress: string,
    amount: string,
    userAddress: string
  ): Promise<CollateralPosition> {
    try {
      // In production, this would interact with smart contracts
      // For now, we'll create a mock position
      const position: CollateralPosition = {
        id: `pos-${Date.now()}`,
        userAddress,
        tokenAddress,
        domainName: 'example.eth', // Would be fetched from token data
        collateralAmount: amount,
        collateralValueUSD: '0', // Would be calculated from oracle
        borrowedAmount: '0',
        interestRate: 5.0, // 5% annual
        liquidationThreshold: 75,
        healthFactor: Infinity,
        createdAt: new Date(),
        lastUpdated: new Date(),
      };

      return position;
    } catch (error) {
      console.error('Failed to deposit collateral:', error);
      throw error;
    }
  }

  /**
   * Borrow against collateral
   */
  async borrowAgainstCollateral(
    positionId: string,
    borrowAmount: string
  ): Promise<CollateralPosition> {
    try {
      // In production, this would:
      // 1. Check health factor
      // 2. Verify borrowing power
      // 3. Execute borrow transaction
      // 4. Update position

      throw new Error('Borrow functionality not yet implemented');
    } catch (error) {
      console.error('Failed to borrow:', error);
      throw error;
    }
  }

  /**
   * Repay borrowed amount
   */
  async repayLoan(
    positionId: string,
    repayAmount: string
  ): Promise<CollateralPosition> {
    try {
      // In production, this would:
      // 1. Calculate interest owed
      // 2. Process repayment
      // 3. Update position
      // 4. Return updated position

      throw new Error('Repay functionality not yet implemented');
    } catch (error) {
      console.error('Failed to repay loan:', error);
      throw error;
    }
  }

  /**
   * Withdraw collateral (only if no outstanding loan or after repayment)
   */
  async withdrawCollateral(
    positionId: string,
    amount: string
  ): Promise<CollateralPosition> {
    try {
      // In production, this would:
      // 1. Check if withdrawal is safe (health factor > 1)
      // 2. Execute withdrawal
      // 3. Update position

      throw new Error('Withdraw functionality not yet implemented');
    } catch (error) {
      console.error('Failed to withdraw collateral:', error);
      throw error;
    }
  }

  /**
   * Check if position is at risk of liquidation
   */
  checkLiquidationRisk(position: CollateralPosition): {
    isAtRisk: boolean;
    riskLevel: 'safe' | 'warning' | 'danger' | 'critical';
    message: string;
  } {
    const healthFactor = position.healthFactor;

    if (healthFactor >= 1.5) {
      return {
        isAtRisk: false,
        riskLevel: 'safe',
        message: 'Position is healthy',
      };
    } else if (healthFactor >= 1.2) {
      return {
        isAtRisk: false,
        riskLevel: 'warning',
        message: 'Position is approaching risk threshold',
      };
    } else if (healthFactor >= 1.0) {
      return {
        isAtRisk: true,
        riskLevel: 'danger',
        message: 'Position is at high risk of liquidation',
      };
    } else {
      return {
        isAtRisk: true,
        riskLevel: 'critical',
        message: 'Position is eligible for liquidation',
      };
    }
  }

  /**
   * Get all positions for a user
   */
  async getUserPositions(userAddress: string): Promise<CollateralPosition[]> {
    try {
      // In production, fetch from backend/blockchain
      return [];
    } catch (error) {
      console.error('Failed to fetch user positions:', error);
      return [];
    }
  }

  /**
   * Get borrowing power for a specific token amount
   */
  async getBorrowingPower(
    tokenAddress: string,
    amount: string,
    currentPrice: number
  ): Promise<BorrowingPower> {
    const collateralValueUSD = parseFloat(amount) * currentPrice;
    const maxBorrowUSD = this.calculateBorrowingPower(collateralValueUSD);
    const liquidationPrice = this.calculateLiquidationPrice(
      parseFloat(amount),
      maxBorrowUSD
    );

    return {
      maxBorrowUSD: maxBorrowUSD.toFixed(2),
      availableToBorrow: maxBorrowUSD.toFixed(2),
      currentLTV: 0,
      liquidationPrice: liquidationPrice.toFixed(2),
    };
  }
}

// Export singleton instance
export const collateralService = new CollateralService();
