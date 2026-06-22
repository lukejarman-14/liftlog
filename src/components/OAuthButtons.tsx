import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cloudSignInWithOAuth, isSupabaseConfigured, type OAuthProvider } from '../lib/cloudSync';
import { OAUTH_ENABLED } from '../lib/featureFlags';

interface OAuthButtonsProps {
  onError?: (message: string) => void;
}

const PROVIDERS: Array<{ id: OAuthProvider; label: string }> = [
  { id: 'apple', label: 'Continue with Apple' },
  { id: 'google', label: 'Continue with Google' },
];

export function OAuthButtons({ onError }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  // Hidden until OAuth providers are configured in Supabase and verified on-device.
  if (!OAUTH_ENABLED) return null;
  if (!isSupabaseConfigured) return null;

  const handleOAuth = async (provider: OAuthProvider) => {
    setLoadingProvider(provider);
    onError?.('');
    try {
      await cloudSignInWithOAuth(provider);
    } catch {
      setLoadingProvider(null);
      onError?.(`Could not start ${provider === 'apple' ? 'Apple' : 'Google'} sign in. Please try again.`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map(provider => {
        const loading = loadingProvider === provider.id;
        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleOAuth(provider.id)}
            disabled={loadingProvider !== null}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-800 font-bold text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <span className="text-base">{provider.id === 'apple' ? 'A' : 'G'}</span>}
            {loading ? 'Opening...' : provider.label}
          </button>
        );
      })}
      <p className="text-[11px] text-gray-400 text-center leading-snug">
        Apple and Google sign-in require the matching providers to be enabled in Supabase.
      </p>
    </div>
  );
}
