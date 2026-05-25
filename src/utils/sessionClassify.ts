/**
 * Session classification helpers shared by WeeklyCalendar and LoadCalendar.
 *
 * A "conditioning" session is any aerobic, speed, or active-recovery block
 * that is NOT a gym/strength session.
 */

/** Returns true if the given session should be treated as a conditioning block. */
export function isConditioningSession(session: {
  mdDay?: string;
  objective?: string;
}): boolean {
  const md = (session.mdDay ?? '').toLowerCase();
  const lcObjective = (session.objective ?? '').toLowerCase();

  // Dedicated conditioning mdDay values from the programme generator
  if (
    md === 'conditioning' || md === 'md+1' ||
    md === 'zone 2' || md === 'high aerobic' || md === 'hi aerobic' || md === 'rsa'
  ) return true;

  // Objective-based fallbacks (covers off-season and manually scheduled sessions)
  return (
    md.includes('aerobic') || md.includes('zone') ||
    lcObjective.includes('active recovery') ||
    lcObjective.includes('conditioning session') ||
    lcObjective.includes('speed session') ||
    lcObjective.includes('cardio') ||
    lcObjective.includes('aerobic base') ||
    lcObjective.includes('zone 2') ||
    lcObjective.includes('anaerobic') ||
    lcObjective.includes('rsa') ||
    lcObjective.includes('high intensity aerobic')
  );
}

/** Classify a session as 'gym' or 'conditioning' — used by LoadCalendar. */
export function classifySessionType(
  objective: string,
  mdDay: string,
): 'gym' | 'conditioning' {
  return isConditioningSession({ mdDay, objective }) ? 'conditioning' : 'gym';
}
