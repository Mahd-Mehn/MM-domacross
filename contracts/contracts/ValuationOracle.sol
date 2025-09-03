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

    // Calculate price based on outstanding orders
    function calculatePriceFromOrders(address _domainTokenAddress, uint256 _basePrice) external view returns (uint256) {
        // Placeholder: integrate with marketplace to get average order price
        // For now, return base price
        return _basePrice;
    }
}
