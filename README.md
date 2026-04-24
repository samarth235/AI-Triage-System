# AI Triage System

This project is now wired as a full-stack triage application with:

- React frontend that preserves the current UI and live dashboard behavior
- Flask + Socket.IO backend
- PostgreSQL persistence for patients, audit logs, vitals history, and bed state
- Dockerized local stack with frontend, backend, and Postgres
- Automatic model bootstrap when trained artifacts are missing

## Stack

- Frontend: React 18, Axios, Socket.IO client, Recharts
- Backend: Flask, Flask-SocketIO, Flask-SQLAlchemy
- Database: PostgreSQL 16
- ML: XGBoost with synthetic bootstrap training data
- Infra: Docker Compose, Nginx frontend proxy

## Project Structure

```text
backend/
  app.py
  database.py
  model/
  tests/
  utils/
frontend/
  src/
  Dockerfile
  nginx.conf
docker-compose.yml
```

## Quick Start With Docker

1. Copy the sample environment file:

```bash
cp .env.example .env
```

2. Start the full stack:

```bash
docker compose up --build
```

3. Open the app:

- Frontend: [http://localhost:8080](http://localhost:8080)
- Backend health: [http://localhost:5001/api/health](http://localhost:5001/api/health)

The backend will create PostgreSQL tables automatically. If model artifacts are missing, it will train a bootstrap model on first start and save the files under `backend/model/`.

## Local Development Without Docker

### Backend

1. Create a PostgreSQL database.
2. Set environment variables in `backend/.env` or root `.env`:

```env
DATABASE_URL=postgresql://triage:triage@localhost:5432/triage_db
SECRET_KEY=triage-secret-2024
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

3. Install dependencies and run the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Frontend

1. Copy the frontend sample env:

```bash
cp frontend/.env.example frontend/.env
```

2. Install dependencies and run:

```bash
cd frontend
npm install
npm start
```

The frontend will use `REACT_APP_API_BASE_URL=http://localhost:5000` for local development.

## What Changed

- Replaced in-memory backend state with PostgreSQL-backed models
- Persisted:
  - patient queue
  - discharge status
  - audit trail
  - vitals history
  - bed occupancy
- Added Docker support for frontend, backend, and Postgres
- Added backend health reporting
- Added automatic model artifact bootstrap
- Preserved the current UI while fixing state sync and API/socket configuration
- Added responsive CSS improvements
- Added basic backend smoke tests for NLP and sepsis logic

## Verification

Useful commands:

```bash
python3 -m compileall backend
python3 -m unittest discover -s backend/tests
docker compose up --build
```

## Notes

- The current ML model still trains from synthetic data. This keeps the project runnable, but production clinical use would require validated real-world datasets, governance, and model evaluation workflows.
- Handover PDFs are written to `backend/reports/`.
- Frontend API calls default to same-origin in Docker via the Nginx proxy, and use `REACT_APP_API_BASE_URL` in local development.
