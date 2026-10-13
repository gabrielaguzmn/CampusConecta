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

**Cuenta administradora.** Rellena en `backend/.env` los datos que quieras (solo valen para tu base local), vuelve a cargar el `.env` y créala:

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



---

## 5. Base compartida

Si el equipo usa una base común, guarda los valores de conexión en `backend/.env.compartida` y cárgalo en lugar del `.env` antes de levantar el backend.

> **Importante:** no ejecutes `migrate` ni `seed_ubicaciones` contra la base compartida; eso lo hace quien la administra.

```bash
set -a; source .env.compartida; set +a      # Linux
```

```powershell
Get-Content .env.compartida | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object { $n, $v = $_ -split '=', 2; Set-Item "env:$($n.Trim())" $v.Trim() }   # Windows
```

Mantén `.env` y `.env.*` fuera del repositorio y usa siempre tu base local para pruebas.

---

## 6. Comandos útiles

| Qué | Linux | Windows |
|---|---|---|
| Pruebas del backend | `.venv/bin/python manage.py test` | `python manage.py test` |
| Regenerar el contrato de la API | `.venv/bin/python manage.py spectacular --file openapi.yaml --validate` | `python manage.py spectacular --file openapi.yaml --validate` |
| Pruebas del frontend | `npm test` | `npm test` |
| Chequeo de tipos del frontend | `npm run typecheck` | `npm run typecheck` |
| Regenerar tipos del frontend | `npm run api:types` | `npm run api:types` |
| Compilar el frontend para producción | `npm run build` | `npm run build` |

Los comandos del backend se ejecutan dentro de `backend/` y los del frontend dentro de `frontend/`.

Con `DJANGO_DEBUG=1`, los correos no se envían: se imprimen en la terminal del backend.

---

## 7. Estructura mínima del repositorio

```text
CampusConecta/
├── README.md
├── .gitignore
├── backend/
│   ├── config/
│   ├── cuentas/
│   ├── eventos/
│   ├── moderacion/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   └── openapi.yaml
└── frontend/
    ├── src/
    ├── package.json
    ├── vite.config.ts
    └── public/
```

- `backend/config/`: configuración general del proyecto.
- `backend/cuentas/`: autenticación, usuarios y recuperación de contraseña.
- `backend/eventos/`: eventos, ubicaciones, categorías y lógica de fechas.
- `backend/moderacion/`: reportes, moderación y suspensión.
- `frontend/src/`: aplicación principal, rutas y componentes.
- `frontend/src/lib/`: utilidades y catálogo del campus.
