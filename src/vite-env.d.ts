/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined;
  readonly VITE_SUPABASE_ANON_KEY: string | undefined;
  readonly VITE_POSTHOG_KEY: string | undefined;
  readonly VITE_POSTHOG_HOST: string | undefined;
  readonly VITE_REVENUECAT_IOS_KEY: string | undefined;
  readonly VITE_REVENUECAT_API_KEY: string | undefined;
  readonly VITE_PUBLIC_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
