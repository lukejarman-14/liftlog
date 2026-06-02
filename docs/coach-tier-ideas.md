# Coach Tier — Product Ideas

## Overview
Two account types: Personal (existing) and Coach (new).
Coach pays one subscription → up to 30 players get full premium access included.
Players pay nothing extra. Coach buys seats for their squad.

---

## Pricing

| Tier     | Monthly   | Yearly    | Lifetime |
|----------|-----------|-----------|----------|
| Personal | £7.99/mo  | £79.99/yr | £150     |
| Coach    | £34.99/mo | £299/yr   | ❌        |

- Coach yearly = ~£25/mo (reward loyalty)
- No lifetime for coaches — value is ongoing (squad management, new features)

---

## How It Works

### Coach signs up
1. Selects Coach plan on paywall
2. Gets a unique team invite code (e.g. `VF-LUKE7`) in their profile
3. Sees a Squad tab showing 0/30 players linked

### Player joins
1. Signs up normally OR enters invite code in settings
2. App asks "Join [Coach Name]'s squad?" → player confirms
3. Premium unlocks immediately — no payment needed
4. Coach squad count increments (e.g. 0 → 1)

### Coach cancels
1. All linked players instantly lose premium access
2. Players receive push notification: "Your coach's subscription has ended. Upgrade to Personal to keep your progress."
3. Player data fully preserved — only premium features locked
4. Players can independently upgrade to Personal at any time

---

## Key Rules

- Player can only be linked to **one** coach at a time
- Player trying to join a second coach sees an error: "You're already linked to a coach. Leave that squad first."
- If a player already has a Personal subscription and joins a coach → prompt to cancel personal sub (no point paying twice)
- Coach can **remove** a player from their squad (e.g. player leaves the club)
- Player can **leave** a squad themselves at any time

---

## Invite Code System (Option A)

- Coach gets a unique code generated from their user ID (similar to referral code system already built)
- Code displayed in Coach's profile/Squad tab
- Players enter code during onboarding ("Do you have a team code?") or later in Settings
- Code is permanent unless coach regenerates it

---

## App Changes Required

| Area | Change |
|---|---|
| Paywall | Add Coach tier (monthly + yearly only) |
| Onboarding | Optional "Do you have a team code?" step |
| Profile/Settings | Players see "Your Squad" — coach name + leave button |
| Coach dashboard | New Squad tab — readiness overview, last session, programme status per player |
| Supabase | `teams` table, `team_members` table, RLS policies for coach read access |
| RevenueCat | New Coach monthly + Coach yearly products |
| Notifications | Alert players when coach subscription ends |

---

## Coach Dashboard Ideas

Per player card:
- Readiness score today (sleep/fatigue/stress)
- Last session completed + date
- Current programme
- Testing battery results + trend
- Sessions this week vs target

Squad aggregate view:
- Readiness heatmap (red/amber/green per player)
- Who hasn't logged in this week
- Average squad readiness trend over time

Coach-only features:
- Assign programmes to one or all players
- Build and send custom workouts
- Set shared match schedule for the squad
- Per-player coach notes (not visible to player)

---

## Privacy

- Players must explicitly consent to sharing data with their coach
- Players can unlink at any time
- Coach sees readiness + training data only — not personal details (DOB, weight) unless player opts in
- GDPR: deleting coach account does NOT delete player accounts or their data

---

## Revenue Upside

Grassroots club example — 3 coaches, 25 players each:
- 3 × £34.99/mo = **£104.97/mo** from one club
- One decision maker, one payment — far easier to sell than 75 individual subscriptions

Academy/club B2B angle is a distinct sales channel from individual B2C subscriptions.

---

## Open Questions for Later

- Should there be a Club/Academy tier above Coach (unlimited players)?
- Can a player see their own data if they leave a squad?
- Should coaches get their own personal premium dashboard too, or is it squad-only?
- App Store pricing: Coach tier will need new IAP products created in App Store Connect + RevenueCat

---

*Saved: June 2026. Not yet in development.*
