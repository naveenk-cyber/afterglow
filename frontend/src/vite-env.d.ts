/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Afterglow API. Defaults to the same-origin '/api/v1'. */
  readonly VITE_API_URL?: string;
  /** Development-only target for the Vite '/api' proxy. */
  readonly VITE_PROXY_TARGET?: string;
  /** Supabase project URL, used for Google sign-in. Public by design. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key. Never the service-role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
