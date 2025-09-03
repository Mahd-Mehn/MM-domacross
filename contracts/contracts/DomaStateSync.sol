// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DomaStateSync is Ownable {
    struct CrossChainData {
        uint256 competitionId;
        address user;
        uint256 portfolioValue;
        uint256 timestamp;
    }

    mapping(uint256 => CrossChainData[]) public competitionData; // competitionId => data array

    event StateSynced(uint256 indexed competitionId, address indexed user, uint256 portfolioValue, uint256 fromChain);

    constructor(address _owner) Ownable(_owner) {}

    function syncState(uint256 _competitionId, address _user, uint256 _portfolioValue, uint256 _fromChain) external onlyOwner {
        competitionData[_competitionId].push(CrossChainData({
            competitionId: _competitionId,
            user: _user,
            portfolioValue: _portfolioValue,
            timestamp: block.timestamp
        }));

        emit StateSynced(_competitionId, _user, _portfolioValue, _fromChain);
    }

    function getLatestPortfolio(uint256 _competitionId, address _user) external view returns (uint256) {
        CrossChainData[] memory data = competitionData[_competitionId];
        for (uint256 i = data.length; i > 0; i--) {
            if (data[i-1].user == _user) {
                return data[i-1].portfolioValue;
            }
        }
        return 0;
    }

    function getCompetitionData(uint256 _competitionId) external view returns (CrossChainData[] memory) {
        return competitionData[_competitionId];
    }
}
