export const STORAGE_KEYS = [
  'vf_user_profile',
  'vf_custom_exercises',
  'vf_templates',
  'vf_sessions',
  'vf_active_plan',
  // vf_profile_picture is intentionally excluded — it's a raw base64 blob that can
  // exceed Supabase's JSONB row size limit. It stays device-local only.
  'vf_settings',
  'vf_baseline',
  'vf_match_entries',
  'vf_test_sessions',
  'vf_generated_programmes',
  'vf_active_programme_id',
  'vf_daily_readiness',
  'vf_football_intensity',
  'vf_premium',
  'vf_scheduled_workouts',
  'vf_weight_log',
] as const;

export type BackupFile = {
  version: number;
  app: 'VectorFootball';
  exportedAt: string;
  data: Record<string, unknown>;
};

/** Download all app data as a JSON backup file. Premium status is excluded — it is tied to the account. */
export function exportData(): void {
  const data: Record<string, unknown> = {};
  for (const key of STORAGE_KEYS) {
    if (key === 'vf_premium') continue;
    const raw = localStorage.getItem(key);
    try {
      data[key] = raw ? JSON.parse(raw) : null;
    } catch {
      data[key] = null;
    }
  }

  // Never include the local password hash in an exported backup — it is a
  // device-only secret and must not travel inside a shareable file.
  const exportedProfile = data['vf_user_profile'];
  if (exportedProfile && typeof exportedProfile === 'object') {
    delete (exportedProfile as Record<string, unknown>).passwordHash;
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
  // Revoke after 1s — iOS Safari needs longer than a tick to initiate the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// (importData was removed — the restore-from-file UI never shipped; cloud sync handles restores.)
