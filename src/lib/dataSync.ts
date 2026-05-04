/**
 * Data export / import for cross-device backup and restore.
 * All app data lives in localStorage under 'll_*' keys.
 * Export creates a single JSON file; import writes all keys back and reloads.
 */

export const STORAGE_KEYS = [
  'll_user_profile',
  'll_custom_exercises',
  'll_templates',
  'll_sessions',
  'll_active_plan',
  'll_profile_picture',
  'll_settings',
  'll_baseline',
  'll_match_entries',
  'll_performance_entries',
  'll_test_sessions',
  'll_generated_programmes',
  'll_active_programme_id',
  'll_daily_readiness',
  'll_football_intensity',
] as const;

export type BackupFile = {
  version: number;
  app: 'VectorFootball';
  exportedAt: string;
  data: Record<string, unknown>;
};

/** Download all app data as a JSON backup file. */
export function exportData(): void {
  const data: Record<string, unknown> = {};
  for (const key of STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    try {
      data[key] = raw ? JSON.parse(raw) : null;
    } catch {
      data[key] = null;
    }
  }

  const backup: BackupFile = {
    version: 1,
    app: 'VectorFootball',
    exportedAt: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vectorfootball-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Read a backup file and restore all data to localStorage. Resolves with the restored profile email. */
export function importData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const backup: BackupFile = JSON.parse(text);

        if (!backup?.data || backup.app !== 'VectorFootball') {
          reject(new Error('This does not appear to be a VectorFootball backup file.'));
          return;
        }

        // Restore every key that exists in the backup
        for (const key of STORAGE_KEYS) {
          const val = backup.data[key];
          if (val !== undefined && val !== null) {
            localStorage.setItem(key, JSON.stringify(val));
          }
        }

        // Return the email so the UI can confirm who was restored
        const profile = backup.data['ll_user_profile'] as { email?: string } | null;
        resolve(profile?.email ?? 'your account');
      } catch (err) {
        reject(new Error('Could not read the backup file. Make sure it is a valid VectorFootball backup.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsText(file);
  });
}
