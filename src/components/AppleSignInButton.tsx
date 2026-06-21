interface AppleSignInButtonProps {
  onClick: () => void;
  /** Button copy — e.g. "Continue with Apple" on signup, "Sign in with Apple" on login. */
  label?: string;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Apple-branded sign-in button following Apple's Human Interface Guidelines:
 * solid black, white Apple mark, "...with Apple" wording. Matches the app's
 * rounded button shape for visual consistency.
 */
export function AppleSignInButton({
  onClick,
  label = 'Continue with Apple',
  loading = false,
  disabled = false,
}: AppleSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-black text-white font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {loading ? (
        <span className="text-sm font-medium">Signing in…</span>
      ) : (
        <>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
