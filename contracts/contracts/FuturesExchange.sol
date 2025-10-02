// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FuturesExchange
 * @dev Perpetual futures trading for domain assets with leverage
 */
contract FuturesExchange is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _positionIds;
    Counters.Counter private _contractIds;
    
    struct FuturesContract {
        uint256 id;
        string domainName;
        uint256 strikePrice; // In ETH wei
        uint256 currentPrice; // In ETH wei
        uint256 markPrice; // In ETH wei
        uint256 indexPrice; // In ETH wei
        uint256 volume24h; // In ETH wei
        uint256 openInterest; // In ETH wei
        uint256 fundingRate; // Scaled by 10000 (100 = 1%)
        bool active;
    }
    
    struct FuturesPosition {
        uint256 id;
        address trader;
        uint256 contractId;
        string domainName;
        bool isLong; // true for long, false for short
        uint256 size; // Position size in ETH wei
        uint256 entryPrice; // Entry price in ETH wei
        uint256 margin; // Margin posted in USDC wei
        uint256 leverage; // Leverage multiplier (5 = 5x)
        uint256 liquidationPrice; // Liquidation price in ETH wei
        uint256 unrealizedPnl; // Unrealized PnL in USDC wei
        uint256 createdAt;
        bool active;
    }
    
    struct FuturesOrder {
        uint256 id;
        address trader;
        uint256 contractId;
        bool isLong;
        uint256 size;
        uint256 price; // 0 for market orders
        uint256 margin;
        uint256 leverage;
        OrderType orderType;
        OrderStatus status;
        uint256 createdAt;
    }
    
    enum OrderType { MARKET, LIMIT, STOP }
    enum OrderStatus { PENDING, FILLED, CANCELLED, EXPIRED }
    
    // State mappings
    mapping(uint256 => FuturesContract) public futuresContracts;
    mapping(uint256 => FuturesPosition) public positions;
    mapping(uint256 => FuturesOrder) public orders;
    mapping(address => uint256[]) public userPositions;
    mapping(address => uint256[]) public userOrders;
    mapping(string => uint256) public domainToContract;
    
    // Contract addresses
    IERC20 public immutable usdcToken;
    address public immutable priceOracle;
    
    // Constants
    uint256 public constant MAX_LEVERAGE = 20;
    uint256 public constant MIN_MARGIN = 10 * 10**6; // 10 USDC minimum
    uint256 public constant LIQUIDATION_THRESHOLD = 5; // 5% margin threshold
    
    // Events
    event ContractCreated(
        uint256 indexed contractId,
        string domainName,
        uint256 strikePrice
    );
    
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        uint256 indexed contractId,
        bool isLong,
        uint256 size,
        uint256 entryPrice,
        uint256 margin,
        uint256 leverage
    );
    
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 realizedPnl
    );
    
    event OrderCreated(
        uint256 indexed orderId,
        address indexed trader,
        uint256 indexed contractId,
        bool isLong,
        uint256 size,
        uint256 price,
        OrderType orderType
    );
    
    constructor(
        address _usdcToken,
        address _priceOracle,
        address _owner
    ) Ownable(_owner) {
        usdcToken = IERC20(_usdcToken);
        priceOracle = _priceOracle;
        
        // Initialize default contracts
        _createDefaultContracts();
    }
    
    /**
     * @dev Create default futures contracts for popular domains
     */
    function _createDefaultContracts() internal {
        _createContract("crypto.eth", 5 ether, 5.2 ether);
        _createContract("defi.eth", 3 ether, 3.1 ether);
        _createContract("web3.eth", 10 ether, 10.5 ether);
        _createContract("nft.eth", 7.5 ether, 7.8 ether);
    }
    
    /**
     * @dev Create a new futures contract
     */
    function _createContract(
        string memory domainName,
        uint256 strikePrice,
        uint256 currentPrice
    ) internal returns (uint256) {
        _contractIds.increment();
        uint256 contractId = _contractIds.current();
        
        futuresContracts[contractId] = FuturesContract({
            id: contractId,
            domainName: domainName,
            strikePrice: strikePrice,
            currentPrice: currentPrice,
            markPrice: currentPrice,
            indexPrice: currentPrice,
            volume24h: 0,
            openInterest: 0,
            fundingRate: 100, // 1% funding rate
            active: true
        });
        
        domainToContract[domainName] = contractId;
        
        emit ContractCreated(contractId, domainName, strikePrice);
        return contractId;
    }
    
    /**
     * @dev Open a new futures position
     */
    function openPosition(
        uint256 contractId,
        bool isLong,
        uint256 size,
        uint256 leverage,
        uint256 marginAmount
    ) external nonReentrant returns (uint256) {
        require(futuresContracts[contractId].active, "Contract not active");
        require(leverage > 0 && leverage <= MAX_LEVERAGE, "Invalid leverage");
        require(marginAmount >= MIN_MARGIN, "Insufficient margin");
        require(size > 0, "Invalid position size");
        
        FuturesContract storage futuresContract = futuresContracts[contractId];
        
        // Calculate required margin
        uint256 requiredMargin = (size * futuresContract.currentPrice) / leverage / 1e18;
        require(marginAmount >= requiredMargin, "Insufficient margin for leverage");
        
        // Transfer margin from user
        require(usdcToken.transferFrom(msg.sender, address(this), marginAmount), "Margin transfer failed");
        
        // Calculate liquidation price
        uint256 liquidationPrice = calculateLiquidationPrice(
            futuresContract.currentPrice,
            isLong,
            leverage
        );
        
        // Create position
        _positionIds.increment();
        uint256 positionId = _positionIds.current();
        
        positions[positionId] = FuturesPosition({
            id: positionId,
            trader: msg.sender,
            contractId: contractId,
            domainName: futuresContract.domainName,
            isLong: isLong,
            size: size,
            entryPrice: futuresContract.currentPrice,
            margin: marginAmount,
            leverage: leverage,
            liquidationPrice: liquidationPrice,
            unrealizedPnl: 0,
            createdAt: block.timestamp,
            active: true
        });
        
        userPositions[msg.sender].push(positionId);
        
        // Update contract stats
        futuresContract.openInterest += size;
        futuresContract.volume24h += size;
        
        emit PositionOpened(
            positionId,
            msg.sender,
            contractId,
            isLong,
            size,
            futuresContract.currentPrice,
            marginAmount,
            leverage
        );
        
        return positionId;
    }
    
    /**
     * @dev Close a futures position
     */
    function closePosition(uint256 positionId) external nonReentrant {
        FuturesPosition storage position = positions[positionId];
        require(position.trader == msg.sender, "Not position owner");
        require(position.active, "Position not active");
        
        FuturesContract storage futuresContract = futuresContracts[position.contractId];
        
        // Calculate realized PnL
        uint256 realizedPnl = calculateRealizedPnl(
            position.entryPrice,
            futuresContract.currentPrice,
            position.size,
            position.isLong
        );
        
        // Update position
        position.active = false;
        position.unrealizedPnl = realizedPnl;
        
        // Update contract stats
        futuresContract.openInterest -= position.size;
        
        // Transfer margin + PnL back to trader
        uint256 totalReturn = position.margin + realizedPnl;
        require(usdcToken.transfer(msg.sender, totalReturn), "Return transfer failed");
        
        emit PositionClosed(positionId, msg.sender, realizedPnl);
    }
    
    /**
     * @dev Calculate liquidation price
     */
    function calculateLiquidationPrice(
        uint256 entryPrice,
        bool isLong,
        uint256 leverage
    ) public pure returns (uint256) {
        uint256 liquidationThreshold = (100 - LIQUIDATION_THRESHOLD) * 100 / leverage;
        
        if (isLong) {
            return entryPrice * (10000 - liquidationThreshold) / 10000;
        } else {
            return entryPrice * (10000 + liquidationThreshold) / 10000;
        }
    }
    
    /**
     * @dev Calculate realized PnL
     */
    function calculateRealizedPnl(
        uint256 entryPrice,
        uint256 exitPrice,
        uint256 size,
        bool isLong
    ) public pure returns (uint256) {
        if (isLong) {
            if (exitPrice > entryPrice) {
                return ((exitPrice - entryPrice) * size) / 1e18;
            } else {
                return 0; // Loss handled separately
            }
        } else {
            if (entryPrice > exitPrice) {
                return ((entryPrice - exitPrice) * size) / 1e18;
            } else {
                return 0; // Loss handled separately
            }
        }
    }
    
    /**
     * @dev Update contract prices (oracle or admin)
     */
    function updateContractPrice(uint256 contractId, uint256 newPrice) external onlyOwner {
        require(futuresContracts[contractId].active, "Contract not active");
        
        FuturesContract storage futuresContract = futuresContracts[contractId];
        futuresContract.currentPrice = newPrice;
        futuresContract.markPrice = newPrice;
        futuresContract.indexPrice = newPrice;
    }
    
    /**
     * @dev Get user's active positions
     */
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }
    
    /**
     * @dev Get position details
     */
    function getPosition(uint256 positionId) external view returns (FuturesPosition memory) {
        return positions[positionId];
    }
    
    /**
     * @dev Get contract details
     */
    function getContract(uint256 contractId) external view returns (FuturesContract memory) {
        return futuresContracts[contractId];
    }
    
    /**
     * @dev Get all active contracts
     */
    function getAllContracts() external view returns (FuturesContract[] memory) {
        uint256 activeCount = 0;
        
        // Count active contracts
        for (uint256 i = 1; i <= _contractIds.current(); i++) {
            if (futuresContracts[i].active) {
                activeCount++;
            }
        }
        
        // Create array of active contracts
        FuturesContract[] memory activeContracts = new FuturesContract[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= _contractIds.current(); i++) {
            if (futuresContracts[i].active) {
                activeContracts[index] = futuresContracts[i];
                index++;
            }
        }
        
        return activeContracts;
    }
}
