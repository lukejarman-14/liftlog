# Vector Football — Claude Instructions

## Weekly Analytics Summary
When the user asks for their analytics summary, weekly report, "how's the app doing", "Vector Football stats", or anything similar — **run it immediately without asking**. Full instructions are in the project memory file (`project_vector_football.md`). Key points:
- Read PostHog key from `.env.local` (`VITE_POSTHOG_KEY`)
- Query PostHog Trends API for the 5 funnel events (last 7 days vs previous 7 days)
- Query Supabase for new user sign-ups
- Query RevenueCat for trials/revenue if `VITE_REVENUECAT_API_KEY` is in `.env.local`
- Output as the formatted dashboard defined in memory

## Friday Reminder
If the user opens Claude Code on a Friday, proactively mention that it's their Vector Football analytics day and offer to run the summary. Don't be pushy — one mention is enough.

## Stack
Vite + React + TypeScript + Capacitor (iOS). Supabase backend. RevenueCat + Stripe payments. PostHog analytics. See project memory for full detail.
