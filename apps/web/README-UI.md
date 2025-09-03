UI Revamp Overview
===================

This document summarizes the hackathon UI revamp work:

Implemented
-----------
1. Design tokens + glass / gradient utilities in `globals.css`.
2. Shared UI primitives in `components/ui/` (Button, Card, Badge, Metric, ThemeToggle).
3. Redesigned pages:
   - Home hero + features + CTA.
   - Competitions listing (filters, skeletons, status badges).
   - Dashboard (metrics, competition summary, activity, sidebar widgets).
   - Trading interface (glass panels, tabbed navigation, surface cards).

Usage Notes
-----------
Button variants: primary | secondary | outline | ghost | danger.
Badge variants: neutral | success | warning | danger | info | outline.

Utility classes introduced:
- `glass` / `glass-dark`: layered translucent surfaces.
- `surface`: subtle elevated panel.
- `gradient-text`: brand gradient text fill.
- `shine`: animated reflective sheen (apply sparingly).

Next Steps (Suggested)
----------------------
1. Integrate real on-chain data streams (replace mock tags).
2. Add chart components (Recharts) to dashboard and competition detail.
3. Implement responsive mobile nav menu.
4. Accessibility audit (focus rings, prefers-reduced-motion variants).
5. Add animated skeleton loaders for trading interface domain retrieval.

Theming
-------
ThemeToggle persists preference to localStorage and toggles `dark` class on `html`.
Currently only dark mode is styled; extend light palette before enabling full switch.

Testing
-------
No visual regression tests included; consider adding Storybook or Chromatic if time permits.
