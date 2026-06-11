# Vector Football — Full Feature Test Checklist
_Last updated: 6 Jun 2026_
_Check off each item as you verify it works on device._

---

## 🔐 Auth & Account

- [ ] **Onboarding** — 5-step wizard (name, position, experience, height/weight, DOB)
- [ ] **Account types** — Personal / Coach / Club selected during onboarding
- [ ] **Sign up** — creates Supabase account, sends confirmation email
- [ ] **Email confirmation banner** — shown on dashboard, Resend button works
- [ ] **Login** — password sign-in, "email not confirmed" error handled correctly
- [ ] **Forgot password** — sends reset email, redirect back into app works
- [ ] **Reset password screen** — can set new password after clicking email link
- [ ] **Cloud sync** — data saves to Supabase on change, restores on login
- [ ] **Shared device isolation** — signing into second account wipes first account's local data
- [ ] **Sign out** — clears session and local data correctly
- [ ] **Delete account** — permanently deletes auth + all data from Supabase
- [ ] **Terms gate modal** — must accept terms before using app
- [ ] **hCaptcha** — invisible CAPTCHA fires on sign-up / sign-in / password reset

---

## 🏠 Home Tab — Personal Account

- [ ] **Daily Readiness check-in** — sleep / fatigue / soreness / stress sliders save correctly
- [ ] **Autofill from Apple Health** — permission dialog appears, pulls sleep/HRV/resting HR ⚠️ *fix in progress*
- [ ] **"Syncs with Apple Health" label** — visible on collapsed Daily Readiness card (App Store 2.5.1)
- [ ] **Today's programme session card** — shows correct session from active programme
- [ ] **Skip session** — with reason (injury / rest / busy), updates programme calendar
- [ ] **Reschedule session** — move session to a different date
- [ ] **Active plan progress card** — shows current position plan week correctly
- [ ] **Intensity prompt** — rate last session (1–5) + optional minutes played
- [ ] **Re-test banner** — appears when fitness tests overdue, dismisses for 10 days
- [ ] **Coach announcements** — shown correctly when player is in a coach's squad
- [ ] **Email confirmation banner** — Resend button works, "I've confirmed" dismisses it
- [ ] **Share stats card** — generates shareable image of current stats
- [ ] **Cloud unlinked warning** — shown when signed out but Supabase configured

---

## 🏠 Home Tab — Coach / Club Account

- [ ] **Squad overview** — player list, count, team selector works with multiple teams
- [ ] **Player detail view** — tap player → shows stats and test results
- [ ] **Coach notes per player** — add / edit / save notes
- [ ] **Most improved player** — calculated and displayed correctly
- [ ] **Formation builder** — drag players onto pitch, save formation *(Coach/Club only)*
- [ ] **Schedule tab** — weekly training/match schedule visible and editable *(paid only)*
- [ ] **History tab** — squad session history loads *(paid only)*
- [ ] **Tests tab** — squad fitness test results display *(paid only)*
- [ ] **Free tier locks** — schedule / history / tests show paywall for unpaid coaches
- [ ] **5-player cap** — free coaches cannot add more than 5 players
- [ ] **CSV export** — downloads squad data file correctly
- [ ] **Squad invite code** — code displayed, players can join with it

---

## 📋 Plans Tab

- [ ] **Position plans list** — all positions listed and tappable
- [ ] **Plan detail** — week-by-week breakdown displays correctly
- [ ] **Activate plan** — sets as active plan, appears on Home dashboard
- [ ] **Generated programmes hub** — saved programmes listed
- [ ] **Delete saved programme** — removes from list with confirmation

---

## 🏋️ Quick Workout Tab

- [ ] **Exercise picker** — search by name works
- [ ] **Filter by category** — category chips filter correctly
- [ ] **Build custom workout** — add multiple exercises, reorder
- [ ] **Set reps / sets / weight** before starting
- [ ] **Start workout** — transitions to Active Workout screen

---

## ⚡ Active Workout Screen

- [ ] **Set logging** — log weight × reps correctly
- [ ] **Time-based exercises** — log duration in seconds
- [ ] **Distance / height exercises** — log in correct unit
- [ ] **RPE selector** — 1–10 rating saved per set
- [ ] **RIR tracking** — Reps In Reserve saved per set
- [ ] **Rest timer** — starts after completing a set, counts down
- [ ] **Rest timer audio** — beep plays when rest ends
- [ ] **Progressive overload suggestion** — recommends weight increase based on history
- [ ] **Skip exercise** — skips to next without logging
- [ ] **Finish workout** — saves full session to History
- [ ] **Audio cues** — timer-done sound plays correctly

---

## 📚 Exercise Library Tab

- [ ] **Browse all exercises** — full list loads
- [ ] **Filter by category** — correct exercises shown per category
- [ ] **Exercise detail** — description, sets/reps guidance displayed
- [ ] **Add custom exercise** — create with name + category, appears in list
- [ ] **Custom exercise available in workout builder**

---

## 📈 History & Tests Tab

- [ ] **Session history list** — all completed workouts shown with date
- [ ] **Session detail expand** — shows sets, reps, RPE per exercise
- [ ] **Total volume per session** — kg total calculated correctly
- [ ] **Average RPE per session** — shown correctly
- [ ] **Delete session** — removes with confirmation
- [ ] **Testing Battery — Sprint** — enter times, best saved
- [ ] **Testing Battery — Vertical jump** — enter height, best saved
- [ ] **Testing Battery — Yo-Yo** — level/shuttles logged, VO₂ estimate calculated
- [ ] **Testing Battery — RSA** — 6-rep countdown cycle works, times entered, fatigue index shown
- [ ] **Multiple attempts** — best result used, all attempts visible
- [ ] **Load Calendar** — programme sessions shown on calendar view
- [ ] **Reschedule from calendar** — drag/tap to move session date

---

## 🧠 Programme Builder (AI)

- [ ] **Input form** — position, goal, sessions/week, equipment, injury flag all save
- [ ] **Generate programme** — produces a valid multi-week plan
- [ ] **View programme** — week-by-week with MD-day markers displays correctly
- [ ] **Apply programme** — choose start date, becomes active on Home
- [ ] **Multiple saved programmes** — can switch between them
- [ ] **Delete programme** — removes correctly

---

## 👤 Profile Screen

- [ ] **Profile photo** — pick from library, displays correctly
- [ ] **Edit personal details** — name, DOB, height, position save and persist
- [ ] **Weight log** — enter daily weight, sparkline updates, history shows
- [ ] **Delete weight entry** — removes individual entry
- [ ] **Training reminder** — toggle on → permission requested → fires at set time
- [ ] **Reminder time picker** — hour/minute update and save
- [ ] **Change password** — requires current password, updates successfully
- [ ] **Baseline stats** — VO₂ max and Yo-Yo grade shown after test
- [ ] **Data export** — downloads JSON of all app data
- [ ] **Analytics opt-out** — toggle disables PostHog tracking
- [ ] **Promo code** — enter valid code → grants premium access
- [ ] **Sign out** button works
- [ ] **Delete account** button works (with confirmation)

---

## 💳 Paywall & Subscriptions

- [ ] **Personal paywall screen** — Monthly / Annual (£79.99) / Lifetime (£150) shown
- [ ] **Coach paywall** — squad pricing and features shown
- [ ] **RevenueCat purchase (iOS)** — in-app purchase completes, premium granted
- [ ] **Stripe checkout (web)** — redirects to Stripe, payment completes
- [ ] **Stripe portal (web)** — manage/cancel subscription works
- [ ] **30-day free trial** — trial starts, premium access granted immediately
- [ ] **Entitlement check on launch** — premium status synced from server correctly
- [ ] **Paywall dismisses** — back/close returns to previous screen

---

## 🔔 Notifications & System

- [ ] **Push notification permission** — requested when training reminder toggled on
- [ ] **Training reminder fires** — notification appears at set time
- [ ] **Cookie banner (web)** — accept/decline works, preference saved
- [ ] **Squad ended modal** — shown when coach removes a player from squad
- [ ] **Error boundary** — app shows fallback screen rather than white crash
- [ ] **Skeleton loading screens** — shown briefly during boot/data load
- [ ] **Dark mode** — UI responds correctly to system dark mode setting
- [ ] **Toast notifications** — success/error toasts appear and auto-dismiss

---

## ⚠️ Known Issues (Do Not Mark as Pass Until Fixed)

- [ ] **Apple Health permission dialog** — not appearing (HealthKitPlugin registration bug, fix in progress)
- [ ] **Email confirmation re-send** — fails if user changed email after sign-up

---

## 📊 Summary

| Section | Total | Passed | Failed |
|---------|-------|--------|--------|
| Auth & Account | 13 | | |
| Home — Personal | 13 | | |
| Home — Coach/Club | 12 | | |
| Plans | 5 | | |
| Quick Workout | 5 | | |
| Active Workout | 11 | | |
| Exercise Library | 5 | | |
| History & Tests | 13 | | |
| Programme Builder | 6 | | |
| Profile | 13 | | |
| Paywall & Subscriptions | 8 | | |
| Notifications & System | 8 | | |
| **TOTAL** | **121** | | |

---

_Work through tab by tab. Mark ✅ pass, ❌ fail (note the issue), or ⚠️ partial._
_Say "show me my checklist" to retrieve this file at any time._
