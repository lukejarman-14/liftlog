/**
 * Data export / import for cross-device backup and restore.
 * All app data lives in localStorage under 'vf_*' keys.
 * Export creates a single JSON file; import writes all keys back and reloads.
 */

export const STORAGE_KEYS = [
  'vf_user_profile',
  'vf_custom_exercises',
  'vf_templates',
  'vf_sessions',
  'vf_active_plan',
  'vf_profile_picture',
  'vf_settings',
  'vf_baseline',
  'vf_match_entries',
  'vf_performance_entries',
  'vf_test_sessions',
  'vf_generated_programmes',
  'vf_active_programme_id',
  'vf_daily_readiness',
  'vf_football_intensity',
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
        const profile = (backup.data['vf_user_profile'] ?? backup.data['ll_user_profile']) as { email?: string } | null;
        resolve(profile?.email ?? 'your account');
      } catch (err) {
        reject(new Error('Could not read the backup file. Make sure it is a valid VectorFootball backup.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsText(file);
  });
}
