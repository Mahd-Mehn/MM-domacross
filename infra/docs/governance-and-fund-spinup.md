# Governance & Fund Spin-Up (Draft)

This document outlines the workflow for initializing a governed competition fund:

1. Deploy PrizeEscrow with start/end times.
2. Record deployed address in governance_config (key: PRIZE_ESCROW_<COMP_ID>). 
3. Participants deposit entry fees (UI wires eth -> deposit()).
4. Off-chain service determines winner, calls finalizeAndPay().
5. Audit event emitted via backend capturing tx hash & winner.

Future Enhancements:
- Multi-winner split logic.
- Timelocked governance controlled finalize.
- ERC20 denominated fees (USDC) via MockUSDC integration.
