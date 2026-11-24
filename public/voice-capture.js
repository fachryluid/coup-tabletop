// Mono PCM at 16 kHz, in 40 ms packets. The audio output stays silent.
class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.packet = new Int16Array(640);
    this.index = this.phase = this.sum = this.samples = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const value of channel) {
      this.sum += value;
      this.samples++;
      this.phase += 16000;
      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;
      this.packet[this.index++] = Math.round(
        Math.max(-1, Math.min(1, this.sum / this.samples)) * 32767,
      );
      this.samples = this.sum = 0;
      if (this.index === this.packet.length) {
        this.port.postMessage(this.packet.buffer, [this.packet.buffer]);
        this.packet = new Int16Array(640);
        this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor("voice-capture", VoiceCapture);
