# Core API

FastAPI service for the relational side of the engine: users and document
metadata, stored in PostgreSQL through SQLAlchemy. Live document content is not
stored here; the [sync service](../sync-service) keeps that in MongoDB.

## Running

With Docker Compose from the repository root (recommended):

```sh
docker compose up --build core-api
```

This also starts PostgreSQL and waits for its health check. The API listens on
`http://localhost:${CORE_API_PORT}` (8000 in `.env.example`), and interactive docs
are at `/docs`.

Or locally, against a PostgreSQL you run yourself:

```sh
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
set DATABASE_URL=postgresql://admin:your_postgres_password@localhost:5432/collab_engine
uvicorn main:app --reload
```

(On macOS/Linux use `export` instead of `set`.)

## Configuration

| Variable       | Default                                                          | Description                   |
| -------------- | ---------------------------------------------------------------- | ----------------------------- |
| `DATABASE_URL` | `postgresql+psycopg2://admin:secret@postgres:5432/collab_engine` | SQLAlchemy connection string  |

A plain `postgresql://` URL is rewritten to use the `psycopg2` driver. Tables are
created on startup if they don't exist; there are no migrations yet.

## Endpoints

Parameters are passed as query strings, not a JSON body.

### `POST /users/?username=<name>`

Creates a user. Returns `201`:

```json
{ "id": 1, "username": "aryan", "created_at": "2026-02-26T08:44:52" }
```

### `POST /documents/?title=<title>&owner_id=<user id>`

Creates document metadata owned by a user. Returns `200`:

```json
{ "doc_id": 1, "title": "Notes", "status": "Ready for sync" }
```

Missing parameters return `422` with FastAPI's validation details.

## Data model

| Table            | Columns                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `users`          | `id`, `username` (unique), `created_at`                            |
| `documents_meta` | `id`, `title`, `owner_id` → `users.id`, `status`, `created_at`     |

## Files

| File               | Role                                              |
| ------------------ | ------------------------------------------------- |
| `main.py`          | FastAPI app, endpoints and the database session dependency |
| `models.py`        | SQLAlchemy models                                 |
| `database.py`      | Engine and session setup from `DATABASE_URL`      |
| `requirements.txt` | Python dependencies                               |
| `Dockerfile`       | Python 3.13 image running `uvicorn` on port 8000  |

## Current limitations

- **No authentication or access control.** Anyone who can reach the API can create
  users and documents; users have no passwords.
- **Duplicate usernames return `500`** instead of a clear `409`, because the
  database's unique-constraint error isn't caught. The same applies to an
  `owner_id` that doesn't exist.
- **Not yet connected to the sync service.** Documents created here get numeric
  IDs, while the editor opens any `?doc=<id>` without checking this API.
- There are no read, update or delete endpoints yet.
