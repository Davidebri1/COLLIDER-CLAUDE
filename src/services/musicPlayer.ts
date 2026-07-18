// Background music player for owned live-wallpaper tracks (SPEC.md's
// Wallpapers & Music section). Uses expo-av's Audio API rather than
// react-native-track-player: track-player needs a custom native dev client
// (config plugin + native rebuild) to run at all, which this Expo-managed
// project isn't set up for and this web/Metro preview environment can't
// build — the same class of problem that made Skia's web build a dead end
// earlier. expo-av is already a dependency, already configured, and its
// Audio.Sound + setAudioModeAsync(staysActiveInBackground) cover every
// requirement in the spec (background playback, not a foreground
// "now playing" experience) without introducing a new native module.
import { Audio, AVPlaybackStatus } from "expo-av";

let sound: Audio.Sound | null = null;
let currentTrackId: string | null = null;
let configured = false;

async function ensureAudioMode() {
  if (configured) return;
  configured = true;
  await Audio.setAudioModeAsync({
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  }).catch(() => {});
}

export async function playTrack(trackId: string, url: string, volume: number, onStatus?: (s: AVPlaybackStatus) => void) {
  await ensureAudioMode();
  if (sound && currentTrackId !== trackId) {
    await sound.unloadAsync().catch(() => {});
    sound = null;
  }
  if (!sound) {
    const { sound: created } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume, isLooping: false },
      onStatus
    );
    sound = created;
    currentTrackId = trackId;
  } else {
    if (onStatus) {
      sound.setOnPlaybackStatusUpdate(onStatus);
    }
    await sound.playAsync();
  }
}

export async function pauseTrack() {
  await sound?.pauseAsync().catch(() => {});
}

export async function resumeTrack() {
  await sound?.playAsync().catch(() => {});
}

export async function seekTo(millis: number) {
  await sound?.setPositionAsync(millis).catch(() => {});
}

export function setStatusListener(onStatus: (status: AVPlaybackStatus) => void) {
  sound?.setOnPlaybackStatusUpdate(onStatus);
}

export async function setVolume(volume: number) {
  await sound?.setVolumeAsync(Math.max(0, Math.min(1, volume))).catch(() => {});
}

export async function stopAndUnload() {
  if (sound) {
    await sound.unloadAsync().catch(() => {});
    sound = null;
    currentTrackId = null;
  }
}
