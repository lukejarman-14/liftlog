/** Shared low-level helpers used across the app. */

/** Capitalise the first letter of a string (the rest is left unchanged). */
export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

/** Day name → ISO week index (Monday = 0 … Sunday = 6). */
export const DAY_INDEX: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};
