// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Competition.sol";

contract CompetitionFactory {
    address[] public deployedCompetitions;

    event CompetitionCreated(address indexed competitionAddress, uint256 startTime, uint256 endTime);

    function createCompetition(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _entryFee,
        address _valuationOracle
    ) external {
        Competition newCompetition = new Competition(_startTime, _endTime, _entryFee, _valuationOracle, msg.sender);
        deployedCompetitions.push(address(newCompetition));
        emit CompetitionCreated(address(newCompetition), _startTime, _endTime);
    }

    function getDeployedCompetitions() external view returns (address[] memory) {
        return deployedCompetitions;
    }
}
