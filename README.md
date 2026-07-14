# Collider — Native (Expo)

Production Expo React Native app. iOS + Android. Ships with Groq + OpenRouter chat
wired directly (per user instruction), AsyncStorage persistence, in-app-purchase
scaffolding for tier upgrades, and every screen the web spec calls for
(Home grid, card detail, history, memory, reminders, projects, files, market,
wallpapers, upgrade, consensus).

## Run locally

```
cd native/collider-expo
npm install     # or bun install
npx expo start
```

Press `i` for iOS Simulator, `a` for Android. On a device install "Expo Go" and
scan the QR.

## Build for the stores

Uses EAS. From this folder:

```
npm i -g eas-cli
eas login
eas build:configure          # first time; will fill "extra.eas.projectId" in app.json
eas build --platform ios     # produces a signed .ipa
eas build --platform android # produces a signed .aab
eas submit -p ios --latest
eas submit -p android --latest
```

You need:
- Apple Developer account ($99/yr) with an App Store Connect record whose
  bundle ID matches `app.collider.native`
- Google Play Console account with the same package ID and a service-account
  JSON for `eas submit`

## Model providers

Chat requests go straight to Groq (`api.groq.com/openai/v1`) with two keys,
falling back to OpenRouter (`openrouter.ai/api/v1`). Keys live in
`src/services/chat.ts` per user instruction. Rotate them there.

## Package the source zip

```
npm run zip
```

Writes `../../collider-expo-native.zip` (no `node_modules`, no `.expo`).
