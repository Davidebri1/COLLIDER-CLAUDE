// Google OAuth (PKCE, Authorization Code flow) for the "Web application" OAuth
// client configured in googleAuthConfig.ts. Built on expo-auth-session so it
// works over plain `expo start --web` (localhost redirect), not just native
// deep-link schemes — see googleAuthConfig.ts for why.
//
// Tokens are persisted in their own AsyncStorage key (NOT in app state.tsx —
// state.tsx gets serialized/logged more casually and OAuth tokens shouldn't
// ride along with it).
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_SCOPES } from "./googleAuthConfig";

// Web must match the exact "Authorized redirect URI" on the Web OAuth client
// (a fixed localhost URL). iOS/Android use their own reverse-DNS URL scheme —
// AuthSession derives that from app.json's "scheme" automatically and it must
// NOT be the web localhost URL, or the native client will reject the exchange.
function resolveRedirectUri(): string {
  return Platform.OS === "web" ? GOOGLE_REDIRECT_URI : AuthSession.makeRedirectUri();
}

WebBrowser.maybeCompleteAuthSession();

const TOKENS_KEY = "collider-google-tokens";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: TOKEN_ENDPOINT,
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export type GoogleTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // ms epoch
};

async function readTokens(): Promise<GoogleTokens | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleTokens;
  } catch {
    return null;
  }
}

async function writeTokens(tokens: GoogleTokens): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Best-effort persistence — if AsyncStorage is unavailable, the tokens
    // just won't survive a reload; don't crash the caller.
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKENS_KEY);
  } catch {
    // ignore
  }
}

// Opens the Google consent screen and exchanges the returned code for tokens.
// Returns null if the user cancels/dismisses, or if Google denies consent
// (e.g. the signed-in account isn't on the OAuth consent screen's test users
// list while the app's publish status is "Testing") — never throws for those
// expected cases so callers can just show a message.
export async function signInWithGoogle(): Promise<GoogleTokens | null> {
  try {
    const redirectUri = resolveRedirectUri();

    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: GOOGLE_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    });

    const result = await request.promptAsync(discovery);

    if (result.type === "dismiss" || result.type === "cancel") {
      return null;
    }
    if (result.type === "error") {
      // access_denied / consent errors land here — surface as "not signed in"
      // rather than throwing.
      return null;
    }
    if (result.type !== "success" || !result.params?.code) {
      return null;
    }

    const codeVerifier = request.codeVerifier;
    if (!codeVerifier) return null;

    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: GOOGLE_CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: codeVerifier },
      },
      discovery
    );

    if (!tokenResponse.accessToken) return null;

    const expiresAt = Date.now() + (tokenResponse.expiresIn ? tokenResponse.expiresIn * 1000 : 3600 * 1000);
    const tokens: GoogleTokens = {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresAt,
    };
    await writeTokens(tokens);
    return tokens;
  } catch {
    // Any unexpected failure (network, malformed response, denied consent
    // surfaced as a thrown error by some platforms, etc.) — treat as "sign-in
    // didn't complete" rather than crashing the app.
    return null;
  }
}

async function refreshTokens(refreshToken: string): Promise<GoogleTokens | null> {
  try {
    const refreshed = await AuthSession.refreshAsync(
      {
        clientId: GOOGLE_CLIENT_ID,
        refreshToken,
      },
      discovery
    );
    if (!refreshed.accessToken) return null;
    const expiresAt = Date.now() + (refreshed.expiresIn ? refreshed.expiresIn * 1000 : 3600 * 1000);
    const tokens: GoogleTokens = {
      accessToken: refreshed.accessToken,
      // Google usually doesn't return a new refresh token on refresh — keep
      // the existing one unless a new one comes back.
      refreshToken: refreshed.refreshToken || refreshToken,
      expiresAt,
    };
    await writeTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

// Returns a currently-valid access token, refreshing via the stored refresh
// token if the cached one is expired (or close to it). Returns null if the
// user was never signed in, or if refresh fails (e.g. the refresh token was
// revoked) — callers should treat null as "not connected."
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await readTokens();
  if (!tokens) return null;

  const EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;
  if (tokens.expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    // Access token expired and we have no way to refresh — treat as signed
    // out so the UI prompts the user to reconnect.
    return null;
  }

  const refreshed = await refreshTokens(tokens.refreshToken);
  return refreshed ? refreshed.accessToken : null;
}

// Whether we currently have any stored Google tokens at all (regardless of
// whether the access token itself is still fresh) — useful for showing
// "Connected" status without forcing a network refresh call.
export async function isGoogleConnected(): Promise<boolean> {
  const tokens = await readTokens();
  return !!tokens;
}
