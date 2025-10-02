# Demo Playbook (3–5 Minutes)

Goal: Convincingly showcase Track 2 value chain: domain trading competition → valuation transparency → ETF economics.

## Prep
```bash
# Backend
cd apps/api
python -m app.cli.seed_demo_dataset
uvicorn app.main:app --reload &
# Frontend
cd ../../apps/web
npm run dev &
```
Open: http://localhost:3000/dashboard?demo=1

## Timeline Script
| Time | Action | Narration |
|------|--------|-----------|
| 0:00 | Show dashboard (Demo Mode badge) | “This is DomaCross – real-time domain trading competitions with ETF yield layer.” |
| 0:30 | Hit Play (Full manifest) | “Replay deterministic 20s sequence: listings, offers, fills, valuations, NAV, flows.” |
| 1:10 | Open Leaderboard panel | “Leaderboard updates live via websocket deltas – participants ranked by risk-adjusted performance.” |
| 1:40 | Open Valuation Transparency panel for `alpha.one` | “Each valuation shows factor blend, primary source, fallback chain, confidence scores.” |
| 2:10 | Navigate to ETF section (NAV & Flow charts) | “ETF wrapper aggregates domain positions; NAV time series + issuance/redemption flows drive fee accrual.” |
| 2:40 | (Optional) Trigger fee distribution via API | “Management/performance fees accrue then distribute—on-chain equivalent endpoints prepared.” |
| 3:00 | (Optional) Call `/valuation/batch` on a domain | “Updates broadcast as `valuation_update`; replay mode can demo without live order flow.” |
| 3:30 | (Optional) Open dispute (POST /valuation/dispute) | “Active dispute clamps valuation drift—stability against manipulation.” |
| 4:00 | Summarize | “DomaCross: transparent valuations, competitive engagement loop, ETF yield narrative—driving domainfi transaction density.” |

## Commands (Optional Live Calls)
```bash
# Trigger new valuation batch
curl -X POST http://localhost:8000/api/v1/valuation/batch -H 'Content-Type: application/json' -d '{"domains":["alpha.one","bravo.one"]}'

# Open a dispute
curl -X POST http://localhost:8000/api/v1/valuation/dispute -H 'Content-Type: application/json' -d '{"domain":"alpha.one","reason":"suspicious spike"}'
```

## Tips
- Keep the manifest replay visible while opening panels (visual continuity).
- Use compact mode for risk charts if screen space limited.
- If latency occurs, narrate architecture layers (websocket seq + replay isolation) while charts catch up.

## Wrap Talking Points
- Deterministic replay = judge reproducibility.
- Ensemble roadmap (already stubbed) = future accuracy & trust.
- Fee & APY story = sustainable economic loop beyond speculation.

End with call to action: “Ready to extend to full Doma orderbook & real on-chain volume.”
