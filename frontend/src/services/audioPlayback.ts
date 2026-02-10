/**
 * Gapless Audio Playback Engine
 *
 * Platform-specific implementations for gap-free streaming audio playback.
 * Receives ~200ms PCM chunks from the backend and schedules them for
 * continuous playback using proper audio scheduling APIs.
 *
 * - Web: Uses browser AudioContext with scheduled AudioBufferSourceNodes
 * - Native: Uses react-native-audio-api AudioBufferQueueSourceNode
 */

import { Platform } from 'react-native';

const SAMPLE_RATE = 24000; // Gemini output: 24kHz mono 16-bit PCM
const CHUNKS_BEFORE_START = 3; // Buffer ~600ms before starting playback

export interface AudioPlaybackEngine {
  init(): void;
  enqueue(pcmData: ArrayBuffer): void;
  clear(): void;
  isActive(): boolean;
  destroy(): void;
  onDrained(callback: () => void): void;
}

// ---------------------------------------------------------------------------
// Web implementation – browser AudioContext + scheduled AudioBufferSourceNodes
// ---------------------------------------------------------------------------

class WebAudioPlaybackEngine implements AudioPlaybackEngine {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private started = false;
  private bufferedChunks: AudioBuffer[] = [];
  private drainedCallback: (() => void) | null = null;
  private pendingSources = 0;
  private destroyed = false;

  init(): void {
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  }

  enqueue(pcmData: ArrayBuffer): void {
    if (this.destroyed || !this.ctx) return;

    // Resume suspended context (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const audioBuffer = this.pcmToAudioBuffer(pcmData);

    if (!this.started) {
      this.bufferedChunks.push(audioBuffer);
      if (this.bufferedChunks.length >= CHUNKS_BEFORE_START) {
        this.startPlayback();
      }
      return;
    }

    this.scheduleBuffer(audioBuffer);
  }

  clear(): void {
    // Close and recreate context to cancel all scheduled sources
    if (this.ctx) {
      this.ctx.close().catch(() => {});
    }
    this.started = false;
    this.bufferedChunks = [];
    this.pendingSources = 0;
    this.nextStartTime = 0;
    if (!this.destroyed) {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
  }

  isActive(): boolean {
    return this.started && this.pendingSources > 0;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.bufferedChunks = [];
    this.pendingSources = 0;
  }

  onDrained(callback: () => void): void {
    this.drainedCallback = callback;
  }

  // -- internal --

  private pcmToAudioBuffer(pcmData: ArrayBuffer): AudioBuffer {
    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    const buf = this.ctx!.createBuffer(1, float32.length, SAMPLE_RATE);
    buf.copyToChannel(float32, 0);
    return buf;
  }

  private startPlayback(): void {
    if (!this.ctx) return;
    this.started = true;
    // Start slightly in the future to give the system time to schedule
    this.nextStartTime = this.ctx.currentTime + 0.05;
    for (const buf of this.bufferedChunks) {
      this.scheduleBuffer(buf);
    }
    this.bufferedChunks = [];
  }

  private scheduleBuffer(audioBuffer: AudioBuffer): void {
    if (!this.ctx) return;

    // Re-anchor on underflow: if nextStartTime is already in the past,
    // the queue ran dry. Jump ahead to avoid stacking.
    if (this.nextStartTime < this.ctx.currentTime) {
      console.log('[AudioPlayback] Underflow detected, re-anchoring');
      this.nextStartTime = this.ctx.currentTime + 0.05;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ctx.destination);
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.pendingSources++;

    source.onended = () => {
      this.pendingSources--;
      if (this.pendingSources === 0 && this.drainedCallback) {
        this.drainedCallback();
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Native implementation – react-native-audio-api AudioBufferQueueSourceNode
// ---------------------------------------------------------------------------

class NativeAudioPlaybackEngine implements AudioPlaybackEngine {
  private ctx: any = null; // AudioContext from react-native-audio-api
  private queueSource: any = null;
  private started = false;
  private bufferedChunks: any[] = [];
  private drainedCallback: (() => void) | null = null;
  private destroyed = false;
  private enqueuedCount = 0;
  private endedCount = 0;

  init(): void {
    const { AudioContext: RNAudioContext } = require('react-native-audio-api');
    this.ctx = new RNAudioContext({ sampleRate: SAMPLE_RATE });
    this.queueSource = this.ctx.createBufferQueueSource();
    this.queueSource.connect(this.ctx.destination);

    this.queueSource.onEnded = (event: any) => {
      // bufferId === undefined means the source itself was stopped
      if (event.bufferId !== undefined) {
        this.endedCount++;
        if (this.endedCount === this.enqueuedCount && this.drainedCallback) {
          this.drainedCallback();
        }
      }
    };
  }

  enqueue(pcmData: ArrayBuffer): void {
    if (this.destroyed || !this.ctx) return;

    const audioBuffer = this.pcmToAudioBuffer(pcmData);

    if (!this.started) {
      this.bufferedChunks.push(audioBuffer);
      if (this.bufferedChunks.length >= CHUNKS_BEFORE_START) {
        this.startPlayback();
      }
      return;
    }

    this.queueSource.enqueueBuffer(audioBuffer);
    this.enqueuedCount++;
  }

  clear(): void {
    if (this.queueSource) {
      this.queueSource.clearBuffers();
    }
    this.started = false;
    this.bufferedChunks = [];
    this.enqueuedCount = 0;
    this.endedCount = 0;

    // Recreate queue source for next round of playback
    if (!this.destroyed && this.ctx) {
      this.queueSource = this.ctx.createBufferQueueSource();
      this.queueSource.connect(this.ctx.destination);

      this.queueSource.onEnded = (event: any) => {
        if (event.bufferId !== undefined) {
          this.endedCount++;
          if (this.endedCount === this.enqueuedCount && this.drainedCallback) {
            this.drainedCallback();
          }
        }
      };
    }
  }

  isActive(): boolean {
    return this.started && this.enqueuedCount > this.endedCount;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.queueSource) {
      try { this.queueSource.clearBuffers(); } catch {}
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch {}
      this.ctx = null;
    }
    this.queueSource = null;
    this.bufferedChunks = [];
  }

  onDrained(callback: () => void): void {
    this.drainedCallback = callback;
  }

  // -- internal --

  private pcmToAudioBuffer(pcmData: ArrayBuffer): any {
    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    const buf = this.ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buf.copyToChannel(float32, 0);
    return buf;
  }

  private startPlayback(): void {
    this.started = true;
    for (const buf of this.bufferedChunks) {
      this.queueSource.enqueueBuffer(buf);
      this.enqueuedCount++;
    }
    this.bufferedChunks = [];
    this.queueSource.start(this.ctx.currentTime);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlaybackEngine(): AudioPlaybackEngine {
  if (Platform.OS === 'web') {
    return new WebAudioPlaybackEngine();
  }
  return new NativeAudioPlaybackEngine();
}
