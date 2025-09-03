// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ValuationOracle is Ownable {
    mapping(address => uint256) public domainPrices; // domain token address => price in wei
    mapping(address => uint256) public domainRarityScores; // domain token address => rarity score

    event PriceUpdated(address indexed token, uint256 newPrice);
    event RarityScoreUpdated(address indexed token, uint256 newScore);

    constructor(address _owner) Ownable(_owner) {}

    function getDomainPrice(address _domainTokenAddress) external view returns (uint256) {
        return domainPrices[_domainTokenAddress];
    }

    function setDomainPrice(address _domainTokenAddress, uint256 _price) external onlyOwner {
        domainPrices[_domainTokenAddress] = _price;
        emit PriceUpdated(_domainTokenAddress, _price);
    }

    function setDomainRarityScore(address _domainTokenAddress, uint256 _score) external onlyOwner {
        domainRarityScores[_domainTokenAddress] = _score;
        emit RarityScoreUpdated(_domainTokenAddress, _score);
    }

    function getDomainRarityScore(address _domainTokenAddress) external view returns (uint256) {
        return domainRarityScores[_domainTokenAddress];
    }

    // Calculate price based on rarity score and market data
    function calculatePriceWithRarity(address _domainTokenAddress, uint256 _basePrice) external view returns (uint256) {
        uint256 rarityScore = domainRarityScores[_domainTokenAddress];
        if (rarityScore == 0) return _basePrice;
        // Simple multiplier based on rarity (higher score = higher multiplier)
        uint256 multiplier = 100 + (rarityScore / 10); // e.g., score 100 = 110% of base price
        return (_basePrice * multiplier) / 100;
    }
}
