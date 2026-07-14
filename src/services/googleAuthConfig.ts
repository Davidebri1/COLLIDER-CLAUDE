// Google Cloud project "Collider AI" (collider-ai-498201). Calendar + Tasks
// APIs are enabled; test user ebridavid@gmail.com is added to the OAuth
// consent screen (required while publishing status is "Testing").
//
// The app is native on every platform — this file just picks the right OAuth
// *credential* for however you're currently running it, since Google issues a
// separate client id per launch surface:
//   - Web (react-native-web, `expo start --web`): only usable test path right
//     now (no paid Apple dev account / device yet) — uses a redirect URI.
//   - iOS: real native client, ready for the moment you can run a dev client /
//     simulator build. Uses a reverse-DNS custom URL scheme, not a redirect URI.
//   - Android: NOT YET CREATED. Google requires a SHA-1 signing-certificate
//     fingerprint for Android OAuth clients, which only exists once a keystore
//     is generated (first `eas build -p android` or `expo run:android` does
//     this automatically). Nothing to configure until then — see README note
//     below for the exact follow-up steps.
import { Platform } from "react-native";

const WEB_CLIENT_ID = "936092858710-36a9kiqprhvmg7534pq9c32dkpu4tahh.apps.googleusercontent.com";
const IOS_CLIENT_ID = "936092858710-bti8eattr6c405jjq8ce5000gsb1kt2d.apps.googleusercontent.com";
// Android: create once a keystore/SHA-1 exists — see comment above.
const ANDROID_CLIENT_ID = "";

export const GOOGLE_CLIENT_ID =
  Platform.OS === "ios" ? IOS_CLIENT_ID :
  Platform.OS === "android" ? (ANDROID_CLIENT_ID || WEB_CLIENT_ID) : // falls back to web client until Android client exists
  WEB_CLIENT_ID;

// Only meaningful for the web flow — must exactly match an "Authorized
// redirect URI" on the Web client. expo start --web serves on 8081 by default
// (older SDKs used 19006 — both are registered). iOS/Android use
// AuthSession.makeRedirectUri() with the app's URL scheme instead, handled in
// googleAuth.ts, not this constant.
export const GOOGLE_REDIRECT_URI = "http://localhost:8081";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
];
