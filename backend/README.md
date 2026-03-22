# NeuralMigrate — Backend

FastAPI + LangGraph backend for the NeuralMigrate code migration platform.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set OPENAI_API_KEY
python main.py serve --port 8080 --reload
```

API docs at http://localhost:8080/docs

## CLI commands

```bash
# Ingest a codebase into the knowledge graph
python main.py ingest --folder ./path/to/code

# Migrate a single file
python main.py migrate --file ./Sorter.cpp --output sorter.py

# Start the API server
python main.py serve --port 8080
```

## Deploy to Render

- **Build command**: `pip install -r requirements.txt`
- **Start command**: `gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
- **Health check path**: `/health`

Set all environment variables from `.env.example` in the Render dashboard.
