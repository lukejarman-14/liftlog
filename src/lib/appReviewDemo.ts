import type { PremiumStatus, UserProfile } from '../types';

export const APP_REVIEW_EMAIL = 'review@vectorfootball.co.uk';
export const APP_REVIEW_PASSWORD = 'VFReview2025!';

const STORAGE_SYNC_EVENT = 'vf-storage-sync';
const DATA_OWNER_KEY = 'vf_data_owner';
const DEMO_OWNER = 'app-review-demo';

function writeSyncedJson(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  localStorage.setItem(key, serialized);
  window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, { detail: { key, serialized } }));
}

export function isAppReviewDemoLogin(email: string, password: string): boolean {
  return email.trim().toLowerCase() === APP_REVIEW_EMAIL && password === APP_REVIEW_PASSWORD;
}

export function isAppReviewDemoPassword(password: string): boolean {
  return password === APP_REVIEW_PASSWORD;
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
