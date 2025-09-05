// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title CompetitionSettlement
/// @notice Minimal on-chain payout contract for distributing USDC prizes for competitions.
/// Owner triggers a batched payout; contract transfers USDC from owner to recipients and emits events.
contract CompetitionSettlement is Ownable {
    IERC20 public immutable usdc;

    event SettlementFinalized(uint256 indexed competitionId, uint256 totalAmount, uint256 recipientCount);
    event PrizePaid(uint256 indexed competitionId, address indexed recipient, uint256 amount);

    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "USDC required");
        usdc = IERC20(_usdc);
    }

    /// @notice Execute a batched prize payout for a competition.
    /// @dev Requires prior approval from msg.sender for the total USDC amount to be transferred.
    function finalizeAndPayout(
        uint256 competitionId,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(recipients.length == amounts.length, "len mismatch");
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            address to = recipients[i];
            uint256 amt = amounts[i];
            require(to != address(0), "bad recipient");
            if (amt == 0) continue;
            total += amt;
            // Pull USDC from owner to recipient (no need to pre-fund contract)
            require(usdc.transferFrom(owner(), to, amt), "transfer failed");
            emit PrizePaid(competitionId, to, amt);
        }
        emit SettlementFinalized(competitionId, total, recipients.length);
    }
}
