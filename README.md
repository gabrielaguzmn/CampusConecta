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

## 2. Cómo correr la aplicación en Linux

### 2.1 Base de datos

Crea la base de datos `campusconecta`. Elige una de estas dos opciones:

```bash
# Opción A: tu usuario de Linux ya tiene rol en PostgreSQL (autenticación por socket)
createdb campusconecta

# Opción B: crear un usuario con contraseña
sudo -u postgres psql -c "CREATE USER campus WITH PASSWORD 'cambia-esta-clave' CREATEDB;"
sudo -u postgres createdb -O campus campusconecta
```

El permiso `CREATEDB` hace falta para ejecutar las pruebas, porque Django crea una base de datos temporal `test_campusconecta`.

### 2.2 Backend (terminal 1)

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cp .env.example .env
# Genera una clave secreta y pégala en DJANGO_SECRET_KEY dentro de .env:
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Edita `backend/.env` (para usar la base compartida del equipo, ver la sección 4):

- Deja `DB_NAME=campusconecta`.
- Con la opción A, deja vacíos `DB_USER`, `DB_PASSWORD` y `DB_HOST`.
- Con la opción B, pon `DB_USER=campus`, `DB_PASSWORD=...`, `DB_HOST=localhost` y `DB_PORT=5432`.
- Para crear la cuenta administradora inicial, rellena `ADMIN_INICIAL_NOMBRE`, `ADMIN_INICIAL_EMAIL` y `ADMIN_INICIAL_PASSWORD`.

Después:

```bash
set -a; source .env; set +a                     # carga las variables (en cada terminal nueva)
.venv/bin/python manage.py migrate              # crea las tablas y las 6 categorías iniciales
.venv/bin/python manage.py crear_admin_inicial  # opcional: crea la cuenta administradora
.venv/bin/python manage.py runserver            # API en http://localhost:8000/api/
```

### 2.3 Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev                                     # app en http://localhost:5173
```

En desarrollo, Vite reenvía `/api` y `/media` al backend en `localhost:8000` (ver `frontend/vite.config.ts`). Por eso no hace falta configurar CORS.

---

## 3. Cómo correr la aplicación en Windows (PowerShell)

### 3.1 Base de datos

1. Instala PostgreSQL desde <https://www.postgresql.org/download/windows/>. Anota la contraseña del usuario `postgres`.
2. Crea la base de datos. Si `psql` no está en el PATH, usa el "SQL Shell (psql)" que trae el instalador:

```powershell
psql -U postgres -c "CREATE DATABASE campusconecta;"
```

### 3.2 Backend (terminal 1)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1          # si da error de permisos: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt

Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(50))"   # pega el resultado en DJANGO_SECRET_KEY
```

Edita `backend\.env`:

- `DB_NAME=campusconecta`, `DB_USER=postgres`, `DB_PASSWORD=<la contraseña de postgres>`, `DB_HOST=localhost`, `DB_PORT=5432`.
- Para crear la cuenta administradora, rellena `ADMIN_INICIAL_NOMBRE`, `ADMIN_INICIAL_EMAIL` y `ADMIN_INICIAL_PASSWORD`.

PowerShell no tiene `source`. Esta línea carga el `.env` en la terminal actual; repítela en cada terminal nueva:

```powershell
Get-Content .env | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object { $n, $v = $_ -split '=', 2; Set-Item "env:$($n.Trim())" $v.Trim() }
```

Después:

```powershell
python manage.py migrate
python manage.py crear_admin_inicial   # opcional
python manage.py runserver             # API en http://localhost:8000/api/
```

### 3.3 Frontend (terminal 2)

```powershell
cd frontend
npm install
npm run dev                            # app en http://localhost:5173
```

---

## 4. Base de datos compartida del equipo (Supabase)

Cada persona puede trabajar con su base local (secciones 2 y 3). Además, el equipo tendrá **una base común en Supabase**, para que todos vean los mismos datos (por ejemplo, para probar el frontend contra los mismos eventos o para una demo).

### 4.1 Mientras no exista: cada persona prueba en local

Hasta que alguien cree la base en Supabase, **cada persona trabaja con su propia base local** (secciones 2 y 3). `migrate` deja en todas las bases las mismas tablas y las 6 categorías con sus colores. Lo que no se comparte son los datos de prueba, que cada uno crea en su equipo:

- **Cuenta administradora:** `manage.py crear_admin_inicial`, con los datos `ADMIN_INICIAL_*` de tu `.env`.
- **Usuarios normales:** desde la pantalla de registro del frontend o con `POST /api/auth/registro/`.
- **Ubicaciones:** el catálogo oficial del campus aún no está definido (pendiente G-01), así que la base empieza sin ubicaciones y **no se pueden crear eventos** hasta tener al menos una. Para probar, crea alguna a mano en tu base local (no se guarda en el código):

  ```bash
  .venv/bin/python manage.py shell -c "from eventos.models import Ubicacion; Ubicacion.objects.create(nombre='Edificio de prueba')"
  ```

  En Windows es igual, con `python` en vez de `.venv/bin/python`. Cuando se defina el catálogo, se cargará con una migración y estas ubicaciones de prueba se podrán borrar.
- **Eventos:** se crean desde el frontend o con `POST /api/eventos/`.

### 4.2 Crear la base en Supabase (una sola persona, el "administrador de la base")

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo. Elige la región más cercana (por ejemplo, *South America (São Paulo)*) y **guarda la contraseña de la base**: Supabase solo la muestra al crear el proyecto.
2. **Desactiva la API pública de datos.** Supabase publica las tablas del esquema `public` a través de su propia API REST, y CampusConecta no la usa: todo pasa por el backend de Django. En *Project Settings → Data API*, desactívala o quita `public` de los esquemas expuestos. Si no lo haces, las tablas quedan accesibles fuera del backend.
3. Pulsa **Connect** en la parte superior del proyecto y copia la cadena del **Session pooler**. No uses la "Direct connection", que en el plan gratuito solo funciona con IPv6, ni la "Transaction pooler" (puerto 6543). La cadena tiene esta forma:

   ```
   postgresql://postgres.REFERENCIA:CONTRASEÑA@aws-0-REGION.pooler.supabase.com:5432/postgres
   ```

4. Pásala al `backend/.env` (o a un `.env.compartida`, ver 4.3):

   ```
   DB_NAME=postgres
   DB_USER=postgres.REFERENCIA
   DB_PASSWORD=CONTRASEÑA
   DB_HOST=aws-0-REGION.pooler.supabase.com
   DB_PORT=5432
   DB_SSLMODE=require
   ```

5. Con esas variables cargadas, crea las tablas y la cuenta administradora:

   ```bash
   .venv/bin/python manage.py migrate
   .venv/bin/python manage.py crear_admin_inicial
   ```

6. Comparte `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `DB_HOST` con el equipo **por un canal privado**.

### 4.3 Conectarse (el resto del equipo)

Pon en tu `backend/.env` (o en `.env.compartida`) los datos que te pasaron, con `DB_PORT=5432` y `DB_SSLMODE=require`, carga el `.env` y ejecuta `runserver` como siempre. **No ejecutes `migrate` contra la base compartida**: lo hace solo quien la administra.

Para alternar entre tu base local y la de Supabase, guarda cada configuración en un archivo distinto, por ejemplo `.env` (local) y `.env.compartida` (nube), y carga el que necesites:

```bash
set -a; source .env.compartida; set +a      # Linux
```
```powershell
Get-Content .env.compartida | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object { $n, $v = $_ -split '=', 2; Set-Item "env:$($n.Trim())" $v.Trim() }   # Windows
```

En PowerShell las variables se quedan cargadas en la terminal. Al cambiar de archivo, abre una terminal nueva para que no se mezclen.

### 4.4 Reglas de uso

- **Las credenciales nunca van al repositorio.** El `.gitignore` excluye `.env` y `.env.*` (salvo `.env.example`). Si se filtran, cambia la contraseña en el panel del proveedor y avisa al equipo.
- **Solo quien administra la base ejecuta `migrate`**, cada vez que llegue al repositorio una migración nueva (archivos en `*/migrations/`). Si dos personas migran a la vez con código distinto, la base puede quedar inconsistente.
- **Las pruebas (`manage.py test`) se ejecutan contra la base local**, no contra la compartida: crean y borran una base temporal, y en un servidor compartido chocarían entre sí.
- **El plan gratuito de Supabase tiene límites**: espacio limitado y el proyecto se pausa tras un periodo sin actividad. Si se pausa, quien lo administra lo reactiva desde el panel.

---

## 5. Comandos útiles

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

## 6. Qué hay en cada carpeta

```
CampusConecta/
├── README.md                este archivo
├── .gitignore               excluye .env, .venv e imágenes subidas (frontend/.gitignore excluye node_modules y dist)
├── backend/                 API REST (Django)
├── frontend/                aplicación web (React)
└── docs/                    documentación del proyecto (no se versiona; se comparte aparte)
```

### 6.1 `backend/`

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

### 6.2 `frontend/`

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
    ├── pages/               pantallas: acceso (login, registro, recuperación), feed y mapa
    ├── lib/                 utilidades (formato de fechas y horas en America/Bogota)
    └── test/                configuración de las pruebas
```

Las pruebas del frontend están junto a cada archivo (`Componente.test.tsx`).

### 6.3 `docs/`

| Documento | Contenido |
|---|---|
| `definicion_mvp.md` | Definición del MVP: requisitos funcionales (RF) y no funcionales (RNF), roles, permisos y las 10 normas de uso. **Fuente principal** |
| `release_plan.md` | Release Plan: las 20 historias de usuario (HU) con sus criterios de aceptación |
| `modelo_bd.md` | Propuesta inicial del modelo de base de datos (de una versión anterior del MVP) |
| `CampusConecta.fig` | Diseño de Figma exportado |
| `referencias/` | Capturas PNG de cada pantalla del diseño |
| `pendientes.md` | **Preguntas abiertas y decisiones (G-xx), huecos del contrato (CONTRATO-xx) y notas entre backend y frontend.** Compartido por ambos equipos |
| `backend/00_extraccion.md` | Citas de los documentos por HU y todas las decisiones tomadas |
| `backend/01_arquitectura.md` | Diseño del backend: modelo de datos, endpoints con permisos, decisiones técnicas (T-xx) |
| `backend/trazabilidad.md` | Qué archivos y pruebas cubren cada HU y RF, y su estado (completo, parcial o bloqueado) |
| `frontend/00_extraccion.md`, `01_figma_inventario.md`, `02_arquitectura.md` | Equivalentes del frontend: extracción, inventario del diseño y arquitectura |
| `prompts/` | Instrucciones con las que se generaron el backend y el frontend |

---

## 7. ¿Dónde busco…?

| Necesito… | Está en… |
|---|---|
| Qué endpoints hay y qué reciben o devuelven | `backend/openapi.yaml` (o `GET /api/schema/` con el backend corriendo) |
| Cómo se calcula si una fecha está próxima, en vivo, finalizada o cancelada | `backend/eventos/models.py` → `Fecha.estado()` y `FechaQuerySet.con_estado()` |
| Qué eventos salen en el feed, el mapa y el detalle | `backend/eventos/models.py` → `EventoQuerySet.visibles()` |
| Qué ve el creador en "Mis eventos" (vigentes e historial) | `backend/eventos/models.py` → `vigentes()`, `historial()`; vista `MisEventosView` |
| Validaciones al crear o editar un evento (horarios, solapamientos, imagen) | `backend/eventos/serializers.py` |
| Quién puede hacer cada acción (403) y en qué estado (409) | `backend/eventos/views.py` (`evento_propio`, `exigir_estado`) y `backend/cuentas/permissions.py` |
| Formato de los errores y sus códigos | `backend/config/excepciones.py` y la lista de códigos en `docs/pendientes.md` |
| Moderación, reportes y suspensión | `backend/moderacion/` (`servicios.py` para la lógica, `views.py` para los endpoints) |
| Texto de los correos | `backend/cuentas/correos.py` (recuperación) y `backend/moderacion/correos.py` (moderación) |
| Categorías iniciales y sus colores | `backend/eventos/migrations/0002_…` y `0004_…` |
| Variables de configuración | `backend/.env.example` y `backend/config/settings.py` |
| Llamadas a la API desde el frontend | `frontend/src/api/` |
| Componentes visuales y tokens de diseño | `frontend/src/components/` y `frontend/src/index.css` |
| Por qué algo funciona de cierta manera | `docs/pendientes.md` (G-xx) y `docs/backend/00_extraccion.md` (decisiones) |
| Qué falta por hacer | `docs/pendientes.md` (estado "Abierto") y `docs/backend/trazabilidad.md` |
