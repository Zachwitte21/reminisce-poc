/**
 * Web Audio Recorder Service
 *
 * Captures raw PCM audio from the microphone using the Web Audio API.
 * Used for web platform only - native platforms use expo-av.
 *
 * Audio Pipeline: Microphone -> AudioWorklet (Float32 to Int16) -> Resample to 16kHz -> WebSocket
 * Output: 16-bit PCM, 16kHz, mono (required by Gemini Live API)
 */

type AudioChunkCallback = (pcmData: ArrayBuffer) => void;

interface WebAudioRecorderState {
  audioContext: AudioContext | null;
  workletNode: AudioWorkletNode | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  mediaStream: MediaStream | null;
  isRecording: boolean;
  onAudioChunk: AudioChunkCallback | null;
}

// Gemini Live API requires 16kHz audio
const TARGET_SAMPLE_RATE = 16000;

// Buffer ~100ms of audio before sending (1600 samples at 16kHz)
const MIN_CHUNK_SAMPLES = 1600;

class WebAudioRecorder {
  private state: WebAudioRecorderState = {
    audioContext: null,
    workletNode: null,
    sourceNode: null,
    mediaStream: null,
    isRecording: false,
    onAudioChunk: null,
  };

  private resampledBuffer: Int16Array[] = [];
  private totalSamples = 0;

  static isSupported(): boolean {
    return typeof window !== 'undefined' &&
      typeof AudioContext !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getUserMedia === 'function';
  }

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('[WebAudioRecorder] Permission denied:', err);
      return false;
    }
  }

  async start(onAudioChunk: AudioChunkCallback): Promise<boolean> {
    if (this.state.isRecording) {
      return false;
    }

    if (!WebAudioRecorder.isSupported()) {
      console.error('[WebAudioRecorder] Web Audio API not supported');
      return false;
    }

    try {
      this.state.onAudioChunk = onAudioChunk;
      this.resampledBuffer = [];
      this.totalSamples = 0;

      this.state.audioContext = new AudioContext();
      if (this.state.audioContext.state === 'suspended') {
        await this.state.audioContext.resume();
      }

      try {
        await this.state.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');
      } catch {
        // Fallback for different serving configurations
        await this.state.audioContext.audioWorklet.addModule('./audio-worklet-processor.js');
      }

      this.state.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.state.sourceNode = this.state.audioContext.createMediaStreamSource(
        this.state.mediaStream
      );

      this.state.workletNode = new AudioWorkletNode(
        this.state.audioContext,
        'pcm-audio-processor'
      );

      this.state.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          this.handleAudioData(event.data.samples, event.data.sampleRate);
        }
      };

      this.state.sourceNode.connect(this.state.workletNode);

      this.state.isRecording = true;
      console.log('[WebAudioRecorder] Recording started');
      return true;

    } catch (err) {
      console.error('[WebAudioRecorder] Failed to start:', err);
      await this.cleanup();
      return false;
    }
  }

  async stop(): Promise<void> {
    if (!this.state.isRecording) {
      return;
    }

    if (this.state.workletNode) {
      this.state.workletNode.port.postMessage({ type: 'flush' });
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.flushBuffer();
    await this.cleanup();
    console.log('[WebAudioRecorder] Recording stopped');
  }

  private handleAudioData(samples: ArrayBuffer, sourceSampleRate: number): void {
    if (!this.state.isRecording || !this.state.onAudioChunk) {
      return;
    }

    const inputSamples = new Int16Array(samples);
    const resampled = this.resample(inputSamples, sourceSampleRate, TARGET_SAMPLE_RATE);

    this.resampledBuffer.push(resampled);
    this.totalSamples += resampled.length;

    if (this.totalSamples >= MIN_CHUNK_SAMPLES) {
      this.flushBuffer();
    }
  }

  private resample(input: Int16Array, sourceSampleRate: number, targetSampleRate: number): Int16Array {
    if (sourceSampleRate === targetSampleRate) {
      return input;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;
      output[i] = Math.round(input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t);
    }

    return output;
  }

  private flushBuffer(): void {
    if (this.resampledBuffer.length === 0 || !this.state.onAudioChunk) {
      return;
    }

    const totalLength = this.resampledBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Int16Array(totalLength);

    let offset = 0;
    for (const chunk of this.resampledBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    this.resampledBuffer = [];
    this.totalSamples = 0;

    try {
      this.state.onAudioChunk(combined.buffer);
    } catch (err) {
      console.error('[WebAudioRecorder] Callback error:', err);
    }
  }

  private async cleanup(): Promise<void> {
    this.state.isRecording = false;
    this.state.onAudioChunk = null;

    if (this.state.workletNode) {
      this.state.workletNode.disconnect();
      this.state.workletNode = null;
    }

    if (this.state.sourceNode) {
      this.state.sourceNode.disconnect();
      this.state.sourceNode = null;
    }

    if (this.state.mediaStream) {
      this.state.mediaStream.getTracks().forEach(track => track.stop());
      this.state.mediaStream = null;
    }

    if (this.state.audioContext && this.state.audioContext.state !== 'closed') {
      await this.state.audioContext.close();
      this.state.audioContext = null;
    }

    this.resampledBuffer = [];
    this.totalSamples = 0;
  }

  get isRecording(): boolean {
    return this.state.isRecording;
  }
}

let recorderInstance: WebAudioRecorder | null = null;

export function getWebAudioRecorder(): WebAudioRecorder {
  if (!recorderInstance) {
    recorderInstance = new WebAudioRecorder();
  }
  return recorderInstance;
}

export { WebAudioRecorder };
export type { AudioChunkCallback };
