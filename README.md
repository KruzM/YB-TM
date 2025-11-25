# Yecny Bookkeeping Task Manager

This repository hosts the in-progress build of the Yecny Bookkeeping operations platform. The initial scaffold uses FastAPI with SQLite for local development and exposes CRUD endpoints for users, clients, contacts, accounts, tasks, recurring tasks, and documents.

## Getting started

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Run the API locally:

```bash
uvicorn app.main:app --reload
```

3. Visit `http://localhost:8000/docs` for the interactive OpenAPI UI. Create a user first, then use `/auth/token` to obtain a bearer token for authenticated routes.

## Notes

- The default database is `data.db` in the project root. Adjust `sqlalchemy_database_uri` or other settings via environment variables in an `.env` file.
- Models align with the platform specification in `SYSTEM_SPEC.md` and are ready for future migrations via Alembic.
