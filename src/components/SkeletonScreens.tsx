/**
 * Skeleton loading screens — replace blank white + spinner with
 * content-shaped placeholders that match the real layout.
 *
 * Uses Tailwind's animate-pulse (fade in/out) for simplicity and
 * zero extra dependencies.
 */

const P = 'bg-gray-200 dark:bg-gray-800 animate-pulse rounded';

// ─── App boot skeleton ───────────────────────────────────────────────────────
// Shown while we check whether a Supabase session exists.
// Mirrors the splash / onboarding entry screen shape.
export function AppBootSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center px-5 gap-5">
      {/* App icon */}
      <div className={`w-20 h-20 rounded-2xl ${P}`} />
      {/* Title */}
      <div className={`w-44 h-7 ${P}`} />
      {/* Subtitle lines */}
      <div className="flex flex-col items-center gap-2 w-full max-w-xs">
        <div className={`w-full h-4 ${P}`} />
        <div className={`w-3/4 h-4 ${P}`} />
      </div>
      {/* CTA buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3 mt-2">
        <div className={`w-full h-12 rounded-xl ${P}`} />
        <div className={`w-full h-12 rounded-xl ${P}`} />
      </div>
    </div>
  );
}

// ─── Dashboard skeleton ──────────────────────────────────────────────────────
// Shown as the Suspense fallback for all main app screens.
// Mirrors the dashboard layout: header + cards + bottom nav.
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
      {/* Header */}
      <div className="px-4 pt-12 pb-5 space-y-2">
        <div className={`w-28 h-5 ${P}`} />
        <div className={`w-48 h-4 ${P}`} />
      </div>

      {/* Hero card */}
      <div className="px-4 mb-3">
        <div className={`w-full h-32 rounded-2xl ${P}`} />
      </div>

      {/* Two-column quick stats */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-3">
        <div className={`h-24 rounded-2xl ${P}`} />
        <div className={`h-24 rounded-2xl ${P}`} />
      </div>

      {/* Full-width card */}
      <div className="px-4 mb-3">
        <div className={`w-full h-28 rounded-2xl ${P}`} />
      </div>

      {/* Another two-col row */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-3">
        <div className={`h-20 rounded-2xl ${P}`} />
        <div className={`h-20 rounded-2xl ${P}`} />
      </div>

      {/* Spacer pushes nav to bottom */}
      <div className="flex-1" />

      {/* Bottom navigation bar */}
      <div className="border-t border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 h-16 flex items-center justify-around px-6 pb-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className={`w-6 h-6 rounded ${P}`} />
            <div className={`w-10 h-2 rounded ${P}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Login skeleton ──────────────────────────────────────────────────────────
// Shown while the Login component lazy-loads.
export function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center px-5 gap-5 max-w-sm mx-auto w-full">
      {/* Title */}
      <div className={`w-40 h-7 ${P} self-start`} />
      <div className={`w-56 h-4 ${P} self-start`} />

      {/* Email field */}
      <div className="w-full space-y-1.5">
        <div className={`w-28 h-3.5 ${P}`} />
        <div className={`w-full h-11 rounded-xl ${P}`} />
      </div>

      {/* Password field */}
      <div className="w-full space-y-1.5">
        <div className={`w-20 h-3.5 ${P}`} />
        <div className={`w-full h-11 rounded-xl ${P}`} />
      </div>

      {/* Sign in button */}
      <div className={`w-full h-12 rounded-xl ${P}`} />

      {/* Forgot password */}
      <div className={`w-28 h-4 ${P}`} />
    </div>
  );
}
