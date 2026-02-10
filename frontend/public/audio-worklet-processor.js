/**
 * PCM Audio Worklet Processor
 * Converts Float32 samples to Int16 PCM and posts to main thread in ~100ms chunks.
 */

class PCMAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 4800; // ~100ms at 48kHz

    this.port.onmessage = (event) => {
      if (event.data.type === 'flush') {
        this.sendBuffer();
      }
    };
  }

  floatTo16BitPCM(float32) {
    const s = Math.max(-1, Math.min(1, float32));
    return s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0]) {
      const samples = input[0];
      for (let i = 0; i < samples.length; i++) {
        this.buffer.push(samples[i]);
      }

      if (this.buffer.length >= this.bufferSize) {
        this.sendBuffer();
      }
    }

    return true;
  }

  sendBuffer() {
    if (this.buffer.length === 0) return;

    const int16Buffer = new Int16Array(this.buffer.length);
    for (let i = 0; i < this.buffer.length; i++) {
      int16Buffer[i] = this.floatTo16BitPCM(this.buffer[i]);
    }

    this.port.postMessage({
      type: 'audio',
      samples: int16Buffer.buffer,
      sampleRate: sampleRate
    }, [int16Buffer.buffer]);

    this.buffer = [];
  }
}

registerProcessor('pcm-audio-processor', PCMAudioProcessor);
