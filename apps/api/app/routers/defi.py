from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.database import (
    User as UserModel,
    CollateralPosition,
    FuturesPosition,
    MarketplaceTransaction
)
from decimal import Decimal
import json

router = APIRouter()
# Pydantic models for DeFi operations
class CollateralDepositRequest(BaseModel):
    domain_contract: str
    token_id: str
    estimated_value: str  # ETH value in wei
    domain_name: str

class CollateralDepositResponse(BaseModel):
    position_id: str
    domain_name: str
    collateral_value: str
    max_borrowable: str
    health_factor: float
    status: str

class LoanRequest(BaseModel):
    domain_name: str
    token_id: str
    requested_amount: str  # USDC amount in wei
    duration_days: int
    collateral_ratio: int  # e.g., 150 for 150%

class LoanResponse(BaseModel):
    loan_id: str
    borrower: str
    amount: str
    duration_days: int
    apy: float
    health_factor: float
    liquidation_price: str
    status: str

class FuturesPositionRequest(BaseModel):
    contract_id: str
    side: str  # "long" or "short"
    size: str  # Position size in ETH wei
    leverage: int  # 1-20x
    margin_amount: str  # USDC margin in wei

class FuturesPositionResponse(BaseModel):
    position_id: str
    trader: str
    contract_id: str
    domain_name: str
    side: str
    size: str
    entry_price: str
    margin: str
    leverage: int
    liquidation_price: str
    unrealized_pnl: str
    health_factor: float
    status: str

class RiskMetrics(BaseModel):
    portfolio_value: str
    total_collateral: str
    total_debt: str
    net_value: str
    overall_health_factor: float
    liquidation_risk: str  # "low", "medium", "high", "critical"
    var_95: str  # Value at Risk 95%
    max_drawdown: float

# Mock data for demonstration
MOCK_DOMAIN_PRICES = {
    "crypto.eth": "5200000000000000000",  # 5.2 ETH
    "defi.eth": "3100000000000000000",    # 3.1 ETH
    "web3.eth": "10500000000000000000",   # 10.5 ETH
    "nft.eth": "7800000000000000000",     # 7.8 ETH
    "dao.eth": "4200000000000000000",     # 4.2 ETH
}

MOCK_FUTURES_CONTRACTS = [
    {
        "id": "1",
        "domain_name": "crypto.eth",
        "strike_price": "5000000000000000000",
        "current_price": "5200000000000000000",
        "mark_price": "5210000000000000000",
        "index_price": "5190000000000000000",
        "volume_24h": "1250000000000000000000",
        "open_interest": "450000000000000000000",
        "funding_rate": 0.01,
        "contract_type": "perpetual"
    },
    {
        "id": "2",
        "domain_name": "defi.eth",
        "strike_price": "3000000000000000000",
        "current_price": "3100000000000000000",
        "mark_price": "3110000000000000000",
        "index_price": "3090000000000000000",
        "volume_24h": "850000000000000000000",
        "open_interest": "320000000000000000000",
        "funding_rate": 0.008,
        "contract_type": "perpetual"
    }
]

@router.post("/vault/deposit", response_model=CollateralDepositResponse)
async def deposit_collateral(
    request: CollateralDepositRequest,
    db: Session = Depends(get_db)
):
    """Deposit a domain NFT as collateral"""
    
    # Validate domain exists and get price
    domain_price = MOCK_DOMAIN_PRICES.get(request.domain_name)
    if not domain_price:
        raise HTTPException(status_code=404, detail="Domain price not found")
    
    # Calculate max borrowable (66% LTV)
    collateral_value = int(request.estimated_value)
    max_borrowable = int(collateral_value * 0.66)
    
    # Calculate initial health factor (no debt yet)
    health_factor = 0.0  # Will be set when borrowing
    
    # Generate mock position ID
    position_id = f"pos_{request.domain_name}_{datetime.utcnow().timestamp()}"
    
    return CollateralDepositResponse(
        position_id=position_id,
        domain_name=request.domain_name,
        collateral_value=str(collateral_value),
        max_borrowable=str(max_borrowable),
        health_factor=health_factor,
        status="active"
    )

@router.post("/vault/borrow", response_model=LoanResponse)
async def create_loan(
    request: LoanRequest,
    db: Session = Depends(get_db)
):
    """Create a loan against deposited collateral"""
    
    # Get domain price for calculations
    domain_price = MOCK_DOMAIN_PRICES.get(request.domain_name)
    if not domain_price:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    collateral_value = int(domain_price)
    requested_amount = int(request.requested_amount)
    
    # Validate borrowing limits (66% max LTV)
    max_borrowable = int(collateral_value * 0.66)
    if requested_amount > max_borrowable:
        raise HTTPException(status_code=400, detail="Exceeds borrowing limit")
    
    # Calculate health factor
    health_factor = (collateral_value / requested_amount) if requested_amount > 0 else 0
    
    # Calculate liquidation price (120% collateral ratio)
    liquidation_price = int(requested_amount * 1.2)
    
    # Generate mock loan ID
    loan_id = f"loan_{request.domain_name}_{datetime.utcnow().timestamp()}"
    
    return LoanResponse(
        loan_id=loan_id,
        borrower="0x" + "0" * 40,  # Mock address
        amount=str(requested_amount),
        duration_days=request.duration_days,
        apy=12.3,  # 12.3% APY
        health_factor=health_factor,
        liquidation_price=str(liquidation_price),
        status="active"
    )

@router.get("/vault/positions")
async def get_vault_positions(
    user_address: str = Query(..., description="User wallet address"),
    db: Session = Depends(get_db)
):
    """Get user's collateral vault positions from database first, fallback to mock"""
    try:
        # Priority 1: Query database for real positions
        user = db.query(UserModel).filter(UserModel.wallet_address.ilike(user_address)).first()
        
        positions_response = []
        
        if user:
            # Get collateral positions from database
            db_positions = db.query(CollateralPosition).filter(
                CollateralPosition.user_id == user.id,
                CollateralPosition.status == 'active'
            ).order_by(CollateralPosition.created_at.desc()).all()
            
            for pos in db_positions:
                # Calculate current health factor and liquidation price using domain oracle
                # This would integrate with the DomainOracle smart contract
                current_value = await _get_domain_current_value(pos.domain_contract, pos.token_id, pos.chain_id)
                health_factor = float(current_value) / float(pos.borrowed_amount) if pos.borrowed_amount > 0 else 999.0
                liquidation_price = float(pos.borrowed_amount) * 1.5 if pos.borrowed_amount > 0 else 0  # 150% collateralization ratio
                
                positions_response.append({
                    "id": f"pos_{pos.id}",
                    "domain_name": pos.domain_name or f"domain_{pos.token_id}",
                    "token_id": pos.token_id,
                    "contract_address": pos.domain_contract,
                    "collateral_value": str(pos.collateral_value),
                    "borrowed_amount": str(pos.borrowed_amount),
                    "health_factor": round(health_factor, 2),
                    "liquidation_price": str(int(liquidation_price)),
                    "chain_id": pos.chain_id,
                    "apy": 12.3,  # This would come from DeFi protocol calculations
                    "created_at": pos.created_at.isoformat(),
                    "updated_at": pos.updated_at.isoformat(),
                    "status": pos.status
                })
        
        # Priority 2: If no database positions, check if we can fetch from Doma SDK or create sample data
        if len(positions_response) == 0:
            # Try to fetch any domain holdings that could be used as collateral
            try:
                # This would integrate with Doma SDK to find user's domain holdings
                domain_holdings = await _fetch_user_domain_holdings(user_address)
                
                # Create potential collateral positions from domain holdings
                for holding in domain_holdings:
                    estimated_value = await _get_domain_current_value(holding["contract"], holding["tokenId"], "eip155:1")
                    
                    positions_response.append({
                        "id": f"potential_{holding['tokenId']}",
                        "domain_name": holding.get("domain_name", f"domain_{holding['tokenId']}"),
                        "token_id": holding["tokenId"],
                        "contract_address": holding["contract"],
                        "collateral_value": str(estimated_value),
                        "borrowed_amount": "0",
                        "health_factor": 999.0,
                        "liquidation_price": "0",
                        "chain_id": "eip155:1",
                        "apy": 12.3,
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                        "status": "potential"  # Not yet deposited as collateral
                    })
                    
            except Exception as sdk_error:
                print(f"Failed to fetch domain holdings: {sdk_error}")
        
        # Priority 3: Fallback to mock data if both database and SDK fail
        if len(positions_response) == 0:
            positions_response = [
                {
                    "id": "pos_crypto_eth_1",
                    "domain_name": "crypto.eth",
                    "token_id": "123",
                    "contract_address": "0x1234567890123456789012345678901234567890",
                    "collateral_value": "5200000000000000000",
                    "borrowed_amount": "2000000000000000000",
                    "health_factor": 1.85,
                    "liquidation_price": "1500000000000000000",
                    "chain_id": "eip155:1",
                    "apy": 12.3,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                    "status": "active"
                }
            ]
        
        return {"positions": positions_response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get vault positions: {str(e)}")

async def _get_domain_current_value(contract: str, token_id: str, chain_id: str) -> int:
    """Get current domain value from DomainOracle or external pricing"""
    # This would integrate with the DomainOracle smart contract
    # For now, return a simulated value
    base_value = 5000000000000000000  # 5 ETH base
    # Add some variation based on token_id
    variation = int(token_id) % 1000 * 1000000000000000  # Up to 1 ETH variation
    return base_value + variation

async def _fetch_user_domain_holdings(user_address: str):
    """Fetch user's domain holdings that could be used as collateral"""
    # This would integrate with Doma SDK to get user's domain NFTs
    # For now, return simulated holdings
    return [
        {
            "contract": "0x1234567890123456789012345678901234567890",
            "tokenId": "456",
            "domain_name": "defi.eth"
        }
    ]

@router.post("/futures/open", response_model=FuturesPositionResponse)
async def open_futures_position(
    request: FuturesPositionRequest,
    db: Session = Depends(get_db)
):
    """Open a new futures position"""
    
    # Find the futures contract
    contract = None
    for c in MOCK_FUTURES_CONTRACTS:
        if c["id"] == request.contract_id:
            contract = c
            break
    
    if not contract:
        raise HTTPException(status_code=404, detail="Futures contract not found")
    
    # Validate leverage
    if request.leverage < 1 or request.leverage > 20:
        raise HTTPException(status_code=400, detail="Invalid leverage (1-20x)")
    
    # Calculate position details
    size = int(request.size)
    margin = int(request.margin_amount)
    entry_price = int(contract["current_price"])
    leverage = request.leverage
    
    # Calculate liquidation price
    if request.side == "long":
        liquidation_price = int(entry_price * (1 - 0.8 / leverage))
    else:
        liquidation_price = int(entry_price * (1 + 0.8 / leverage))
    
    # Calculate health factor based on margin
    health_factor = (margin * leverage) / size if size > 0 else 0
    
    # Generate position ID
    position_id = f"fut_{contract['domain_name']}_{datetime.utcnow().timestamp()}"
    
    return FuturesPositionResponse(
        position_id=position_id,
        trader="0x" + "0" * 40,  # Mock address
        contract_id=request.contract_id,
        domain_name=contract["domain_name"],
        side=request.side,
        size=str(size),
        entry_price=str(entry_price),
        margin=str(margin),
        leverage=leverage,
        liquidation_price=str(liquidation_price),
        unrealized_pnl="0",  # Initial PnL is 0
        health_factor=health_factor,
        status="active"
    )

@router.get("/futures/positions")
async def get_futures_positions(
    user_address: str = Query(..., description="User wallet address"),
    db: Session = Depends(get_db)
):
    """Get user's active futures positions from database first, fallback to mock"""
    try:
        # Priority 1: Query database for real futures positions
        user = db.query(UserModel).filter(UserModel.wallet_address.ilike(user_address)).first()
        
        positions_response = []
        
        if user:
            # Get futures positions from database
            db_positions = db.query(FuturesPosition).filter(
                FuturesPosition.user_id == user.id,
                FuturesPosition.status.in_(['open', 'active'])
            ).order_by(FuturesPosition.opened_at.desc()).all()
            
            for pos in db_positions:
                # Calculate current mark price and PnL using domain oracle
                current_mark_price = await _get_domain_current_value(
                    "0x1234567890123456789012345678901234567890",  # Domain contract
                    "1",  # Token ID (would be derived from domain_name)
                    pos.chain_id
                )
                
                # Calculate unrealized PnL
                price_diff = current_mark_price - int(pos.entry_price)
                if pos.side == "short":
                    price_diff = -price_diff
                
                unrealized_pnl = (int(pos.size) * price_diff) // int(pos.entry_price)
                
                # Calculate health factor based on margin and PnL
                total_margin_value = int(pos.margin) + unrealized_pnl
                health_factor = total_margin_value / int(pos.margin) if int(pos.margin) > 0 else 1.0
                
                positions_response.append({
                    "id": f"fut_{pos.id}",
                    "trader": user_address,
                    "contract_id": pos.contract_id,
                    "domain_name": pos.domain_name,
                    "side": pos.side,
                    "size": str(pos.size),
                    "entry_price": str(pos.entry_price),
                    "mark_price": str(current_mark_price),
                    "margin": str(pos.margin),
                    "leverage": float(pos.leverage),
                    "liquidation_price": str(pos.liquidation_price),
                    "unrealized_pnl": str(unrealized_pnl),
                    "health_factor": round(health_factor, 2),
                    "chain_id": pos.chain_id,
                    "opened_at": pos.opened_at.isoformat(),
                    "updated_at": pos.updated_at.isoformat(),
                    "status": pos.status
                })
        
        # Priority 2: If no database positions, try to create sample positions based on collateral
        if len(positions_response) == 0 and user:
            # Check if user has collateral that could be used for futures trading
            collateral_positions = db.query(CollateralPosition).filter(
                CollateralPosition.user_id == user.id,
                CollateralPosition.status == 'active'
            ).limit(3).all()
            
            for i, collateral in enumerate(collateral_positions):
                # Create a potential futures position based on available collateral
                available_margin = int(collateral.collateral_value) // 4  # 25% of collateral value as margin
                if available_margin > 1000000000:  # At least 1000 USDC equivalent
                    current_price = await _get_domain_current_value(
                        collateral.domain_contract,
                        collateral.token_id,
                        collateral.chain_id
                    )
                    
                    positions_response.append({
                        "id": f"potential_fut_{i}",
                        "trader": user_address,
                        "contract_id": str(i + 1),
                        "domain_name": collateral.domain_name or f"domain_{collateral.token_id}",
                        "side": "long",
                        "size": str(available_margin * 5),  # 5x leverage
                        "entry_price": str(current_price),
                        "mark_price": str(current_price),
                        "margin": str(available_margin),
                        "leverage": 5.0,
                        "liquidation_price": str(int(current_price * 0.8)),  # 20% below entry
                        "unrealized_pnl": "0",
                        "health_factor": 5.0,
                        "chain_id": collateral.chain_id,
                        "opened_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                        "status": "potential"  # Not yet opened
                    })
        
        # Priority 3: Fallback to mock data if both database queries return empty
        if len(positions_response) == 0:
            positions_response = [
                {
                    "id": "fut_crypto_eth_1",
                    "trader": user_address,
                    "contract_id": "1",
                    "domain_name": "crypto.eth",
                    "side": "long",
                    "size": "2000000000000000000",  # 2 ETH
                    "entry_price": "5000000000000000000",  # 5 ETH
                    "mark_price": "5200000000000000000",   # 5.2 ETH
                    "margin": "1000000000",  # 1000 USDC
                    "leverage": 5.0,
                    "liquidation_price": "4500000000000000000",  # 4.5 ETH
                    "unrealized_pnl": "400000000",  # 400 USDC profit
                    "health_factor": 2.5,
                    "chain_id": "eip155:1",
                    "opened_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                    "status": "active"
                }
            ]
        
        return {"positions": positions_response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get futures positions: {str(e)}")

@router.get("/futures/contracts")
async def get_futures_contracts():
    """Get all available futures contracts"""
    return {"contracts": MOCK_FUTURES_CONTRACTS}

@router.get("/risk/metrics", response_model=RiskMetrics)
async def get_risk_metrics(
    user_address: str = Query(..., description="User wallet address"),
    db: Session = Depends(get_db)
):
    """Get user's risk metrics and portfolio health"""
    
    # Mock risk metrics
    return RiskMetrics(
        portfolio_value="25000000000000000000",  # 25 ETH
        total_collateral="15000000000000000000",  # 15 ETH
        total_debt="5000000000000000000",         # 5 ETH
        net_value="20000000000000000000",         # 20 ETH
        overall_health_factor=1.85,
        liquidation_risk="low",
        var_95="2000000000000000000",             # 2 ETH
        max_drawdown=12.5
    )

@router.get("/oracle/price/{domain_name}")
async def get_domain_price(
    domain_name: str,
    db: Session = Depends(get_db)
):
    """Get current price for a domain from oracle"""
    
    price = MOCK_DOMAIN_PRICES.get(domain_name)
    if not price:
        raise HTTPException(status_code=404, detail="Domain price not found")
    
    return {
        "domain_name": domain_name,
        "price": price,
        "timestamp": datetime.utcnow().isoformat(),
        "confidence": 95,
        "source": "doma_oracle"
    }

@router.post("/oracle/update-price")
async def update_domain_price(
    domain_name: str,
    price: str,
    confidence: int = 95,
    db: Session = Depends(get_db)
):
    """Update domain price (admin only - for demo purposes)"""
    
    # In production, this would be restricted to oracle or admin
    MOCK_DOMAIN_PRICES[domain_name] = price
    
    return {
        "domain_name": domain_name,
        "price": price,
        "confidence": confidence,
        "updated_at": datetime.utcnow().isoformat()
    }

@router.get("/health")
async def defi_health_check():
    """Health check for DeFi services"""
    return {
        "status": "healthy",
        "services": {
            "collateral_vault": "active",
            "futures_exchange": "active",
            "price_oracle": "active",
            "risk_engine": "active"
        },
        "timestamp": datetime.utcnow().isoformat()
    }
