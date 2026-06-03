# Coach & Club — Free vs Paid Spec

Decided 2 June 2026.

## Coach — Freemium (limited forever)

A coach can use a limited version forever and pays to unlock the full squad experience.

| Capability | 🆓 Free Coach | ⭐ Paid Coach |
|---|---|---|
| Price | £0 | £34.99/mo · £299/yr |
| Players | **Up to 5** | **Up to 30** |
| Invite code & squad list | ✅ | ✅ |
| Basic player readiness | ✅ | ✅ |
| Announcements | ✅ | ✅ |
| **Players get free Premium** | ❌ players stay on free tier | ✅ all players get full Premium |
| **Squad analytics & testing** (stat cards, most-improved, readiness heatmap, leaderboards, testing results, improvements, compliance) | ❌ locked | ✅ |
| **Schedule & programmes** (set squad schedule, periodised programme builds) | ❌ locked | ✅ |

### Free coach experience
- Home: invite code, players list (max 5), group filter, announcements
- Locked behind upgrade: analytics blocks on Home, Schedule tab, History tab, Tests tab
- Players linked to a FREE coach do NOT inherit Premium — they stay on the free tier

### Conversion hook
Coach feels the value with up to 5 players, then upgrades to unlock analytics, the schedule/programme engine, and to give the whole squad Premium for free.

## Club / Academy — Sales-led

- **No self-serve free tier or checkout.**
- The Club option on the paywall leads to a **"Book a demo / Contact us"** flow instead of pricing.
- Pricing negotiated per club (academy deals). Indicative: £99.99/mo · £899/yr.

## Implementation notes
- `CoachDashboard` takes `isPaid` + `onUpgrade`; gates analytics/schedule/tests when free.
- Free player cap = 5 (`maxPlayers`), paid = 30, club = unlimited (sales-led).
- Paywall: `accountType === 'club'` shows a contact CTA, not buy buttons.
- "Players get Premium" gating is enforced server-side once squad linking exists.
