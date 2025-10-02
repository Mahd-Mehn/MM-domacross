// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CollateralVault
 * @dev Manages domain NFTs as collateral for borrowing USDC
 */
contract CollateralVault is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _loanIds;
    
    struct CollateralPosition {
        address domainContract;
        uint256 tokenId;
        uint256 collateralValue; // In ETH wei
        uint256 borrowedAmount; // In USDC wei
        uint256 healthFactor; // Scaled by 1000 (1500 = 1.5)
        uint256 liquidationPrice; // In ETH wei
        uint256 createdAt;
        bool active;
    }
    
    struct LoanRequest {
        address borrower;
        string domainName;
        uint256 tokenId;
        uint256 requestedAmount; // In USDC wei
        uint256 duration; // In seconds
        uint256 collateralRatio; // Scaled by 100 (150 = 150%)
        uint256 apy; // Scaled by 100 (1230 = 12.30%)
    }
    
    // Mapping from user to their collateral positions
    mapping(address => CollateralPosition[]) public userPositions;
    
    // Mapping from loan ID to loan details
    mapping(uint256 => LoanRequest) public loans;
    
    // Mapping from user to their loan IDs
    mapping(address => uint256[]) public userLoans;
    
    // Contract addresses
    IERC20 public immutable usdcToken;
    address public immutable domaOracle;
    
    // Constants
    uint256 public constant MIN_COLLATERAL_RATIO = 120; // 120%
    uint256 public constant LIQUIDATION_THRESHOLD = 110; // 110%
    uint256 public constant MAX_LTV = 66; // 66% max loan-to-value
    
    // Events
    event CollateralDeposited(
        address indexed user,
        address indexed domainContract,
        uint256 indexed tokenId,
        uint256 collateralValue
    );
    
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 duration,
        uint256 apy
    );
    
    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount
    );
    
    event CollateralLiquidated(
        address indexed user,
        uint256 indexed positionIndex,
        uint256 liquidationValue
    );
    
    constructor(
        address _usdcToken,
        address _domaOracle,
        address _owner
    ) Ownable(_owner) {
        usdcToken = IERC20(_usdcToken);
        domaOracle = _domaOracle;
    }
    
    /**
     * @dev Deposit a domain NFT as collateral
     */
    function depositCollateral(
        address domainContract,
        uint256 tokenId,
        uint256 estimatedValue
    ) external nonReentrant {
        require(domainContract != address(0), "Invalid domain contract");
        require(estimatedValue > 0, "Invalid collateral value");
        
        // Transfer domain NFT to vault
        IERC721(domainContract).safeTransferFrom(msg.sender, address(this), tokenId);
        
        // Create collateral position
        CollateralPosition memory position = CollateralPosition({
            domainContract: domainContract,
            tokenId: tokenId,
            collateralValue: estimatedValue,
            borrowedAmount: 0,
            healthFactor: 0, // Will be calculated when borrowing
            liquidationPrice: 0,
            createdAt: block.timestamp,
            active: true
        });
        
        userPositions[msg.sender].push(position);
        
        emit CollateralDeposited(msg.sender, domainContract, tokenId, estimatedValue);
    }
    
    /**
     * @dev Create a loan against deposited collateral
     */
    function createLoan(
        string calldata domainName,
        uint256 tokenId,
        uint256 requestedAmount,
        uint256 duration
    ) external nonReentrant returns (uint256) {
        require(requestedAmount > 0, "Invalid loan amount");
        require(duration > 0, "Invalid duration");
        
        // Find user's collateral position
        CollateralPosition[] storage positions = userPositions[msg.sender];
        uint256 positionIndex = type(uint256).max;
        
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].tokenId == tokenId && positions[i].active) {
                positionIndex = i;
                break;
            }
        }
        
        require(positionIndex != type(uint256).max, "Collateral not found");
        
        CollateralPosition storage position = positions[positionIndex];
        
        // Calculate maximum borrowable amount (66% LTV)
        uint256 maxBorrowable = (position.collateralValue * MAX_LTV) / 100;
        require(requestedAmount <= maxBorrowable, "Exceeds borrowing limit");
        
        // Update position
        position.borrowedAmount = requestedAmount;
        position.healthFactor = calculateHealthFactor(position.collateralValue, requestedAmount);
        position.liquidationPrice = calculateLiquidationPrice(position.collateralValue, requestedAmount);
        
        // Create loan
        _loanIds.increment();
        uint256 loanId = _loanIds.current();
        
        loans[loanId] = LoanRequest({
            borrower: msg.sender,
            domainName: domainName,
            tokenId: tokenId,
            requestedAmount: requestedAmount,
            duration: duration,
            collateralRatio: (position.collateralValue * 100) / requestedAmount,
            apy: 1230 // 12.30% APY
        });
        
        userLoans[msg.sender].push(loanId);
        
        // Transfer USDC to borrower
        require(usdcToken.transfer(msg.sender, requestedAmount), "USDC transfer failed");
        
        emit LoanCreated(loanId, msg.sender, requestedAmount, duration, 1230);
        
        return loanId;
    }
    
    /**
     * @dev Calculate health factor (collateral value / borrowed amount)
     */
    function calculateHealthFactor(uint256 collateralValue, uint256 borrowedAmount) 
        public 
        pure 
        returns (uint256) 
    {
        if (borrowedAmount == 0) return 0;
        return (collateralValue * 1000) / borrowedAmount; // Scaled by 1000
    }
    
    /**
     * @dev Calculate liquidation price
     */
    function calculateLiquidationPrice(uint256 collateralValue, uint256 borrowedAmount) 
        public 
        pure 
        returns (uint256) 
    {
        if (borrowedAmount == 0) return 0;
        return (borrowedAmount * LIQUIDATION_THRESHOLD) / 100;
    }
    
    /**
     * @dev Get user's collateral positions
     */
    function getUserPositions(address user) 
        external 
        view 
        returns (CollateralPosition[] memory) 
    {
        return userPositions[user];
    }
    
    /**
     * @dev Get user's loans
     */
    function getUserLoans(address user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userLoans[user];
    }
    
    /**
     * @dev Get loan details
     */
    function getLoan(uint256 loanId) 
        external 
        view 
        returns (LoanRequest memory) 
    {
        return loans[loanId];
    }
    
    /**
     * @dev Emergency function to withdraw USDC (owner only)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(usdcToken.transfer(owner(), amount), "Transfer failed");
    }
    
    /**
     * @dev Deposit USDC to the vault for lending (owner only)
     */
    function depositUSDC(uint256 amount) external onlyOwner {
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }
}
