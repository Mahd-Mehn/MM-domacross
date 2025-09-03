// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PortfolioTracker.sol";

contract Competition is Ownable {
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable entryFee;
    PortfolioTracker public immutable portfolioTracker;

    address[] public participants;
    mapping(address => bool) public isParticipant;
    mapping(address => uint256) public finalPortfolioValues;
    bool public ended;
    address public winner;

    event ParticipantJoined(address indexed participant);
    event CompetitionEnded(address indexed winner, uint256 prizePool);

    constructor(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _entryFee,
        address _valuationOracle,
        address _owner
    ) Ownable(_owner) {
        startTime = _startTime;
        endTime = _endTime;
        entryFee = _entryFee;
        portfolioTracker = new PortfolioTracker(_valuationOracle);
    }

    function join() external payable {
        require(block.timestamp >= startTime && block.timestamp < endTime, "Competition not active");
        require(msg.value == entryFee, "Incorrect entry fee");
        require(!isParticipant[msg.sender], "Already a participant");

        participants.push(msg.sender);
        isParticipant[msg.sender] = true;
        emit ParticipantJoined(msg.sender);
    }

    function endCompetition() external onlyOwner {
        require(block.timestamp >= endTime, "Competition not yet ended");
        require(!ended, "Competition already ended");

        ended = true;
        uint256 maxValue = 0;
        address currentWinner = address(0);

        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            uint256 value = portfolioTracker.portfolioValues(participant);
            finalPortfolioValues[participant] = value;
            if (value > maxValue) {
                maxValue = value;
                currentWinner = participant;
            }
        }

        winner = currentWinner;
        uint256 prizePool = address(this).balance;
        if (currentWinner != address(0)) {
            payable(currentWinner).transfer(prizePool);
        }
        emit CompetitionEnded(currentWinner, prizePool);
    }

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }
}
