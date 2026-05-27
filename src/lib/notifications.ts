// Training reminder notifications — one per future programme session, IDs 10000–10059 (safe iOS cap).
// Rest-end notification uses ID 99998 (outside training range so it can be cancelled independently).

import { LocalNotifications } from '@capacitor/local-notifications';
import { GeneratedProgramme } from '../types';
import { getProgrammeAnchorMonday } from './sessionUtils';

const REST_NOTIF_ID = 99998;
// Fire 1s early so the sound lands exactly as the timer hits zero on-screen
const NOTIF_EARLY_S = 1;

export async function scheduleRestEndNotification(secs: number): Promise<void> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;
    const at = new Date(Date.now() + (secs - NOTIF_EARLY_S) * 1000);
    await LocalNotifications.schedule({
      notifications: [{
        id: REST_NOTIF_ID,
        title: '⏱️ Rest complete',
        body: 'Time to go — start your next set.',
        schedule: { at, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#4f46e5',
      }],
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[notifications] scheduleRestEnd failed:', err);
  }
}

export async function cancelRestNotification(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIF_ID }] });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[notifications] cancelRest failed:', err);
  }
}

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

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await cancelAllTrainingReminders();
  try {
    // Use calendar-based repeat (on: { hour, minute }) which works reliably on iOS.
    // `repeats: true` with an `at` date is not guaranteed to repeat on iOS.
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIF_ID_BASE,
        title: '⚡ Vector Football',
        body: 'Time to train — open the app to log your session.',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#4f46e5',
      }],
    });
  } catch {}
}

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
