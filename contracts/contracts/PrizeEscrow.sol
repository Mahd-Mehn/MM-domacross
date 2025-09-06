// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PrizeEscrow
 * @notice Simple ETH escrow contract that collects participant entry fees for an off-chain
 *         competition and releases the full prize pool to the declared winner once finalized.
 *         Owner (backend ops / competition factory) controls lifecycle. Designed for hackathon
 *         demonstration – no complex claim windows or partial distributions.
 */
contract PrizeEscrow is Ownable {
    uint256 public immutable competitionStart;
    uint256 public immutable competitionEnd;
    bool public finalized;
    address public winner;

    event FeeDeposited(address indexed participant, uint256 amount);
    event WinnerFinalized(address indexed winner, uint256 prizeAmount);
    event Refunded(address indexed participant, uint256 amount);

    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    constructor(uint256 _start, uint256 _end, address _owner) Ownable(_owner) {
        require(_end > _start, "invalid window");
        competitionStart = _start;
        competitionEnd = _end;
    }

    modifier onlyActive() {
        require(block.timestamp >= competitionStart && block.timestamp < competitionEnd, "inactive");
        _;
    }

    function deposit() external payable onlyActive {
        require(msg.value > 0, "no value");
        deposits[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit FeeDeposited(msg.sender, msg.value);
    }

    function finalizeAndPay(address _winner) external onlyOwner {
        require(block.timestamp >= competitionEnd, "not ended");
        require(!finalized, "finalized");
        finalized = true;
        winner = _winner;
        uint256 bal = address(this).balance;
        if (_winner != address(0) && bal > 0) {
            (bool ok, ) = _winner.call{value: bal}("");
            require(ok, "transfer failed");
        }
        emit WinnerFinalized(_winner, bal);
    }

    /**
     * @notice Emergency refund path if competition voided. Only callable before finalized.
     *         Iterative – participants call individually to reclaim. Owner toggles by not finalizing.
     */
    function refundSelf() external {
        require(!finalized, "finalized");
        uint256 amt = deposits[msg.sender];
        require(amt > 0, "none");
        deposits[msg.sender] = 0;
        totalDeposits -= amt;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "refund fail");
        emit Refunded(msg.sender, amt);
    }
}
