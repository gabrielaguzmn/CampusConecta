# CampusConecta

Plataforma web responsive para visualizar, filtrar, ubicar y publicar eventos extracurriculares dentro del campus de la Universidad del Valle.

El repositorio tiene dos aplicaciones independientes que se comunican por HTTP:

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `backend/` | API REST: datos, reglas de negocio, permisos y correos | Python 3.12, Django, Django REST Framework, PostgreSQL |
| `frontend/` | Aplicación web que usan las personas | React, TypeScript, Vite, Tailwind CSS |

El **contrato** entre ambas es `backend/openapi.yaml`. Lo genera el backend y el frontend lo usa para generar sus tipos.

---

## 1. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Python | 3.12 | Backend |
| PostgreSQL | 16 (o superior) | Base de datos |
| Node.js | 20.19 o superior (el proyecto usa 25, ver `frontend/.nvmrc`) | Frontend |
| Git | cualquiera reciente | Clonar el repositorio |

---

## 2. Primera vez en Linux: instalar y configurar

Esta sección se hace **una sola vez** por computador. Después, para usar la app, ve directamente a la [sección 4](#4-correr-la-app-cada-vez).

### 2.1 Base de datos

Instala PostgreSQL, da permiso a tu usuario de Linux para crear bases (las pruebas del backend crean una base temporal) y crea la base local:

```bash
sudo apt install postgresql                     # Debian/Ubuntu; en otras distribuciones usa su gestor de paquetes
sudo -u postgres createuser --createdb "$USER"  # tu usuario de Linux como usuario de PostgreSQL
createdb campusconecta
```

Así Django se conecta por el socket local con tu usuario de Linux y no hace falta contraseña. Si además quieres usar la base compartida del equipo, ver la [sección 5](#5-base-de-datos-compartida-del-equipo-render).

### 2.2 Backend

```bash
cd backend
python3 -m venv .venv                           # entorno virtual de Python
.venv/bin/pip install -r requirements.txt       # dependencias
cp .env.example .env                            # tu archivo de configuración (no se sube a git)
```

**Clave secreta.** Django necesita una clave aleatoria propia para firmar las sesiones y los enlaces de recuperación. Se genera **una sola vez**:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Copia el resultado en `backend/.env`: `DJANGO_SECRET_KEY=<lo que salió>`. No se comparte ni se sube a git. Solo habría que generar otra si pierdes el `.env` o si la clave se filtra.

**Resto del `.env`:**

- `DB_NAME=campusconecta` y deja vacíos `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` y `DB_SSLMODE` (conexión local por socket, ver 2.1). Para la base compartida del equipo, ver la [sección 5](#5-base-de-datos-compartida-del-equipo-render).
- `FRONTEND_URL_RECUPERACION=http://localhost:5173/recuperar/confirmar`, para que funcione el enlace de "¿Olvidaste tu contraseña?".

Crea las tablas:

```bash
set -a; source .env; set +a                     # carga el .env en la terminal (ver nota abajo)
.venv/bin/python manage.py migrate              # crea las tablas y las 6 categorías iniciales
```

> `set -a; source .env; set +a` carga las variables del `.env` en la terminal, porque Django no lee el archivo por sí mismo. Hay que repetirlo **en cada terminal nueva** antes de usar `manage.py`.

### 2.3 Frontend

```bash
cd frontend
nvm use                                         # si usas nvm: cambia a la versión de Node de .nvmrc
npm install                                     # dependencias
```

### 2.4 Datos iniciales

En `backend/`, con el `.env` cargado:

| Paso | ¿Obligatorio? | Para qué |
|---|---|---|
| Ubicaciones | **Necesario para crear eventos y ver el mapa** | La app arranca sin ellas, pero "Crear evento" no tendrá ubicaciones para elegir y el mapa no mostrará pines |
| Cuenta administradora | **Opcional** | Solo si vas a probar el módulo de administración |

**Ubicaciones.** Carga el catálogo de ubicaciones del campus (79 lugares: edificios, plazoletas y lagos, con su zona y el código que los enlaza con el plano del mapa):

```bash
.venv/bin/python manage.py seed_ubicaciones
```

Se puede repetir sin crear duplicados: actualiza las ubicaciones que ya existan. Vuelve a ejecutarlo si llega al repositorio un cambio en `eventos/management/commands/seed_ubicaciones.py`.

**Cuenta administradora (opcional).** Rellena en `backend/.env` los datos que quieras (solo valen para tu base local), vuelve a cargar el `.env` y créala:

```
ADMIN_INICIAL_NOMBRE=Tu nombre
ADMIN_INICIAL_EMAIL=admin@ejemplo.com
ADMIN_INICIAL_PASSWORD=una-clave-de-al-menos-8-caracteres
```

```bash
.venv/bin/python manage.py crear_admin_inicial
```

Listo: ya puedes [correr la app](#4-correr-la-app-cada-vez).

---

## 3. Primera vez en Windows (PowerShell): instalar y configurar

Esta sección se hace **una sola vez** por computador. Después, para usar la app, ve directamente a la [sección 4](#4-correr-la-app-cada-vez).

### 3.1 Base de datos

1. Instala PostgreSQL desde <https://www.postgresql.org/download/windows/>. Anota la contraseña del usuario `postgres`.
2. Crea la base de datos. Si `psql` no está en el PATH, usa el "SQL Shell (psql)" que trae el instalador:

```powershell
psql -U postgres -c "CREATE DATABASE campusconecta;"
```

### 3.2 Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1          # si da error de permisos: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
Copy-Item .env.example .env
```

**Clave secreta** (una sola vez; ver la explicación en 2.2):

```powershell
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Cópiala en `backend\.env`: `DJANGO_SECRET_KEY=<lo que salió>`.

**Resto del `.env`:** `DB_NAME=campusconecta`, `DB_USER=postgres`, `DB_PASSWORD=<la contraseña de postgres>`, `DB_HOST=localhost`, `DB_PORT=5432` y `FRONTEND_URL_RECUPERACION=http://localhost:5173/recuperar/confirmar`.

PowerShell no tiene `source`. Esta línea carga el `.env` en la terminal actual; hay que repetirla **en cada terminal nueva**:

```powershell
Get-Content .env | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object { $n, $v = $_ -split '=', 2; Set-Item "env:$($n.Trim())" $v.Trim() }
```

Crea las tablas:

```powershell
python manage.py migrate
```

### 3.3 Frontend

```powershell
cd frontend
npm install
```

### 3.4 Datos iniciales

Igual que en [2.4](#24-datos-iniciales), con `python` en lugar de `.venv/bin/python`:

```powershell
python manage.py seed_ubicaciones
python manage.py crear_admin_inicial   # opcional, con ADMIN_INICIAL_* rellenos en el .env
```

Listo: ya puedes [correr la app](#4-correr-la-app-cada-vez).

---

## 4. Correr la app (cada vez)

> **¿Es la primera vez en este computador?** Antes haz la [sección 2](#2-primera-vez-en-linux-instalar-y-configurar) (Linux) o la [sección 3](#3-primera-vez-en-windows-powershell-instalar-y-configurar) (Windows). Solo se hace una vez.

Arranca las dos partes, cada una en su terminal, y abre <http://localhost:5173>.

**Linux**

```bash
# Terminal 1: backend (API en http://localhost:8000/api/)
cd backend
set -a; source .env; set +a
.venv/bin/python manage.py runserver

# Terminal 2: frontend
cd frontend
npm run dev
```

**Windows (PowerShell)**

```powershell
# Terminal 1: backend
cd backend
.\.venv\Scripts\Activate.ps1
Get-Content .env | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object { $n, $v = $_ -split '=', 2; Set-Item "env:$($n.Trim())" $v.Trim() }
python manage.py runserver

# Terminal 2: frontend
cd frontend
npm run dev
```

Para detenerlas, pulsa `Ctrl+C` en cada terminal.

En desarrollo, Vite reenvía `/api` y `/media` al backend en `localhost:8000` (ver `frontend/vite.config.ts`). Por eso no hace falta configurar CORS.

**Después de un `git pull`**, si llegaron cambios:
- **Migraciones nuevas** (archivos en `*/migrations/`): `manage.py migrate`.
- **Cambios en el catálogo de ubicaciones** (`seed_ubicaciones.py`): `manage.py seed_ubicaciones`.
- **Cambios en `requirements.txt` o `package.json`:** `pip install -r requirements.txt` o `npm install`.

### Qué probar

| Qué | Cómo |
|---|---|
| Usuario normal | En **Registro** crea una cuenta con cualquier correo. No hay que confirmarlo |
| Publicar un evento | **Mis Eventos → Crear evento**: elige categoría y ubicación y añade una o varias fechas futuras |
| Feed, mapa y detalle | El evento aparece en **Feed** y **Mapa**; al abrirlo ves el detalle y puedes **reportarlo** |
| Gestionar fechas | En **Mis Eventos**, el menú de cada evento permite editar, cancelar, finalizar, extender o eliminar |
| Administración (si creaste la cuenta administradora) | Entra con esa cuenta: aparece el módulo **Admin** (reportes, eventos, usuarios, categorías y registro de moderación) |
| Recuperar contraseña | En **Login → ¿Olvidaste tu contraseña?**. El correo **no se envía**: aparece impreso en la terminal del backend con el enlace; ábrelo en el navegador |

Todos los correos (recuperación, ocultamiento de un evento, suspensión de una cuenta) aparecen en la terminal del backend mientras `DJANGO_DEBUG=1` y `EMAIL_BACKEND` esté vacío.

### Enviar correos reales (opcional)

Para que los correos lleguen de verdad, rellena en `backend/.env` los datos de un proveedor SMTP (por ejemplo Brevo, SendGrid, Mailgun o Gmail con una contraseña de aplicación) y vuelve a cargar el `.env`:

```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.proveedor.com
EMAIL_PORT=587
EMAIL_HOST_USER=usuario
EMAIL_HOST_PASSWORD=contraseña-o-clave-de-aplicación
EMAIL_USE_TLS=1
DEFAULT_FROM_EMAIL=CampusConecta <correo-remitente@dominio.com>
```

Estas credenciales tampoco se suben al repositorio.

---

## 5. Base de datos compartida del equipo (Render)

Cada persona puede trabajar con su base local (secciones 2 y 3). Además, el equipo tiene **una base PostgreSQL común en [Render](https://render.com)**, para que todos vean los mismos datos (por ejemplo, para probar el frontend contra los mismos eventos o para una demo). La administra una sola persona del equipo.

`migrate` crea en todas las bases las mismas tablas y las 6 categorías con sus colores, y `seed_ubicaciones` el mismo catálogo de ubicaciones. Los usuarios y los eventos son propios de cada base.

### 5.1 Crear la base en Render (solo quien la administra)

1. En el panel de Render: **New → Postgres**. Ponle un nombre, elige la región y el plan, y créala.
2. En la página de la base, en **Connections**, copia la **External Database URL**. Tiene esta forma:

   ```
   postgresql://USUARIO:CONTRASEÑA@dpg-XXXXXXXX-a.REGION-postgres.render.com/NOMBRE_BASE
   ```

3. Pásala por partes a un `backend/.env.compartida` (ver 5.2). El puerto es el 5432 y la conexión exige SSL:

   ```
   DB_NAME=NOMBRE_BASE
   DB_USER=USUARIO
   DB_PASSWORD=CONTRASEÑA
   DB_HOST=dpg-XXXXXXXX-a.REGION-postgres.render.com
   DB_PORT=5432
   DB_SSLMODE=require
   ```

4. Con esas variables cargadas, crea las tablas, el catálogo de ubicaciones y la cuenta administradora:

   ```bash
   .venv/bin/python manage.py migrate
   .venv/bin/python manage.py seed_ubicaciones
   .venv/bin/python manage.py crear_admin_inicial
   ```

5. Comparte los datos de conexión con el equipo **por un canal privado**.

### 5.2 Conectarse (el resto del equipo)

Guarda los datos que te pasaron en `backend/.env.compartida`: una copia de tu `.env` con las variables `DB_*` del paso 3. Carga ese archivo en lugar del `.env` y ejecuta `runserver` como siempre. **No ejecutes `migrate` ni `seed_ubicaciones` contra la base compartida**: lo hace solo quien la administra.

Así alternas entre tu base local (`.env`) y la de Render (`.env.compartida`) cargando el archivo que necesites:

```bash
set -a; source .env.compartida; set +a      # Linux
```
```powershell
Get-Content .env.compartida | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object { $n, $v = $_ -split '=', 2; Set-Item "env:$($n.Trim())" $v.Trim() }   # Windows
```

Las variables se quedan cargadas en la terminal. Al cambiar de archivo, abre una terminal nueva para que no se mezclen.

### 5.3 Reglas de uso

- **Las credenciales nunca van al repositorio.** El `.gitignore` excluye `.env` y `.env.*` (salvo `.env.example`). Si se filtran, cambia la contraseña desde el panel de Render y avisa al equipo.
- **Solo quien administra la base ejecuta `migrate` y `seed_ubicaciones`**, cada vez que llegue al repositorio una migración nueva o un cambio en el catálogo. Si dos personas migran a la vez con código distinto, la base puede quedar inconsistente.
- **Las pruebas (`manage.py test`) se ejecutan siempre contra la base local**, en una terminal con el `.env` local cargado: crean y borran una base temporal, y en el servidor compartido chocarían entre sí.
- **Las imágenes de los eventos no se comparten.** Se guardan en el disco de quien crea el evento (`backend/media/`), no en la base de datos. Con la base compartida, los demás verán esos eventos sin imagen.
- **El plan gratuito de Render tiene límites** de espacio y de duración. Quien administra la base revisa en el panel cuándo vence y avisa al equipo con tiempo.

---

## 6. Comandos útiles

| Qué | Linux | Windows (con el entorno activado y el `.env` cargado) |
|---|---|---|
| Pruebas del backend | `.venv/bin/python manage.py test` | `python manage.py test` |
| Regenerar el contrato de la API (al cambiar un endpoint) | `.venv/bin/python manage.py spectacular --file openapi.yaml --validate` | `python manage.py spectacular --file openapi.yaml --validate` |
| Pruebas del frontend | `npm test` | `npm test` |
| Chequeo de tipos del frontend | `npm run typecheck` | `npm run typecheck` |
| Regenerar los tipos de la API en el frontend (tras cambiar `openapi.yaml`) | `npm run api:types` | `npm run api:types` |
| Compilar el frontend para producción | `npm run build` | `npm run build` |

Los comandos del backend se ejecutan dentro de `backend/` y los del frontend dentro de `frontend/`.

Con `DJANGO_DEBUG=1`, los correos (por ejemplo, el de recuperación de contraseña) no se envían: se imprimen en la terminal del backend.

---

## 7. Qué hay en cada carpeta

```
CampusConecta/
├── README.md                este archivo
├── .gitignore               excluye .env, .venv e imágenes subidas (frontend/.gitignore excluye node_modules y dist)
├── backend/                 API REST (Django)
└── frontend/                aplicación web (React)
```

### 7.1 `backend/`

```
backend/
├── manage.py                punto de entrada de los comandos de Django
├── requirements.txt         dependencias de Python con versión fija
├── .env.example             plantilla de variables de entorno (sin valores reales)
├── openapi.yaml             CONTRATO de la API (generado; no se edita a mano)
├── config/                  configuración del proyecto
│   ├── settings.py          ajustes; todo lo variable sale del .env
│   ├── urls.py              rutas raíz: /api/auth/, /api/…, /api/admin/usuarios/, /api/schema/
│   └── excepciones.py       formato de errores (añade "code" y "codes") y error 409 "Conflicto"
├── cuentas/                 usuarios y acceso
│   ├── models.py            Usuario (correo como identificador, nombre, rol administrador, suspensión)
│   ├── serializers.py       registro, inicio de sesión, recuperación de contraseña
│   ├── views.py             /api/auth/… y gestión de cuentas y roles para el administrador
│   ├── correos.py           correo de recuperación de contraseña
│   ├── permissions.py       permiso EsAdministrador
│   ├── management/commands/crear_admin_inicial.py   cuenta administradora inicial
│   └── tests/               pruebas de acceso, cuenta inicial y modelo
├── eventos/                 categorías, ubicaciones, eventos y fechas
│   ├── models.py            Categoria, Ubicacion, Evento, Fecha; estado calculado de cada fecha y vigencia
│   ├── serializers.py       validaciones de creación y edición (horarios, solapamientos, imagen…)
│   ├── views.py             feed, mapa, detalle, crear/editar, acciones sobre fechas, "Mis eventos"
│   ├── management/commands/seed_ubicaciones.py   catálogo de 79 ubicaciones del campus
│   ├── migrations/          0002: las 6 categorías iniciales · 0004: sus colores
│   └── tests/               pruebas de publicación, exploración (feed, mapa, detalle) y categorías
└── moderacion/              reportes y administración
    ├── normas.py            las 10 normas de uso (causa de reporte y motivo de moderación)
    ├── models.py            CasoReporte, Reporte, RegistroModeracion (de solo lectura)
    ├── servicios.py         ocultar, restaurar, suspender, reactivar (cambio + registro + correo)
    ├── correos.py           correos de ocultamiento y suspensión
    ├── views.py             reportar, casos, moderación de contenido, suspensión, registro
    └── tests/               pruebas de reportes, casos, moderación, suspensión y registro
```

Cada app sigue el mismo patrón: `models.py` (datos), `serializers.py` (validación y formato JSON), `views.py` (endpoints), `urls.py` (rutas) y `tests/`.

### 7.2 `frontend/`

```
frontend/
├── package.json             dependencias y scripts (dev, build, test, typecheck, api:types)
├── vite.config.ts           configuración de Vite, proxy a la API y Vitest
├── index.html               página base
├── public/                  archivos estáticos (foto del panel de acceso)
└── src/
    ├── main.tsx             arranque de la app
    ├── router.tsx           rutas y protección por sesión
    ├── Layout.tsx           estructura común de las páginas
    ├── index.css            Tailwind y tokens de diseño (colores, radios, sombras)
    ├── api/                 cliente HTTP y tipos
    │   ├── schema.d.ts      tipos GENERADOS desde backend/openapi.yaml (npm run api:types)
    │   ├── client.ts        cliente con token y renovación automática de sesión
    │   └── queries.ts       consultas y mutaciones (TanStack Query)
    ├── auth/                sesión: tokens, usuario actual y guardas de rutas
    ├── components/          componentes reutilizables del diseño (botón, chip, badge, tarjeta, modal…)
    ├── pages/               pantallas
    │   ├── acceso/          login, registro, recuperar contraseña y nueva contraseña
    │   ├── feed/            feed de eventos con filtros
    │   ├── mapa/            mapa del campus
    │   ├── evento/          detalle de un evento y formulario de reporte
    │   ├── mis-eventos/     "Mis eventos" (activos e historial), crear y gestionar eventos
    │   └── admin/           módulo de administración: reportes, eventos, usuarios, categorías y registro
    ├── lib/                 utilidades: formato de fechas y horas en America/Bogota, zonas y edificios del plano (Campusdata.ts) y posición de cada edificio (Usemascarascampus.ts)
    └── test/                configuración de las pruebas
```

Las pruebas del frontend están junto a cada archivo (`Componente.test.tsx`).

---

## 8. ¿Dónde busco…?

| Necesito… | Está en… |
|---|---|
| Qué endpoints hay y qué reciben o devuelven | `backend/openapi.yaml` (o `GET /api/schema/` con el backend corriendo) |
| Cómo se calcula si una fecha está próxima, en vivo, finalizada o cancelada | `backend/eventos/models.py` → `Fecha.estado()` y `FechaQuerySet.con_estado()` |
| Qué eventos salen en el feed, el mapa y el detalle | `backend/eventos/models.py` → `EventoQuerySet.visibles()` |
| Qué ve el creador en "Mis eventos" (vigentes e historial) | `backend/eventos/models.py` → `vigentes()`, `historial()`; vista `MisEventosView` |
| Validaciones al crear o editar un evento (horarios, solapamientos, imagen) | `backend/eventos/serializers.py` |
| Quién puede hacer cada acción (403) y en qué estado (409) | `backend/eventos/views.py` (`evento_propio`, `exigir_estado`) y `backend/cuentas/permissions.py` |
| Formato de los errores y sus códigos | `backend/config/excepciones.py` (los errores llevan `code`, o `codes` por campo en los 400) |
| Moderación, reportes y suspensión | `backend/moderacion/` (`servicios.py` para la lógica, `views.py` para los endpoints) |
| Texto de los correos | `backend/cuentas/correos.py` (recuperación) y `backend/moderacion/correos.py` (moderación) |
| Categorías iniciales y sus colores | `backend/eventos/migrations/0002_…` y `0004_…` |
| Catálogo de ubicaciones del campus | `backend/eventos/management/commands/seed_ubicaciones.py` (debe coincidir con `frontend/src/lib/Campusdata.ts`) |
| Variables de configuración | `backend/.env.example` y `backend/config/settings.py` |
| Llamadas a la API desde el frontend | `frontend/src/api/` |
| Componentes visuales y tokens de diseño | `frontend/src/components/` y `frontend/src/index.css` |
| Una pantalla concreta | `frontend/src/pages/<sección>/` y sus rutas en `frontend/src/router.tsx` |
