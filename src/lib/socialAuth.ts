import { Capacitor, registerPlugin } from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase, isSupabaseConfigured } from './supabase';

interface GoogleSignInPlugin {
  signIn(): Promise<{
    idToken: string;
    email: string;
    givenName: string;
    familyName: string;
  }>;
  signOut(): Promise<void>;
}

const GoogleSignInPlugin = registerPlugin<GoogleSignInPlugin>('GoogleSignInPlugin');

/**
 * Native social sign-in (Apple now; Google to follow in a later phase).
 *
 * Flow: the native plugin returns an Apple identity token, which we hand to
 * Supabase via signInWithIdToken — same Supabase auth backend the rest of the
 * app already uses, so the resulting session is identical to email/password.
 */

export interface AppleSignInResult {
  /** Supabase user id for the signed-in account. */
  userId: string;
  /** Email Apple released (may be a private relay address, or null on repeat sign-ins). */
  email: string | null;
  /** Given name — Apple ONLY returns this on the user's first authorisation. */
  firstName: string | null;
  /** Family name — Apple ONLY returns this on the user's first authorisation. */
  lastName: string | null;
}

/** Apple sign-in is offered only on the native iOS app and only when Supabase is configured. */
export const isAppleSignInAvailable = (): boolean =>
  isSupabaseConfigured && Capacitor.getPlatform() === 'ios';

/** Google sign-in is offered on the native iOS app only (Android/web to follow). */
export const isGoogleSignInAvailable = (): boolean =>
  isSupabaseConfigured && Capacitor.getPlatform() === 'ios';

/**
 * Generate a random nonce and its SHA-256 hash.
 * Apple receives the HASH (embedded in the identity token); Supabase receives the
 * RAW value and re-hashes it to verify the token wasn't replayed.
 */
async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/**
 * Trigger the native "Sign in with Apple" sheet and exchange the result for a
 * Supabase session. Throws on failure (including user cancellation).
 *
 * The caller decides what to do with the returned account: a returning user has
 * cloud data to load; a brand-new user is built from the name/email Apple
 * provides here (which is the only time Apple ever sends the name).
 */
export interface GoogleSignInResult {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!supabase) throw new Error('Supabase is not configured');
  const result = await GoogleSignInPlugin.signIn();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: result.idToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Google sign-in did not return a user');
  return {
    userId: data.user.id,
    email: result.email || data.user.email || null,
    firstName: result.givenName || null,
    lastName: result.familyName || null,
  };
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  if (!supabase) throw new Error('Supabase is not configured');

  const { raw, hashed } = await generateNonce();

  const { response } = await SignInWithApple.authorize({
    clientId: 'co.vectorfootball.app',
    // Only used by the web fallback; the native sheet ignores it.
    redirectURI: 'https://vectorfootball.co.uk/auth/callback',
    scopes: 'email name',
    nonce: hashed,
  });

  if (!response.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: response.identityToken,
    nonce: raw,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Apple sign-in did not return a user');

  return {
    userId: data.user.id,
    email: response.email ?? data.user.email ?? null,
    firstName: response.givenName,
    lastName: response.familyName,
  };
}
