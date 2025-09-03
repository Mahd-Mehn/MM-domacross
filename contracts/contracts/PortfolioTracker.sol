// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ValuationOracle.sol";

contract PortfolioTracker {
    ValuationOracle public immutable valuationOracle;

    // user => domain token addresses
    mapping(address => address[]) public userDomains;
    // user => value
    mapping(address => uint256) public portfolioValues;

    event PortfolioUpdated(address indexed user, uint256 newValue);

    constructor(address _oracleAddress) {
        valuationOracle = ValuationOracle(_oracleAddress);
    }

    function addDomain(address _user, address _domainToken) external {
        userDomains[_user].push(_domainToken);
        _updatePortfolioValue(_user);
    }

    function removeDomain(address _user, address _domainToken) external {
        address[] storage domains = userDomains[_user];
        for (uint256 i = 0; i < domains.length; i++) {
            if (domains[i] == _domainToken) {
                domains[i] = domains[domains.length - 1];
                domains.pop();
                break;
            }
        }
        _updatePortfolioValue(_user);
    }

    function updatePortfolioValue(address _user) external {
        _updatePortfolioValue(_user);
    }

    function _updatePortfolioValue(address _user) internal {
        address[] memory domains = userDomains[_user];
        uint256 totalValue = 0;
        for (uint256 i = 0; i < domains.length; i++) {
            totalValue += valuationOracle.getDomainPrice(domains[i]);
        }
        portfolioValues[_user] = totalValue;
        emit PortfolioUpdated(_user, totalValue);
    }

    function getUserDomains(address _user) external view returns (address[] memory) {
        return userDomains[_user];
    }
}
