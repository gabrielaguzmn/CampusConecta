class DeepgramAudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const entrada = inputs[0]?.[0]
    if (entrada) {
      const pcm = new Int16Array(entrada.length)
      let energia = 0
      for (let i = 0; i < entrada.length; i += 1) {
        const muestra = Math.max(-1, Math.min(1, entrada[i]))
        energia += muestra * muestra
        pcm[i] = muestra < 0 ? muestra * 0x8000 : muestra * 0x7fff
      }
      const nivel = Math.sqrt(energia / entrada.length)
      this.port.postMessage({ audio: pcm.buffer, nivel }, [pcm.buffer])
    }

    for (const canal of outputs[0] ?? []) canal.fill(0)
    return true
  }
}

registerProcessor('deepgram-audio-processor', DeepgramAudioProcessor)
