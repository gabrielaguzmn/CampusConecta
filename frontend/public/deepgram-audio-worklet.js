// Convierte el audio del micrófono a PCM de 16 bits y lo envía en bloques de unos 100 ms.
// El navegador llama a process() cada 128 muestras (unos 3 ms); enviar cada llamada saturaba el WebSocket
// con cientos de mensajes por segundo.
class DeepgramAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.tamano = Math.round(sampleRate / 10)
    this.bloque = new Int16Array(this.tamano)
    this.posicion = 0
  }

  process(inputs, outputs) {
    const entrada = inputs[0]?.[0]
    if (entrada) {
      for (let i = 0; i < entrada.length; i += 1) {
        const muestra = Math.max(-1, Math.min(1, entrada[i]))
        this.bloque[this.posicion] = muestra < 0 ? muestra * 0x8000 : muestra * 0x7fff
        this.posicion += 1
        if (this.posicion === this.tamano) {
          this.port.postMessage({ audio: this.bloque.buffer }, [this.bloque.buffer])
          this.bloque = new Int16Array(this.tamano)
          this.posicion = 0
        }
      }
    }

    for (const canal of outputs[0] ?? []) canal.fill(0)
    return true
  }
}

registerProcessor('deepgram-audio-processor', DeepgramAudioProcessor)
