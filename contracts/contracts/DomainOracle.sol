// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DomainOracle
 * @dev Provides price feeds for domain valuations
 */
contract DomainOracle is Ownable {
    
    struct PriceFeed {
        uint256 price; // Price in ETH wei
        uint256 timestamp;
        uint256 confidence; // Confidence level (0-100)
        bool active;
    }
    
    // Mapping from domain name to price feed
    mapping(string => PriceFeed) public priceFeeds;
    
    // Mapping from domain name to historical prices
    mapping(string => uint256[]) public priceHistory;
    
    // Events
    event PriceUpdated(
        string indexed domainName,
        uint256 price,
        uint256 confidence,
        uint256 timestamp
    );
    
    constructor(address _owner) Ownable(_owner) {
        // Initialize with default prices
        _initializeDefaultPrices();
    }
    
    /**
     * @dev Initialize default domain prices
     */
    function _initializeDefaultPrices() internal {
        _updatePrice("crypto.eth", 5.2 ether, 95);
        _updatePrice("defi.eth", 3.1 ether, 90);
        _updatePrice("web3.eth", 10.5 ether, 88);
        _updatePrice("nft.eth", 7.8 ether, 85);
        _updatePrice("dao.eth", 4.2 ether, 82);
        _updatePrice("metaverse.eth", 2.8 ether, 80);
        _updatePrice("gaming.eth", 1.8 ether, 78);
        _updatePrice("protocol.eth", 6.5 ether, 92);
        _updatePrice("exchange.eth", 8.5 ether, 89);
        _updatePrice("wallet.eth", 6.2 ether, 87);
    }
    
    /**
     * @dev Update price for a domain
     */
    function updatePrice(
        string calldata domainName,
        uint256 price,
        uint256 confidence
    ) external onlyOwner {
        _updatePrice(domainName, price, confidence);
    }
    
    /**
     * @dev Internal function to update price
     */
    function _updatePrice(
        string memory domainName,
        uint256 price,
        uint256 confidence
    ) internal {
        require(price > 0, "Invalid price");
        require(confidence <= 100, "Invalid confidence");
        
        priceFeeds[domainName] = PriceFeed({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            active: true
        });
        
        // Store in history
        priceHistory[domainName].push(price);
        
        emit PriceUpdated(domainName, price, confidence, block.timestamp);
    }
    
    /**
     * @dev Get current price for a domain
     */
    function getPrice(string calldata domainName) 
        external 
        view 
        returns (uint256 price, uint256 timestamp, uint256 confidence) 
    {
        PriceFeed memory feed = priceFeeds[domainName];
        require(feed.active, "Price feed not available");
        
        return (feed.price, feed.timestamp, feed.confidence);
    }
    
    /**
     * @dev Get price history for a domain
     */
    function getPriceHistory(string calldata domainName) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return priceHistory[domainName];
    }
    
    /**
     * @dev Check if price feed exists and is recent
     */
    function isPriceFeedValid(string calldata domainName, uint256 maxAge) 
        external 
        view 
        returns (bool) 
    {
        PriceFeed memory feed = priceFeeds[domainName];
        return feed.active && 
               feed.timestamp > 0 && 
               (block.timestamp - feed.timestamp) <= maxAge;
    }
    
    /**
     * @dev Batch update prices
     */
    function batchUpdatePrices(
        string[] calldata domainNames,
        uint256[] calldata prices,
        uint256[] calldata confidences
    ) external onlyOwner {
        require(
            domainNames.length == prices.length && 
            prices.length == confidences.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < domainNames.length; i++) {
            _updatePrice(domainNames[i], prices[i], confidences[i]);
        }
    }
    
    /**
     * @dev Simulate price movement for demo purposes
     */
    function simulatePriceMovement(string calldata domainName, int256 changePercent) 
        external 
        onlyOwner 
    {
        PriceFeed storage feed = priceFeeds[domainName];
        require(feed.active, "Price feed not available");
        
        // Calculate new price with percentage change
        int256 currentPrice = int256(feed.price);
        int256 priceChange = (currentPrice * changePercent) / 100;
        uint256 newPrice = uint256(currentPrice + priceChange);
        
        require(newPrice > 0, "Invalid price calculation");
        
        _updatePrice(domainName, newPrice, feed.confidence);
    }
}
