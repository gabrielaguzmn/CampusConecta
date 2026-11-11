# Plan de pruebas MVP2: asistente de voz para crear eventos

## Estrategia de pruebas

| Nivel | Alcance | Archivo nuevo | Herramienta | Qué se simula |
|---|---|---|---|---|
| Unitario, frontend | Interpretación de siete campos, catálogos, ambigüedad, fechas, cupos y órdenes | `frontend/src/lib/voiceInterpreter.test.ts` | Vitest, fake timers, `vi.setSystemTime` | Catálogos ficticios; reloj fijo en `America/Bogota` |
| Integración, backend | Autenticación, métodos, estados de respuesta, contrato Deepgram, errores, ausencia de escrituras y filtración de secretos | `backend/cuentas/tests/test_voz.py` | Django `APITestCase`, SimpleJWT, `unittest.mock.patch` | `urlopen`, respuestas/errores del servicio; ningún acceso a red |
| Integración, componente | Consentimiento, estados, WebSocket, audio, transcripción, mensajes, ambigüedad, error y liberación | `frontend/src/components/AsistenteVoz.test.tsx`, `frontend/src/test/vozFalso.ts` | Vitest, Testing Library, `vi.stubGlobal` | WebSocket, Web Audio, `getUserMedia`, RAF y `fetch` |
| Integración, flujo completo | Crear, rellenar, editar a mano, publicar con clic, privacidad y cierre; asistente ausente al editar | `frontend/src/pages/mis-eventos/AsistenteVoz.integracion.test.tsx` | Vitest, `renderizarApp`, `simularApi` | JWT de prueba, API, Deepgram, audio y WebSocket |
| Aceptación | Escenarios observables de VOICE-1 a VOICE-8; combinan API, componente y formulario | Las tres suites de integración anteriores | `APITestCase`, Testing Library | Los mismos dobles; no se usa un navegador real ni Deepgram |
| Manual | Reconocimiento de voz real, permisos, latencia, precisión, navegadores y cierre por inactividad | Guion de este documento | Chrome, Edge, Firefox y Safari | Micrófono y servicio externo en ambiente de prueba, con consentimiento |

No se agrega herramienta ni dependencia. Todas las pruebas automáticas son offline. `voiceInterpreter.test.ts` fija el reloj y usa `vi.stubEnv('TZ', 'America/Bogota')`; se debe repetir el frontend con `TZ=UTC` para detectar dependencias de zona en CI.

## Pruebas unitarias

| Prueba | Componente | Entrada | Resultado esperado |
|---|---|---|---|
| Siete campos de texto | `interpretarRespuesta` | Nombre, descripción, responsable, detalle, cupo, contacto y enlace | Valor asignado al paso actual |
| Contacto | `interpretarRespuesta` | Teléfono, número en dos partes y correo dictado | Número combinado o correo normalizado |
| Enlace y cupo | `interpretarRespuesta` | URL pronunciada con “punto”/“barra”; cero y negativos | URL reconstruida; cupos inválidos rechazados |
| Categoría y ubicación | `interpretarRespuesta` | Categoría sin tilde, ubicación ambigua y selección ordinal | ID único o petición de desambiguación |
| Comandos | `comandoDicho` | Omitir, ayuda, publicar y frase no exacta | Reconoce solo comandos de respuesta completa |
| Fecha | `interpretarRespuesta` | Rango de tarde, fecha sin horario, pasado, fin anterior y otra fecha | Fecha local `AAAA-MM-DDTHH:MM`; entradas inválidas no se agregan |

El archivo de pruebas ejecutable es [voiceInterpreter.test.ts](../frontend/src/lib/voiceInterpreter.test.ts).

## Pruebas de integración

| Alcance | Prueba | Resultado esperado |
|---|---|---|
| Token | 200 con TTL 30, autorización `Token`, timeout y URL correctos | Solo token temporal; TTL no mayor a 30 |
| Token y autenticación | Sin sesión, JWT real vencido, JWT real alterado; GET/PUT/DELETE | 401 para credenciales inválidas; 405 para métodos no permitidos autenticados |
| Fallos de Deepgram | Clave ausente, `HTTPError`, `URLError`, timeout, JSON inválido y token ausente | 503 sin secreto en respuesta o logs |
| Captura de voz | Estados, consentimiento, permiso, APIs faltantes y 503 del token | Flujo visible y recuperación manual |
| WebSocket | Protocolo bearer, `speech_final`, orden de transcripción, errores/cierre | Token solo en subprotocolo; descarta resultados parciales |
| Formulario | Datos dictados, corrección manual, fechas, publicación por botón y edición | `POST /api/eventos/` solo al clic, con cuerpo esperado |
| Privacidad y recursos | Historial de requests, storage, desmontaje/cierre/desactivación | Sin transcripción en API/storage; pistas detenidas, socket/audio cerrados |
| Catálogos y entradas | Ambigüedad, HTML y contenido largo | Opción elegible; contenido literal seguro |

Los archivos ejecutables son [test_voz.py](../backend/cuentas/tests/test_voz.py), [AsistenteVoz.test.tsx](../frontend/src/components/AsistenteVoz.test.tsx) y [AsistenteVoz.integracion.test.tsx](../frontend/src/pages/mis-eventos/AsistenteVoz.integracion.test.tsx).

## Pruebas de seguridad

| Amenaza | Requisito | Prueba | Resultado esperado |
|---|---|---|---|
| Emisión sin autenticar o con JWT inválido | Control de acceso al token | `test_VOICE_1_c1_token_requiere_sesion`, `...jwt_vencido`, `...jwt_alterado` | 401 sin invocar Deepgram |
| Filtración de clave maestra | RNF-011 | `test_RNF011_clave_no_se_filtra_en_respuesta_detail_ni_registros` | Clave ficticia ausente del body, `detail` y `assertLogs` |
| Token excesivamente largo | RNF-011 | Tests de TTL presente, ausente y de 60 s | `expires_in <= 30` |
| Clave/token en URL | RNF-011 | Protocolo y URL del WebSocket | URL sin clave/token; token únicamente en `['bearer', token]` |
| Persistencia/transmisión no autorizada | RNF-008 | Test del flujo inspecciona requests y storage; conteos en backend | La transcripción queda en UI; no se envía ni persiste; emisión no modifica datos |
| XSS e inyección de texto | RF-035–RF-043 (confirmar RF exacto) | Test con `<script>` y caracteres especiales | DOM lo renderiza como texto; campos mantienen la cadena literal |
| Recursos del micrófono | Requisito de privacidad/ciclo de vida (confirmar RNF exacto) | Detener, cerrar modal y desmontar | Pistas detenidas; socket y AudioContext cerrados |
| Publicación por voz | RF-040 | Test con campos válidos y frase “Crear evento” | Sin `POST` hasta pulsar “Crear evento” |

## Pruebas de aceptación

Los nombres VOICE-1 a VOICE-8 se conservan en descripciones de tests cuando el escenario está identificado. La numeración de criterios individuales no se puede certificar: el repositorio y la solicitud no incluyen el texto fuente Dado/Cuando/Entonces. Cobertura ejecutable actualmente identificable:

| HU | Criterio / escenario | Prueba |
|---|---|---|
| VOICE-1 | Obtener token autenticado y manejar éxito/error | `TokenDeepgramTests` en `test_voz.py` |
| VOICE-2 | Interpretar respuestas para los siete campos | `interpretarRespuesta` unitarios; flujo del formulario |
| VOICE-3 | Resolver categoría/ubicación y ofrecer selección en ambigüedad | Unitarios y `VOICE-7` de componente |
| VOICE-4 | Llenar y corregir campos en el formulario de creación | Integración del formulario |
| VOICE-5 | Interpretar y anexar fechas | Unitarios y prueba de formulario |
| VOICE-6 | Evitar publicar sin acción explícita | Test `VOICE-6/RF-040` |
| VOICE-7 | Consentimiento, conexión, estados, errores y liberar recursos | `AsistenteVoz.test.tsx` y prueba de cierre del formulario |
| VOICE-8 | Mostrar ejemplo de instrucciones | Test `VOICE-8` del componente; “ayuda” y ejemplo por campo quedan pendientes según alcance observado |

Esto verifica al menos un flujo por historia, no todos los criterios individuales de las historias originales. No se asignan falsos “pasa” a criterios fuente no disponibles.

## Guion manual de aceptación

Ejecutar cada frase en Chrome, Edge, Firefox y Safari con micrófono permitido, una cuenta de prueba y Deepgram configurado. Registrar tiempo desde el final de la locución hasta que todos los campos aparecen; RNF-009 establece un máximo de 5 s. Revisar la transcripción reconocida antes de valorar el mapeo. Las frases de abajo son propuestas de cobertura basadas en las capacidades descritas; deben cotejarse con las diez frases canónicas de VOICE-2, que no están en los archivos proporcionados.

| # | Frase de prueba propuesta | Campo(s) esperado(s) |
|---:|---|---|
| 1 | “El nombre del evento es Feria de emprendimiento.” | Nombre = Feria de emprendimiento |
| 2 | “La descripción es una actividad para estudiantes.” | Descripción |
| 3 | “Organiza Club de ciencia; el responsable es el mismo club.” | Responsable (validar transcripción antes de aceptar) |
| 4 | “La ubicación exacta es Sala norte, edificio B 13.” | Detalle de ubicación y ubicación del catálogo B13 |
| 5 | “La categoría es Talleres y el cupo máximo es veinte.” | Categoría y cupo |
| 6 | “El contacto es 3001234567.” | Contacto |
| 7 | “El link es https://example.test/feria.” | Enlace externo |
| 8 | “El título es Feria de proyectos; cambia el título a Feria de innovación.” | Nombre final = Feria de innovación |
| 9 | “El 16 de diciembre de 2027 de 2 a 5 de la tarde.” | Fecha, inicio 14:00, fin 17:00 |
| 10 | “Segunda fecha: el 18 de diciembre de 2027 a las 3 pm hasta las 5 pm.” | Segunda fecha con inicio 15:00 y fin 17:00 |

### Plantilla de evidencia

| Navegador/versión | Frase # | Transcripción visible | Campo esperado | Valor observado | Resultado (Pasa/Falla) | Precisión (%) | Latencia (s, <=5) | Permiso/cierre/observaciones |
|---|---:|---|---|---|---|---:|---:|---|
| | | | | | | | | |

Repetir cada fila con los cuatro navegadores. Hacer además un recorrido de denegación del permiso, desactivación, cierre del modal y desmontaje; comprobar que el formulario manual sigue usable y el indicador del micrófono desaparece.

## Regresión del MVP1

Ejecutar sin alterar los tests existentes:

```powershell
Set-Location backend
python manage.py test
Set-Location ..\frontend
npm test
npm run build
$env:TZ = 'UTC'
npm test
Remove-Item Env:TZ
```

La suite debe correr con la base PostgreSQL de CI o una base de pruebas equivalente. Los nuevos tests que formalizan desviaciones conocidas pueden fallar intencionalmente hasta que producto apruebe corregir el código; esos fallos no deben ocultarse ni marcarse como omitidos.

Validación actualizada el 11 de noviembre de 2026: la suite completa del frontend pasó con 428 pruebas en 29 archivos; las 46 pruebas de voz (unidad, componente e integración) también pasaron. Se añadieron pruebas unitarias para contacto telefónico/email, teléfono en partes, enlace hablado, selección ordinal, rango de tarde, horario inválido y fecha adicional. No se modificaron pruebas existentes del MVP1. Para la suite completa se usó `--maxWorkers=1` y `--testTimeout=15000` por la duración del entorno.

La comprobación actual de TypeScript/build detectó un error de tipos ajeno a los archivos de MVP2 modificados: `frontend/src/voice-assistant/components/VoiceAssistant.tsx` pasa `"start"` a `speechError`, cuyo tipo no acepta ese valor. Por eso, el build no queda certificado en esta ejecución.

Se ejecutaron también 21 pruebas backend de las suites de voz (`cuentas.tests.test_voz`, `voice_assistant.tests.test_api` y `voice_assistant.tests.test_engine`): todas las pruebas reportaron `OK`, pero Django terminó con error al destruir la base temporal porque Supavisor mantenía una conexión inactiva a ella. Se limpió la base temporal aislada creada para esa ejecución; la suite backend completa no se ejecutó. Las pruebas de navegador real, micrófono, latencia y precisión siguen pendientes: las pruebas automáticas usan WebSocket, audio y API simulados, y no sustituyen enviar audio a Deepgram desde cada navegador.

Efecto de cambios colaterales MVP1:

- `CampoSeleccion` siempre monta un `<p role="alert">`, con `aria-hidden` cuando no hay error. Los tests previos que cuentan alertas globalmente podrían observar una diferencia; `aria-hidden` debe mantener el nodo vacío fuera del árbol accesible. Verificar los tests que usan `getByRole('alert')` y el comportamiento con lector de pantalla.
- `descripcion` ahora puede ser vacía en el esquema Zod frontend, pero `EventoCreacionSerializer` deriva un campo obligatorio del `TextField` del modelo (sin `blank=True`). El formulario puede aceptar y enviar una descripción vacía, y solo mostrar el rechazo del backend al publicar. La descripción opcional requiere confirmar/ajustar el contrato backend aparte; este trabajo no modifica producción.
- No tocar ni adaptar tests existentes del MVP1 por conveniencia; reportar regresiones reales por separado.

Comprobación propuesta para CI/CD, fuera de estos tests funcionales:

```powershell
if ([string]::IsNullOrWhiteSpace($env:DEEPGRAM_API_KEY)) { throw 'Configura el secreto CI DEEPGRAM_API_KEY' }
git check-ignore -q backend/.env
if ($LASTEXITCODE -ne 0) { throw 'backend/.env no está ignorado' }
git ls-files --error-unmatch backend/.env *> $null
if ($LASTEXITCODE -eq 0) { throw 'backend/.env está versionado' }
git grep -q -I -F -- "$env:DEEPGRAM_API_KEY" -- .
if ($LASTEXITCODE -eq 0) { throw 'La clave aparece en el repositorio' }
if (Get-ChildItem frontend\dist -Recurse -File | Select-String -Quiet -SimpleMatch $env:DEEPGRAM_API_KEY) {
  throw 'La clave aparece en el build del frontend'
}
```

Las búsquedas usan una variable de secreto del entorno y solo imprimen un resultado genérico, nunca el valor de la clave. En CI deben fallar si `.env` no está ignorado, está en el índice o aparece una variable de secreto en los artefactos.

## Matriz de trazabilidad

| Requisito | HU y criterio | Pruebas | Resultado esperado / inicial |
|---|---|---|---|
| Token temporal, autenticación y errores | VOICE-1; criterio exacto pendiente | `backend/cuentas/tests/test_voz.py` | 21 pruebas backend seleccionadas pasan; teardown bloqueado por conexión inactiva de Supavisor; suite backend completa pendiente |
| Siete campos y respuestas de voz | VOICE-2; criterios fuente pendientes | `voiceInterpreter.test.ts`, flujo de formulario | Pasa en frontend; contacto y URL hablada tienen pruebas unitarias |
| Catálogos, inactivos y ambigüedad | VOICE-3; criterio fuente pendiente | Unitarios y `AsistenteVoz.test.tsx` | Pasa con los catálogos activos dados |
| Formulario, corrección, fechas destacadas | VOICE-4; criterio fuente pendiente | `AsistenteVoz.integracion.test.tsx` | Pasa en suite frontend |
| Fechas y horarios | VOICE-5 c1/c4/c5 según desviaciones recibidas | `voiceInterpreter.test.ts` | Pasa; incluye rango de tarde, fecha sin hora, fecha pasada y fin inválido |
| Fechas solapadas | VOICE-5; criterio fuente pendiente | Integración del formulario | Pasa en prueba simulada: se envían ambas y se muestra el error |
| No publicar por voz | VOICE-6 c4 / RF-040 | Test de formulario con “Crear evento” | Pasa: solo se publica al pulsar el botón |
| Errores y ciclo de vida | VOICE-7; criterio fuente pendiente | `AsistenteVoz.test.tsx` y flujo modal | Pasa en suite frontend |
| Ayuda y cierre por inactividad | VOICE-8 c1/c2 y DoD | `AsistenteVoz.test.tsx` | Pasa en suite frontend; cierre de inactividad verificado |
| RF-035 a RF-039 | HU/criterio exacto no provisto | Entradas/campos de interpretación e integración | No verificable hasta recibir texto de requisitos |
| RF-040 | VOICE-6 c4 | Test de publicación explícita | Pasa en suite frontend |
| RF-041 a RF-043 | HU/criterio exacto no provisto | Tests generales de flujo/privacidad | No verificable hasta recibir texto de requisitos |
| RNF-008 | Privacidad de transcripción | Test frontend de requests/storage; conteos backend | Pasa frontend; test backend incluido en las 21 pruebas seleccionadas |
| RNF-009 | Latencia <= 5 s | Guion manual | Manual; Vitest no mide experiencia real de voz/red |
| RNF-010 | Seguridad de contenido (interpretación por confirmar) | Test de HTML/cadena larga | Pasa como texto seguro; confirmar definición del RNF |
| RNF-011 | Protección de credenciales/TTL | Tests backend y WebSocket frontend | Pruebas seleccionadas pasan; falta suite backend completa en CI |
| RNF-012 | Texto no provisto | — | No verificable; requiere texto del requisito |

## Hallazgos

Hallazgos confirmados inicialmente y corregidos en esta iteración:

| Criterio o requisito | Esperado | Obtenido en implementación revisada | Severidad |
|---|---|---|---|
| VOICE-5 c1 | “De 2 a 5 de la tarde” produce 14:00–17:00 | Corregido; prueba unitaria pasa |
| VOICE-5 c4 | Sin hora, no agregar fecha y pedir horario | Corregido; prueba unitaria pasa |
| VOICE-5 c5 | Rechazar fecha pasada en interpretación | Corregido; prueba unitaria pasa |
| VOICE-5 | Fin posterior al inicio | Corregido; prueba unitaria pasa |
| VOICE-2 | Enlace externo conserva URL completa | Corregido; prueba unitaria pasa |
| VOICE-6 c4 / RF-040 | Crear/publicar hablado no envía el formulario | Corregido; integración confirma que requiere clic |
| RNF-011 | TTL de token <= 30 s, también si falta `expires_in` | Corregido en backend; pendiente de ejecutar test Django con DB disponible |
| VOICE-7 DoD | Mensajes claros, sin detalles de rol/clave/código | Corregido; pruebas del componente pasan |
| VOICE-8 c1/c2/DoD | Ejemplo, comando “ayuda” y cierre tras 60 s sin voz | Corregido según pruebas del componente |
| Suite Django | Ejecutar pruebas de token | No verificable localmente: credenciales PostgreSQL no disponibles; correr en CI |

## Preguntas abiertas

1. ¿Dónde están los textos canónicos de los criterios Dado/Cuando/Entonces y la Definition of Done de VOICE-1…VOICE-8? Se necesitan para separar cada criterio en una prueba y evitar atribuciones aproximadas.
2. ¿Cuáles son las diez frases exactas requeridas en VOICE-2? Las diez de este guion son propuestas, no sustituyen el texto aprobado.
3. ¿Cuáles son las definiciones literales de RF-035…RF-043 y RNF-008…RNF-012? Solo se identificaron en el contexto privacidad (008), latencia (009), credenciales (011) y el comportamiento de RF-040.
4. ¿Debe rechazarse en el navegador un horario que termina antes de iniciar, y cuál debe ser el comportamiento (mensaje/no agregar)?
5. Si Deepgram omite `expires_in`, ¿el endpoint debe responder 503 o establecer 30? La implementación actual usa 30 como máximo; confirmar si esa política es la aprobada.
6. ¿El ejemplo general de instrucciones satisface VOICE-8 c1, o es obligatorio presentar un ejemplo contextual por campo?
7. ¿Debe cerrarse también la sesión de voz al superar 60 segundos sin voz? Definir si se mide silencio del micrófono, silencio del WebSocket o ambos.
8. ¿Qué precisión (umbral y forma de cálculo) debe considerarse aceptable además de registrar la transcripción y la latencia?
