import { html, nothing, svg } from "lit";
import {
  getQueueState,
  playTrack,
  pausePlayback,
  skipCurrent,
  setVolume,
  getVolume,
  type AudioTrack,
} from "./audio-queue.ts";

// Inline SVG icons (Lucide-style, 24x24)
const playIcon = svg`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const pauseIcon = svg`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const skipIcon = svg`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"/><rect x="15" y="4" width="4" height="16"/></svg>`;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function renderTrack(track: AudioTrack, index: number, isActive: boolean) {
  const statusClass = isActive
    ? "audio-track--playing"
    : track.played
      ? "audio-track--played"
      : "audio-track--queued";

  return html`
    <div class="audio-track ${statusClass}">
      <button
        class="audio-track__btn"
        @click=${() => {
          const state = getQueueState();
          if (isActive && state.isPlaying) {
            pausePlayback();
          } else {
            playTrack(index);
          }
        }}
        title=${isActive ? "Pause" : "Play"}
      >
        ${isActive && getQueueState().isPlaying ? pauseIcon : playIcon}
      </button>
      <div class="audio-track__info">
        <div class="audio-track__label">${track.label || `Voice message ${index + 1}`}</div>
        ${track.duration != null ? html`<span class="audio-track__duration">${formatDuration(track.duration)}</span>` : nothing}
      </div>
    </div>
  `;
}

export function renderAudioPanel() {
  const state = getQueueState();

  if (state.tracks.length === 0) {
    return nothing;
  }

  const volume = getVolume();

  return html`
    <aside class="audio-panel">
      <div class="audio-panel__header">
        <span class="audio-panel__title">🎵 Audio</span>
        <button
          class="audio-panel__skip-btn"
          @click=${() => skipCurrent()}
          title="Skip to next"
          ?disabled=${state.currentIndex < 0}
        >
          ${skipIcon}
        </button>
      </div>

      <div class="audio-panel__volume">
        <span class="audio-panel__volume-label">Vol</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          .value=${String(volume)}
          @input=${(e: Event) => {
            setVolume(parseFloat((e.target as HTMLInputElement).value));
          }}
          class="audio-panel__volume-slider"
        />
        <span class="audio-panel__volume-pct">${Math.round(volume * 100)}%</span>
      </div>

      <div class="audio-panel__tracks">
        ${state.tracks.map((track, i) =>
          renderTrack(track, i, i === state.currentIndex),
        )}
      </div>
    </aside>
  `;
}
