/**
 * Training reminder notifications — wraps @capacitor/local-notifications.
 *
 * Strategy: schedule one notification per future programme session (up to 60,
 * the safe iOS limit). Each notification fires at the user's chosen time on the
 * session's calendar date with the session objective as the title.
 *
 * All scheduled notifications use IDs in the range 10000–10059 so they can be
 * reliably cancelled without touching any other notifications.
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { GeneratedProgramme } from '../types';
import { getProgrammeAnchorMonday } from './sessionUtils';

const DAY_NAME_TO_IDX: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

const NOTIF_ID_BASE = 10000;
const NOTIF_LIMIT   = 60; // safe iOS cap (hard limit is 64)


export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}


export async function cancelAllTrainingReminders(): Promise<void> {
  try {
    const ids = Array.from({ length: NOTIF_LIMIT }, (_, i) => ({ id: NOTIF_ID_BASE + i }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch {}
}


interface SessionEntry {
  date: Date;
  title: string;
  body: string;
}

function buildSessionEntries(
  programme: GeneratedProgramme,
  hour: number,
  minute: number,
): SessionEntry[] {
  const anchor = getProgrammeAnchorMonday(programme);
  const now    = new Date();
  const entries: SessionEntry[] = [];

  for (const week of programme.weeks) {
    const weekOffset = week.weekNumber - 1;
    for (const session of week.sessions) {
      const dayOffset = DAY_NAME_TO_IDX[session.dayOfWeek] ?? -1;
      if (dayOffset < 0) continue;

      const d = new Date(anchor);
      d.setDate(anchor.getDate() + weekOffset * 7 + dayOffset);
      d.setHours(hour, minute, 0, 0);

      if (d <= now) continue; // past — skip

      const mdLabel = session.mdDay !== 'free' ? ` · ${session.mdDay}` : '';
      entries.push({
        date:  d,
        title: `⚡ ${session.objective}`,
        body:  `Week ${week.weekNumber}${mdLabel} · ${session.durationMin} min — tap to open`,
      });
    }
  }

  return entries
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, NOTIF_LIMIT);
}

/**
 * Schedule a single daily reminder at the given time — used when there is no
 * active programme (e.g. new users who haven't built one yet).
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await cancelAllTrainingReminders();
  const now = new Date();
  const at = new Date();
  at.setHours(hour, minute, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIF_ID_BASE,
        title: '⚡ Vector Football',
        body: 'Time to train — open the app to log your session.',
        schedule: { at, repeats: true, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#4f46e5',
      }],
    });
  } catch {}
}

/**
 * Cancel existing training reminders and schedule fresh ones for the given
 * programme at the user's chosen time. Returns the number scheduled.
 */
export async function scheduleTrainingReminders(
  programme: GeneratedProgramme,
  hour: number,
  minute: number,
): Promise<number> {
  await cancelAllTrainingReminders();

  const entries = buildSessionEntries(programme, hour, minute);
  if (entries.length === 0) return 0;

  try {
    await LocalNotifications.schedule({
      notifications: entries.map((e, i) => ({
        id:    NOTIF_ID_BASE + i,
        title: e.title,
        body:  e.body,
        schedule: { at: e.date, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#4f46e5',
      })),
    });
    return entries.length;
  } catch {
    return 0;
  }
}
