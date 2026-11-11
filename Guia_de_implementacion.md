# CampusConecta · Asistente de voz

Decisiones v2, especificación ajustada, hoja de ruta de prompts e historias de usuario · Versión 2.0 · 10 de noviembre de 2026

## 1. Cómo usar este documento

Este documento complementa el diseño funcional del asistente de voz. Reúne las decisiones tomadas sobre las contradicciones detectadas, la especificación ajustada (v2) y las historias de usuario (HU) agrupadas por categoría. Cada prompt de implementación de la hoja de ruta (sección 4) cita las HU que debe cumplir, de modo que los criterios de aceptación sirvan de referencia para el desarrollo y las pruebas.

## 2. Decisiones aplicadas

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Fechas relativas en filtros | "Mañana" y "esta semana" se interpretan como estado PRÓXIMO (UPCOMING). No existe filtro por fecha. |
| 2 | Temas y categorías | Los temas se interpretan como parte de la categoría macro. No hay subcategorías. Ejemplo: "taller de programación" equivale a la categoría Talleres. |
| 3 | Contexto | Se añade un contexto de página (dónde está la persona) como entrada obligatoria del intérprete. |
| 4.1 / 4.2 | Frases ambiguas | "Muéstrame los eventos", "Quiero ver todos los eventos" y "mis eventos activos" se resuelven con el contexto de página. |
| 4.3 | Recreativas | "Actividades recreativas" pertenece a Deportes y recreación. |
| 5.1 | Imagen | Sin intents de voz. La imagen se carga solo con teclado y ratón. |
| 5.2 | Corrección y omisión | Se añaden CORRECT\_EVENT\_FIELD (corregir un campo ya dicho) y SKIP\_FIELD (omitir un campo opcional). |
| 5.3 | Intents retirados | Se omiten SHOW\_EVENT\_DETAIL y SELECT\_MAP\_LOCATION. |
| 6 | Catálogos | Estáticos por ahora: las 6 categorías definidas y las 79 ubicaciones. Se guardan en archivos de datos para poder cambiarlos fácilmente. |
| 7 | Fechas y horas | Parser ampliado: días de la semana, franjas (mañana, tarde, noche, am, pm) y formas del español (y media, y cuarto, y 20, menos cuarto). |
| 8 | Servicios externos | Se permiten servicios gratuitos para pruebas preliminares. Whisper se usará como alternativa de reconocimiento de voz. |

## 3. Especificación ajustada (v2)

### 3.1 Contexto de página

El intérprete recibe siempre la página actual: MAP, FEED, MY\_EVENTS o CREATE\_EVENT. El contexto decide el significado de las frases ambiguas.

| Página actual | Frase | Interpretación |
| --- | --- | --- |
| Feed | "Muéstrame los eventos", "Quiero ver todos los eventos", "Muéstrame nuevamente todos los eventos" | CLEAR\_FILTERS si hay filtros activos; si no, informa que ya está en el Feed. |
| Mapa, Mis eventos o Crear evento | Las mismas frases | OPEN\_FEED. |
| Mis eventos | "Muéstrame mis eventos activos" | Estado LIVE aplicado a los eventos propios (si la vista no tiene filtro de estado, el asistente lo informa). |
| Feed, Mapa o Crear evento | "Muéstrame mis eventos activos" | OPEN\_MY\_EVENTS. |
| Mapa | "Quiero ver dónde están los eventos" | Informa que ya está en el Mapa. |
| Crear evento | Texto libre | Se interpreta como valor de campo, nunca como navegación. Solo se aceptan comandos de control estrictos. |
| Crear evento con borrador | Navegar a otra pestaña | Pide confirmar el descarte del borrador. |

Regla general: si la persona ya está en la página pedida, el asistente lo dice y no ejecuta nada.

### 3.2 Intents vigentes

OPEN\_MAP, OPEN\_FEED, OPEN\_MY\_EVENTS, CREATE\_EVENT, FILTER\_EVENTS, CLEAR\_FILTERS, SET\_EVENT\_FIELD, CORRECT\_EVENT\_FIELD, SKIP\_FIELD, ADD\_EVENT\_DATE, REMOVE\_EVENT\_DATE, SUBMIT\_EVENT, CONFIRM\_ACTION, CANCEL\_ACTION y UNKNOWN.

Retirados: SHOW\_EVENT\_DETAIL y SELECT\_MAP\_LOCATION. La imagen no tiene intent: si la persona la menciona, el asistente indica que se carga manualmente.

### 3.3 Categorías y alias (catálogo estático)

Las categorías son fijas. Los alias son una lista inicial ampliable con pruebas.

| Categoría | Alias y temas |
| --- | --- |
| Ventas | venta(s), vender, comida, ropa, postres, libros, feria(s) de emprendimiento, emprendimiento, bazar |
| Talleres | taller(es), programación, tecnología, salud, arte (con "taller"), principiantes, virtuales, curso |
| Entretenimiento | entretenimiento, música, cine, juegos, concierto(s), espectáculo(s) |
| Integración | integración, conocer otros estudiantes, encuentros universitarios o sociales, bienvenida, entre facultades |
| Deportes y recreación | deporte(s), fútbol, baloncesto, voleibol, torneo(s), entrenamiento(s), competencia(s) deportiva(s), recreativa(s), recreación |
| Cultura y arte | cultura, cultural, danza, exposición(es), arte, teatro, fotografía, festival(es) cultural(es), música cultural |

Reglas de desempate: el sustantivo principal manda ("taller de arte" es Talleres; "exposición de arte" es Cultura y arte). Un nombre explícito de categoría prevalece sobre los temas. Si aún hay empate, el asistente pide aclaración.

Estados: "en vivo", "ahora", "activo" son LIVE. "Próximo(s)", "pronto", "mañana" y "esta semana" son UPCOMING.

### 3.4 Fechas y horas en español

**Días y fechas**

- Días de la semana: lunes a domingo, con o sin tilde. "El viernes" y "este viernes" son la próxima ocurrencia; "el próximo viernes" es el viernes de la semana siguiente.
- Relativas: hoy, mañana, pasado mañana.
- Absolutas: "20 de noviembre", "el 20", "20/11", "primero de diciembre".
- El año se infiere como la próxima fecha futura. Zona horaria: America/Bogota.
- Ambigüedad de "mañana": es día si no va precedido de "de la", "en la" o "por la"; en "diez de la mañana" es franja horaria.

**Horas**

| Expresión | Resultado |
| --- | --- |
| "a las diez de la mañana" | 10:00 |
| "las 3 de la tarde" / "las 8 de la noche" | 15:00 / 20:00 |
| "8 pm", "8 p. m.", "9 am" | 20:00 / 09:00 |
| "las diez y media" | 10:30 |
| "las diez y cuarto" | 10:15 |
| "las diez y veinte", "las diez y 20" | 10:20 |
| "las diez menos cuarto", "un cuarto para las diez" | 09:45 |
| "las diez menos diez" | 09:50 |
| "las diez en punto" | 10:00 |
| "doce del mediodía", "mediodía" | 12:00 |
| "medianoche" | 00:00 |
| "las 14:30", "las diez treinta" | 14:30 / 10:30 |
| "de 2 a 4 de la tarde" | 14:00 a 16:00 (la franja aplica a ambas horas) |
| "de diez a doce del mediodía" | 10:00 a 12:00 |

Sin franja y con hora de 1 a 12, el asistente pregunta la franja (excepto si el formato es de 24 horas o el rango se deduce).

### 3.5 Reconocimiento de voz

El reconocimiento se abstrae en una interfaz SpeechProvider para cambiar de proveedor sin tocar las reglas.

- **Web Speech API** (proveedor por defecto): sin configuración, funciona bien en Chrome y Edge. En Chrome el audio se procesa en un servicio externo; es aceptable para pruebas preliminares.
- **Whisper gratuito**: transcripción con el modelo multilingüe Whisper (tiny o base) ejecutado en el navegador con Transformers.js, o con un servidor local de código abierto (whisper.cpp o faster-whisper). No es en tiempo real: se graba mientras se pulsa el botón y se transcribe al soltar. La API de pago de OpenAI queda fuera de esta etapa.
- Modo de prueba de texto: un campo para escribir comandos sin micrófono, solo en desarrollo.

### 3.6 Supuestos por validar

- "Hoy", "ahora" y "en este momento" se interpretan como LIVE.
- "Música" va a Entretenimiento por defecto; "música cultural" o "folclórica" va a Cultura y arte.
- Si hoy es viernes y dicen "el viernes", se toma el de la próxima semana.
- Hay que entregar la lista de las 79 ubicaciones (y sus alias, por ejemplo "la Biblioteca", "el Coliseo") para el catálogo estático.
- Se debe confirmar si la pestaña Mis eventos tiene filtro de estado.

## 4. Hoja de ruta de prompts

| Prompt | Objetivo | HU de referencia |
| --- | --- | --- |
| P1 | Voz básica, contexto de página y navegación a las tres pestañas | VOZ-01, VOZ-02, VOZ-03, NAV-01 a NAV-05, CTX-01 |
| P2 | Proveedor Whisper gratuito e intercambiable | VOZ-04, VOZ-05 |
| P3 | Filtros del Feed por categoría y estado, y limpieza de filtros | FIL-01 a FIL-06, CTX-02, CTX-03 |
| P4 | Inicio de creación y campos de texto del formulario | CRE-01 a CRE-08, CTX-04 |
| P5 | Fechas, horas y sesiones múltiples | FEC-01 a FEC-06 |
| P6 | Corrección y omisión de campos | COR-01 a COR-03 |
| P7 | Validación, resumen, confirmación y envío | VAL-01 a VAL-04 |
| P8 | Robustecimiento, calidad y ampliación de alias | QA-01 a QA-03 |

## 5. Historias de usuario por categoría

### 5.1 Voz y reconocimiento (VOZ)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| VOZ-01 | Como persona usuaria, quiero activar y detener la escucha con un botón, para controlar cuándo me escucha la aplicación. | El botón muestra los estados inactivo, escuchando y procesando. Solo se escucha mientras está activo. El idioma es es-CO. |
| VOZ-02 | Como persona usuaria, quiero ver lo que el asistente entendió, para saber si me escuchó bien. | Se muestra la transcripción (provisional y final) y una respuesta breve de la acción realizada. Los mensajes se anuncian con aria-live. |
| VOZ-03 | Como persona usuaria, quiero mensajes claros cuando la voz falla, para seguir usando la aplicación. | Se tratan los errores de permiso denegado, sin voz detectada, red y navegador no compatible. La aplicación sigue funcionando sin voz. |
| VOZ-04 | Como equipo de desarrollo, quiero cambiar de proveedor de voz sin modificar las reglas, para comparar alternativas. | Existe una interfaz SpeechProvider con al menos dos implementaciones. El resto del asistente no depende del proveedor. |
| VOZ-05 | Como equipo de desarrollo, quiero transcribir con Whisper de forma gratuita, para probar con mayor precisión. | Se graba con pulsar para hablar y se transcribe en español. No requiere clave de pago. Muestra un indicador mientras procesa. |

### 5.2 Navegación (NAV)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| NAV-01 | Como persona usuaria, quiero abrir el Mapa por voz, para ver dónde están los eventos. | "Abre el mapa", "Vamos al mapa", "Abre la pestaña de ubicación", "Quiero ver dónde están los eventos" abren el Mapa. |
| NAV-02 | Como persona usuaria, quiero abrir el Feed por voz, para explorar las actividades. | "Abre el Feed", "Enséñame las publicaciones", "Llévame a la lista de eventos", "Quiero ver qué actividades hay" abren el Feed. |
| NAV-03 | Como persona usuaria, quiero abrir Mis eventos por voz, para revisar lo que he publicado. | "Abre Mis eventos", "¿Qué eventos he creado?", "Muéstrame lo que he publicado", "Quiero ver mi historial" abren Mis eventos. Las frases con "mis", "mi" o "he creado" tienen prioridad sobre el Feed. |
| NAV-04 | Como persona usuaria, quiero una respuesta útil cuando no me entienden, para saber qué decir. | Una frase no reconocida produce UNKNOWN, no ejecuta ninguna acción y sugiere ejemplos de comandos. |
| NAV-05 | Como equipo de producto, quiero ampliar los alias sin tocar la lógica, para mejorar la cobertura con pruebas de usuarios. | Los alias viven en archivos de datos. Añadir una frase no requiere cambiar el código de las reglas. |

### 5.3 Contexto (CTX)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| CTX-01 | Como asistente, quiero conocer la página actual, para interpretar bien cada frase. | El intérprete recibe currentPage en cada comando. Si la persona ya está en la página pedida, se le informa y no se navega. |
| CTX-02 | Como persona usuaria, quiero que "muéstrame todos los eventos" haga lo correcto según dónde esté. | En el Feed limpia los filtros; fuera del Feed abre el Feed. |
| CTX-03 | Como persona usuaria, quiero que "mis eventos activos" dependa de mi ubicación. | Fuera de Mis eventos navega a Mis eventos. En Mis eventos aplica el estado LIVE o informa que no hay filtro. |
| CTX-04 | Como persona usuaria, quiero que lo que dicto en el formulario no se confunda con comandos. | En Crear evento el texto libre nunca dispara navegación. Un evento llamado "Feria del mapa" no abre el Mapa. |

### 5.4 Filtros del Feed (FIL)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| FIL-01 | Como persona usuaria, quiero filtrar por categoría usando temas, para encontrar lo que me interesa. | "Talleres de programación", "ventas de comida", "torneos de baloncesto", "actividades recreativas" aplican la categoría macro correcta. |
| FIL-02 | Como persona usuaria, quiero filtrar por estado, para ver lo que ocurre ahora o pronto. | "En vivo" aplica LIVE y "próximos" aplica UPCOMING. |
| FIL-03 | Como persona usuaria, quiero combinar categoría y estado en una frase. | "Muéstrame los talleres que están en vivo" produce FILTER\_EVENTS con Talleres y LIVE. |
| FIL-04 | Como persona usuaria, quiero que "mañana" y "esta semana" se tomen como próximos. | "¿Qué ventas habrá mañana?" y "¿Qué eventos deportivos habrá esta semana?" aplican la categoría y UPCOMING. |
| FIL-05 | Como persona usuaria, quiero quitar los filtros, para ver todo de nuevo. | "Quita los filtros", "Restablece los filtros", "Deja el Feed sin filtros" ejecutan CLEAR\_FILTERS. |
| FIL-06 | Como persona usuaria, quiero que me aclaren cuando una frase sea ambigua. | Si dos categorías empatan, el asistente pregunta y no aplica ningún filtro hasta recibir respuesta. |

### 5.5 Creación de eventos (CRE)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| CRE-01 | Como organizador, quiero iniciar la creación por voz. | "Quiero crear un evento" abre el formulario y pregunta el nombre. Nunca abre el Feed. |
| CRE-02 | Como organizador, quiero dictar nombre, descripción y responsable. | "El evento se llamará…", "La descripción será…" y "El responsable será…" guardan el valor en el borrador y en el formulario. |
| CRE-03 | Como organizador, quiero asignar la categoría hablando. | "Será de cultura y arte" o "Pertenece a talleres" asignan una de las 6 categorías. |
| CRE-04 | Como organizador, quiero elegir la ubicación hablando. | "Se realizará en la Biblioteca" se empareja con el catálogo de 79 lugares. Si hay varios candidatos, pregunta cuál. Si no hay coincidencia, no inventa. |
| CRE-05 | Como organizador, quiero dictar los campos opcionales. | Detalle de ubicación, cupo (en cifras o palabras), enlace y contacto se guardan al mencionarlos. |
| CRE-06 | Como organizador, quiero que solo me pregunten lo que falta. | Orden de preguntas: nombre, categoría, descripción, responsable, ubicación y fechas. Los opcionales no se preguntan. Si digo varios datos en una frase, se guardan todos. |
| CRE-07 | Como organizador, quiero cargar la imagen con teclado y ratón. | No hay intents de voz para la imagen. Si la menciono, el asistente indica que se carga manualmente. |
| CRE-08 | Como organizador, quiero conservar el borrador entre turnos. | El borrador persiste durante la conversación hasta enviar o cancelar. |

### 5.6 Fechas y horas (FEC)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| FEC-01 | Como organizador, quiero agregar una fecha con hora de inicio y fin. | Se guardan día, inicio y fin como una sesión del borrador. |
| FEC-02 | Como organizador, quiero usar las formas habladas del español para las horas. | Se cumple la tabla de la sección 3.4: "y media", "y cuarto", "y 20", "menos cuarto", "de la mañana", "de la tarde", "am", "pm", "mediodía", "medianoche". |
| FEC-03 | Como organizador, quiero decir días de la semana y fechas relativas. | "El viernes", "el próximo lunes", "mañana", "pasado mañana", "20 de noviembre" se convierten en fechas válidas. |
| FEC-04 | Como organizador, quiero registrar varias sesiones. | "Agrega otra fecha" y "La próxima sesión será el 25 de noviembre" crean sesiones adicionales. |
| FEC-05 | Como organizador, quiero quitar una sesión. | "Quita la segunda fecha" elimina la sesión indicada, sin afectar las demás. |
| FEC-06 | Como organizador, quiero que me pregunten cuando la hora sea ambigua. | "A las diez" sin franja genera una pregunta de mañana o noche. |

### 5.7 Corrección y omisión (COR)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| COR-01 | Como organizador, quiero corregir un campo ya dicho. | "Cambia el nombre a…" o "Corrige el responsable, es…" ejecutan CORRECT\_EVENT\_FIELD y actualizan borrador y formulario. |
| COR-02 | Como organizador, quiero omitir un campo opcional. | "Omitir", "sin cupo", "no tiene enlace" ejecutan SKIP\_FIELD y el asistente pasa al siguiente campo. No se pueden omitir campos obligatorios. |
| COR-03 | Como organizador, quiero corregir la fecha o la hora de una sesión. | "Cambia la hora de inicio de la segunda fecha a las 3 de la tarde" modifica solo esa sesión. |

### 5.8 Validación y envío (VAL)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| VAL-01 | Como organizador, quiero que se validen las reglas del formulario. | Se exige al menos una sesión, fin posterior al inicio, sesiones sin solapamiento, ubicación del catálogo y categoría válida. Los errores se dicen y se muestran. |
| VAL-02 | Como organizador, quiero un resumen antes de enviar. | Se lee y se muestra un resumen de los campos diligenciados. |
| VAL-03 | Como organizador, quiero confirmar explícitamente la publicación. | El evento no se envía sin un "sí, publícalo" o equivalente (CONFIRM\_ACTION). |
| VAL-04 | Como organizador, quiero cancelar sin perder datos por accidente. | CANCEL\_ACTION pide confirmar el descarte del borrador. |

### 5.9 Calidad (QA)

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| QA-01 | Como equipo de desarrollo, quiero pruebas automatizadas por tabla. | Todas las frases del diseño están en pruebas, más al menos 5 variantes nuevas por intent. Hay pruebas de conflicto y del parser de fechas con reloj fijo. |
| QA-02 | Como equipo de producto, quiero registrar las frases no reconocidas, para ampliar alias. | En modo prueba, las frases UNKNOWN se guardan localmente y se pueden exportar. |
| QA-03 | Como persona con discapacidad, quiero que el asistente sea accesible. | El botón es operable con teclado, tiene etiquetas y los mensajes son anunciados por lectores de pantalla. |
