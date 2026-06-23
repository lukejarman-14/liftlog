import type { PremiumStatus, UserProfile } from '../types';
import { hashPassword } from './authUtils';

export const APP_REVIEW_EMAIL = 'review@vectorfootball.co.uk';
// SHA-256(email + password) of the App Review demo credential. We embed the
// one-way hash, NOT the plaintext, so the password can't be lifted from the
// shipped JS bundle by view-source / grep. The account grants no premium and is
// local-only, so this is defence-in-depth rather than a real secret. The live
// password lives only in the App Store Connect "App Review Information" notes.
const APP_REVIEW_PASSWORD_HASH = '5c2bc622d79ac93c4041ad49c7282c8f772ddd4754522dddf2b04c4fcfa963dc';

const STORAGE_SYNC_EVENT = 'vf-storage-sync';
const DATA_OWNER_KEY = 'vf_data_owner';
const DEMO_OWNER = 'app-review-demo';

function writeSyncedJson(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  localStorage.setItem(key, serialized);
  window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, { detail: { key, serialized } }));
}

/** True only for the exact App Review email + password. Async because it hashes
 *  the supplied password (the plaintext is never stored in the bundle). */
export async function isAppReviewDemoLogin(email: string, password: string): Promise<boolean> {
  if (email.trim().toLowerCase() !== APP_REVIEW_EMAIL) return false;
  return (await hashPassword(password, APP_REVIEW_EMAIL)) === APP_REVIEW_PASSWORD_HASH;
}

export function activateAppReviewDemo() {
  const now = Date.now();
  const reviewProfile: UserProfile = {
    firstName: 'App',
    lastName: 'Review',
    email: APP_REVIEW_EMAIL,
    position: 'CM',
    experienceYears: '3-5',
    gymFrequency: '3-4',
    goals: ['speed', 'strength', 'endurance'],
    gymAccess: 'full',
    completedAt: now,
    termsAcceptedAt: now,
    dateOfBirth: '2001-01-01',
    heightCm: 180,
    weightKg: 75,
    gender: 'male',
    accountType: 'personal',
  };

  // Apple reviewers need to see the RevenueCat paywall and StoreKit purchase flow.
  // Keep the demo account complete, but do not unlock Premium automatically.
  const premiumStatus: PremiumStatus = {
    isPremium: false,
  };

  localStorage.setItem(DATA_OWNER_KEY, DEMO_OWNER);
  writeSyncedJson('vf_user_profile', reviewProfile);
  writeSyncedJson('vf_premium', premiumStatus);
  sessionStorage.setItem('vf_boot_synced', '1');
}
