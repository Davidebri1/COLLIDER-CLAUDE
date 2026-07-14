// Supabase project for the Imagine Market backend (feed, likes, comments,
// publishing). Publishable key is safe client-side by design — it only works
// against tables with RLS policies allowing it. Never put the secret key here.
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gmenftvasdbhkbinkdux.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_d7J47jH1lh3wnMwINhAxLQ_Ji1uizcI";

// No real Supabase Auth anywhere in this app (pseudo-identity is a
// device-UUID we generate ourselves — see getDeviceId() in market.ts), so
// session persistence/auto-refresh is dead weight. Worse than dead weight,
// actually: wiring persistSession+autoRefreshToken to AsyncStorage on RN-web
// makes the GoTrueClient try to acquire a session-restore lock before any
// query can run, and that lock never resolved in this environment — every
// .from() call hung forever with zero requests ever leaving the browser.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
