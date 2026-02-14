/**
 * Audio autoplay queue for TTS playback.
 *
 * Uses standalone Audio objects (not DOM elements) to avoid Lit re-render issues.
 * Tracks message count to distinguish initial load from new messages.
 * New audio plays automatically and sequentially; old audio is manual only.
 * Exposes state for the audio panel UI.
 */

export type AudioTrack = {
  dataUri: string;
  label: string;
  duration: number | null;
  played: boolean;
};

type QueueState = {
  tracks: AudioTrack[];
  currentIndex: number;
  isPlaying: boolean;
};

const seenDataUris = new Set<string>();
const tracks: AudioTrack[] = [];
let currentAudio: HTMLAudioElement | null = null;
let currentIndex = -1;
let isPlaying = false;
let settled = false;
let masterVolume = 1.0;
let onStateChange: (() => void) | null = null;

function notify() {
  onStateChange?.();
}

function playTrackAt(index: number) {
  // Stop current if any
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  if (index < 0 || index >= tracks.length) {
    isPlaying = false;
    currentIndex = -1;
    notify();
    return;
  }

  currentIndex = index;
  isPlaying = true;
  const track = tracks[index];
  const audio = new Audio(track.dataUri);
  audio.volume = masterVolume;
  currentAudio = audio;

  // Get duration when metadata loads
  audio.addEventListener("loadedmetadata", () => {
    track.duration = audio.duration;
    notify();
  });

  const done = () => {
    audio.removeEventListener("ended", done);
    audio.removeEventListener("error", done);
    track.played = true;
    isPlaying = false;
    currentAudio = null;

    // Auto-advance to next unplayed track
    const nextIdx = tracks.findIndex((t, i) => i > index && !t.played);
    if (nextIdx >= 0) {
      playTrackAt(nextIdx);
    } else {
      currentIndex = -1;
      notify();
    }
  };

  audio.addEventListener("ended", done);
  audio.addEventListener("error", done);
  audio.play().catch(() => {
    isPlaying = false;
    currentAudio = null;
    currentIndex = -1;
    notify();
  });
  notify();
}

/**
 * Called at render time for each audio block. Tracks the URI and queues
 * playback only for genuinely new audio (after initial load settles).
 */
export function trackAudio(dataUri: string, label?: string): void {
  if (seenDataUris.has(dataUri)) return;
  seenDataUris.add(dataUri);

  const track: AudioTrack = {
    dataUri,
    label: label ?? "",
    duration: null,
    played: !settled, // Old tracks are marked as already played
  };
  tracks.push(track);

  if (!settled) return;

  // New audio after init — auto-play if nothing is currently playing
  if (!isPlaying) {
    playTrackAt(tracks.length - 1);
  }
  notify();
}

/**
 * Called from handleUpdated when chatMessages change.
 * On the first call with messages, marks all current audio as "old".
 */
export function onMessagesUpdated(messageCount: number): void {
  if (!settled && messageCount > 0) {
    settled = true;
  }
}

/** Get current queue state (for rendering the panel) */
export function getQueueState(): QueueState {
  return {
    tracks: [...tracks],
    currentIndex,
    isPlaying,
  };
}

/** Play a specific track by index */
export function playTrack(index: number): void {
  playTrackAt(index);
}

/** Pause current playback */
export function pausePlayback(): void {
  if (currentAudio) {
    currentAudio.pause();
    isPlaying = false;
    notify();
  }
}

/** Resume current track or play next unplayed */
export function resumePlayback(): void {
  if (currentAudio && !isPlaying) {
    currentAudio.play().catch(() => {});
    isPlaying = true;
    notify();
    return;
  }
  // Find next unplayed track
  const nextIdx = tracks.findIndex((t) => !t.played);
  if (nextIdx >= 0) {
    playTrackAt(nextIdx);
  }
}

/** Skip to next unplayed track */
export function skipCurrent(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentIndex >= 0 && currentIndex < tracks.length) {
    tracks[currentIndex].played = true;
  }
  const nextIdx = tracks.findIndex((t, i) => i > currentIndex && !t.played);
  if (nextIdx >= 0) {
    playTrackAt(nextIdx);
  } else {
    isPlaying = false;
    currentIndex = -1;
    notify();
  }
}

/** Set master volume (0-1) */
export function setVolume(vol: number): void {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (currentAudio) {
    currentAudio.volume = masterVolume;
  }
}

/** Get current master volume */
export function getVolume(): number {
  return masterVolume;
}

/** Register a callback for state changes (triggers Lit re-render) */
export function onAudioStateChange(cb: () => void): void {
  onStateChange = cb;
}
