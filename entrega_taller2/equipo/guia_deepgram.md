# Guía de Deepgram para el asistente de voz de CampusConecta

Esta guía explica cómo usar Deepgram en el MVP2: crear la cuenta, configurar la clave, entender el flujo y probarlo. Los datos técnicos salen de la documentación oficial de Deepgram y del README del SDK `@deepgram/sdk` 5.18.0, consultados el 10 de noviembre de 2026. Lo que no se pudo confirmar está marcado como **por confirmar**.

## 1. Qué usamos de Deepgram

Solo el **reconocimiento del habla en tiempo real**:

- El navegador envía el audio del micrófono por una conexión WebSocket a `wss://api.deepgram.com/v1/listen`.
- Deepgram devuelve el texto mientras la persona habla: resultados parciales, resultados finales y un aviso cuando termina cada frase.
- Modelo **Nova-3**, idioma español (`language=es`; también existe `es-419`).

No usamos agentes de voz, síntesis de voz ni modelos de lenguaje. El texto lo interpreta nuestro backend con reglas.

## 2. Crear la cuenta y la clave

1. Crear la cuenta en [console.deepgram.com/signup](https://console.deepgram.com/signup). No pide tarjeta.
2. La cuenta nueva trae un **crédito gratuito de 200 USD**. Si el crédito vence o no, está **por confirmar**: las fuentes no coinciden, así que hay que revisarlo en la consola.
3. En la consola, crear una **API key** con rol **Member** o superior. Con un rol menor, la generación de credenciales temporales responde `FORBIDDEN`.
4. Copiar la clave una sola vez y guardarla en un lugar seguro. **No pegarla en el chat del grupo, en el código ni en el repositorio.**

## 3. Configurar la clave en el proyecto

La clave **solo** vive en el backend:

```bash
# backend/.env (este archivo no se sube al repositorio)
DEEPGRAM_API_KEY=pega_aqui_la_clave
```

- En `backend/.env.example` va la variable vacía, como referencia: `DEEPGRAM_API_KEY=`.
- En el despliegue se configura como variable de entorno del servidor, igual que las demás.
- El frontend **no** tiene ninguna variable de Deepgram. Si alguien propone `VITE_DEEPGRAM_...`, está mal: esa clave quedaría visible en el navegador.

## 4. Cómo funciona la autenticación

Para que la clave nunca llegue al navegador, usamos **credenciales temporales**:

1. La persona, con sesión iniciada, activa el micrófono.
2. El frontend llama a `POST /api/eventos/asistente-voz/credencial/`.
3. El backend pide a Deepgram una credencial temporal:

   ```
   POST https://api.deepgram.com/v1/auth/grant
   Authorization: Token <DEEPGRAM_API_KEY>
   Content-Type: application/json

   {"ttl_seconds": 30}
   ```

   Deepgram responde `{"access_token": "...", "expires_in": 30}`.
4. El backend devuelve solo esos dos datos al frontend.
5. El frontend abre la conexión con el SDK usando ese `access_token`.

Detalles importantes:

- La credencial dura **30 segundos** por defecto, con un máximo de 1 hora.
- Solo tiene que ser válida **al abrir** la conexión. Si vence después, la conexión sigue abierta hasta que se cierre.
- Cada vez que se activa el micrófono se pide una credencial nueva.

## 5. Probar la clave sin código

Desde una terminal, con la clave en la variable `DEEPGRAM_API_KEY`:

```bash
curl -X POST https://api.deepgram.com/v1/auth/grant -H "Authorization: Token $DEEPGRAM_API_KEY" -H "Content-Type: application/json" -d '{"ttl_seconds": 30}'
```

Si responde un `access_token`, la clave y el rol están bien.

Para medir la precisión en español con un audio grabado (por ejemplo, alguien leyendo las 10 frases de ejemplo del documento):

```bash
curl -X POST "https://api.deepgram.com/v1/listen?model=nova-3&language=es&smart_format=true" -H "Authorization: Token $DEEPGRAM_API_KEY" -H "Content-Type: audio/wav" --data-binary @frases_prueba.wav
```

Esta prueba usa la transcripción de archivos, no la de tiempo real, pero el modelo es el mismo. Sirve para revisar cómo transcribe nombres de edificios, siglas y fechas. Gasta un poco de crédito.

## 6. Uso en el navegador con el SDK

Instalación en el frontend, con versión exacta:

```bash
npm install @deepgram/sdk@5.18.0
```

Esquema del uso. Es orientativo: el prompt del frontend pide verificar los nombres exactos en el paquete instalado.

```ts
import { DeepgramClient } from '@deepgram/sdk'

// 1. Credencial temporal desde nuestro backend
const { access_token } = await pedirCredencial() // POST /api/eventos/asistente-voz/credencial/

// 2. Conexión de transcripción en tiempo real
const client = new DeepgramClient({ accessToken: access_token })
const conexion = await client.listen.v1.connect({
  model: 'nova-3',
  language: 'es',
  interim_results: 'true',
  smart_format: 'true',
  punctuate: 'true',
})

conexion.on('message', (mensaje) => {
  if (mensaje.type === 'Results') {
    const texto = mensaje.channel.alternatives[0].transcript
    // is_final: este fragmento ya no cambia. speech_final: la persona terminó la frase.
  }
})

conexion.connect()
await conexion.waitForOpen()

// 3. Micrófono → Deepgram
const microfono = await navigator.mediaDevices.getUserMedia({ audio: true })
const grabador = new MediaRecorder(microfono, { mimeType: 'audio/webm' })
grabador.ondataavailable = async (e) => conexion.sendMedia(await e.data.arrayBuffer())
grabador.start(250) // un fragmento cada 250 ms

// 4. Al terminar
grabador.stop()
microfono.getTracks().forEach((pista) => pista.stop())
conexion.sendCloseStream()
```

## 7. Mensajes que envía Deepgram

| Tipo | Qué significa |
|---|---|
| `Results` | Texto reconocido en `channel.alternatives[0].transcript`. Con `is_final: false` todavía puede cambiar; con `is_final: true` ya no cambia. `speech_final: true` indica que la frase terminó de forma natural. |
| `UtteranceEnd` | Fin de una frase detectado por silencio. Requiere `interim_results` y el parámetro `utterance_end_ms`. |
| `SpeechStarted` | La persona empezó a hablar. Requiere `vad_events`. |
| `Metadata` | Datos de la sesión. |

Mensajes que puede enviar el navegador: `KeepAlive` (mantener la conexión sin audio), `Finalize` (forzar el resultado final) y `CloseStream` (cerrar).

Para el asistente, una frase está lista para interpretarse cuando llega un `Results` con `is_final` y `speech_final`, o un `UtteranceEnd`.

## 8. Cuidar el crédito

- Las pruebas automatizadas **nunca** llaman a Deepgram: se simula la conexión.
- La conexión se cierra al desactivar el asistente o tras 60 segundos sin voz.
- El consumo se revisa en la consola de Deepgram, en la sección de uso.
- Las pruebas reales se reservan para el spike, la prueba de aceptación con las 10 frases y la presentación.

## 9. Problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `FORBIDDEN` al pedir la credencial | La clave no tiene rol Member o superior | Crear otra clave con el rol correcto |
| 503 en `/credencial/` | `DEEPGRAM_API_KEY` vacía o Deepgram no responde | Revisar `backend/.env` y la conexión a internet |
| El navegador no pide el micrófono | La página no está en `localhost` ni en HTTPS | Probar en `localhost` o desplegar con HTTPS |
| Permiso denegado | La persona bloqueó el micrófono | Habilitarlo en la configuración del sitio del navegador |
| La conexión abre pero no llega texto | Formato de audio no aceptado o idioma mal configurado | Revisar `language=es` y el `mimeType` del MediaRecorder; en Safari, **por confirmar** qué formato graba y si Deepgram lo acepta sin conversión |
| Error de CORS al llamar a Deepgram por REST desde el navegador | Deepgram no permite llamadas REST desde el navegador | Esas llamadas van siempre por el backend. El WebSocket de transcripción sí funciona desde el navegador |

## 10. Enlaces oficiales

- Autenticación con credenciales temporales: [developers.deepgram.com/guides/fundamentals/token-based-authentication](https://developers.deepgram.com/guides/fundamentals/token-based-authentication)
- Transcripción en tiempo real (referencia de la API): [developers.deepgram.com/reference/speech-to-text/listen-streaming](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)
- Modelos e idiomas: [developers.deepgram.com/docs/models-languages-overview](https://developers.deepgram.com/docs/models-languages-overview)
- SDK de JavaScript: [github.com/deepgram/deepgram-js-sdk](https://github.com/deepgram/deepgram-js-sdk)
- Precios: [deepgram.com/pricing](https://www.deepgram.com/pricing)
