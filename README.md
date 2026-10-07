# CampusConecta

Plataforma web de eventos del campus de la Universidad del Valle.

- `backend/`: API REST (Django + Django REST Framework, PostgreSQL). Contrato de la API: `backend/openapi.yaml`.
- `frontend/`: aplicación web.
- `docs/`: definición del MVP, release plan y pendientes.

## Backend en local

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # rellena los valores
createdb campusconecta
set -a; source .env; set +a
.venv/bin/python manage.py migrate
.venv/bin/python manage.py test
```
