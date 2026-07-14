// Thin wrappers around expo-image-picker, expo-av, and expo-notifications.
// All imports are lazy so the app still boots inside Expo Go if a native
// module is missing (dev iteration only — production builds bundle them).
import { Platform } from "react-native";

export type PickedImage = { dataUri: string; mime: string; width?: number; height?: number };

export async function pickImage(): Promise<PickedImage | null> {
  const ImagePicker = await import("expo-image-picker");
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  const mime = a.mimeType || "image/jpeg";
  const dataUri = a.base64 ? `data:${mime};base64,${a.base64}` : a.uri;
  return { dataUri, mime, width: a.width, height: a.height };
}

export async function takePhoto(): Promise<PickedImage | null> {
  const ImagePicker = await import("expo-image-picker");
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.85, base64: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  const mime = a.mimeType || "image/jpeg";
  const dataUri = a.base64 ? `data:${mime};base64,${a.base64}` : a.uri;
  return { dataUri, mime, width: a.width, height: a.height };
}

// ── Voice recording ────────────────────────────────────────────────────────
let currentRecording: any = null;

export async function startRecording(): Promise<boolean> {
  const { Audio } = await import("expo-av");
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) return false;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const rec = new Audio.Recording();
  await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await rec.startAsync();
  currentRecording = rec;
  return true;
}

export async function stopRecording(): Promise<{ uri: string; mime: string } | null> {
  if (!currentRecording) return null;
  const rec = currentRecording;
  currentRecording = null;
  try {
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    if (!uri) return null;
    const mime = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
    return { uri, mime };
  } catch {
    return null;
  }
}

export function isRecording() { return !!currentRecording; }

// ── Notifications ──────────────────────────────────────────────────────────
export async function scheduleReminder(title: string, dueMs: number, id?: string): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications");
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) return null;
    }
    const seconds = Math.max(1, Math.round((dueMs - Date.now()) / 1000));
    return await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: "Reminder", body: title, sound: "default" },
      trigger: { seconds } as any,
    });
  } catch { return null; }
}

export async function cancelReminder(id: string) {
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function copyText(text: string) {
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(text);
    return true;
  } catch { return false; }
}
