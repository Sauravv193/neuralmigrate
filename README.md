# NeuralMigrate

**Enterprise Multi-Agent RAG System for Automated Code Migration**

Migrates C++ and Java to idiomatic Python 3.11+ using a four-agent LangGraph pipeline
with GraphRAG retrieval, Big-O complexity analysis, and a self-healing validation loop.

**Benchmark: 93.3% pass rate (14/15) · 90.1% avg confidence · 6.4s avg latency**

---

## Setup — Option A (Recommended: No Docker, No Ollama)

Uses free cloud services only. Total extra storage: **~90MB** (embedding model cache).

### What you need to sign up for (all free, no credit card)

| Service | What it does | Sign up |
|---|---|---|
| **Groq** | Free LLM API (llama3-8b) | console.groq.com |
| **Neo4j Aura** | Free cloud graph database | neo4j.com/cloud/aura |
| **Neon** | Free PostgreSQL + pgvector | neon.tech |

### Step 1 — Sign up for the three free services

**Groq:**
1. Go to console.groq.com → sign up free
2. Go to API Keys → Create API Key
3. Copy the key (starts with `gsk_`)

**Neo4j Aura:**
1. Go to neo4j.com/cloud/aura → sign up free
2. Create a new instance → choose **AuraDB Free**
3. Copy the connection URI (looks like `neo4j+s://abc123.databases.neo4j.io`)
4. Save the generated password — you only see it once

**Neon:**
1. Go to neon.tech → sign up free
2. Create a new project (any name)
3. On the dashboard, copy the connection string
4. It looks like: `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require`

### Step 2 — Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/neuralmigrate.git
cd neuralmigrate/backend

python -m venv .venv

# Mac / Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

`pip install` will download sentence-transformers (~90MB) on first run for embeddings.

### Step 3 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your three keys:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_paste_your_key_here

NEO4J_URI=neo4j+s://PASTE_YOUR_URI.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=paste_your_password_here

PG_DSN=postgresql://user:pass@ep-your-endpoint.neon.tech/neondb?sslmode=require

EMBEDDING_PROVIDER=huggingface
EMBEDDING_DIM=384
```

### Step 4 — Ingest the knowledge base

```bash
python main.py ingest --folder ./corpus
```

This reads the C++ and Java files in `corpus/`, generates embeddings (first run downloads
the 90MB model), and stores everything in your cloud Neo4j and Neon databases.
Takes about 3–4 minutes. You only need to do this once.

### Step 5 — Start the backend

```bash
python main.py serve --port 8080 --reload
```

### Step 6 — Start the frontend

Open a second terminal:

```bash
cd ../frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173 in your browser.

### Step 7 — Connect frontend to backend

In the browser: **Live Demo → click "demo mode" badge → enter `http://localhost:8080` → Test & connect**

The badge changes to **live API**. All migrations now use your real Groq + Neo4j + Neon pipeline.

### Step 8 — Run a migration

```bash
# From backend terminal
python main.py migrate --file ./corpus/cpp/algorithms.cpp --output migrated.py
```

---

## Run tests (no cloud services needed — everything mocked)

```bash
cd backend
source .venv/bin/activate   # Mac/Linux
pytest tests/test_api.py -v
pytest tests/test_parsers.py tests/test_schema.py -v
```

All 66 tests pass without Groq, Neo4j, or Neon.

---

## Push to GitHub

```bash
cd neuralmigrate-full
git init
git add .
git commit -m "Initial commit — NeuralMigrate final year project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/neuralmigrate.git
git push -u origin main
```

---

## Deploy to Vercel + Render (both free)

### Frontend → Vercel

1. Go to vercel.com → New Project → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework preset: **Vite** (auto-detected)
4. Add environment variable: `VITE_API_URL` = your Render backend URL (fill after Render step)
5. Deploy

### Backend → Render

1. Go to render.com → New → Web Service → connect GitHub repo
2. Set **Root Directory** to `backend`
3. Runtime: **Python 3**
4. Build: `pip install -r requirements.txt`
5. Start: `gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
6. Add environment variables (same as your local `.env`):
   - `LLM_PROVIDER` = `groq`
   - `GROQ_API_KEY` = your key
   - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
   - `PG_DSN`
   - `EMBEDDING_PROVIDER` = `huggingface`
   - `EMBEDDING_DIM` = `384`
   - `ALLOWED_ORIGINS` = your Vercel URL
7. Deploy

After Render gives you a URL (e.g. `https://neuralmigrate-backend.onrender.com`),
go back to Vercel → Settings → Environment Variables → update `VITE_API_URL` → Redeploy.

### Ingest on Render (one time)

In Render dashboard → your service → **Shell** tab:
```bash
python main.py ingest --folder ./corpus
```

---

## Project structure

```
neuralmigrate/
├── backend/
│   ├── agents.py            4 LangGraph agent nodes
│   ├── graph_engine.py      LangGraph StateGraph + LLM/embedding factory
│   ├── knowledge_base.py    Neo4j + pgvector dual-database client
│   ├── parsers.py           Tree-sitter AST parser + regex fallback
│   ├── schema.py            Pydantic v2 models + AgentState
│   ├── history.py           SQLite migration history store
│   ├── auth.py              Optional API key middleware
│   ├── main.py              FastAPI app + CLI
│   ├── corpus/              Pre-built knowledge base (C++/Java files)
│   ├── evaluation/          Benchmark runner + results.json (93.3%)
│   ├── tests/               66 tests — all passing
│   ├── pytest.ini           Test config
│   ├── requirements.txt     Dependencies
│   └── .env.example         Config template (Option A defaults)
│
├── frontend/
│   └── src/pages/
│       ├── HomePage.jsx     Overview + stats
│       ├── DemoPage.jsx     Live migration demo
│       ├── MetricsPage.jsx  Benchmark dashboard
│       ├── HistoryPage.jsx  Run history
│       ├── ArchPage.jsx     Architecture diagram
│       └── DocsPage.jsx     Full documentation
│
├── docker-compose.yml       Optional — only needed if not using cloud DBs
├── RESULTS.md               Full benchmark methodology + resume bullets
└── .github/workflows/ci.yml GitHub Actions CI
```

---

## Tech stack

| | Technology | Cost |
|---|---|---|
| LLM | Groq / llama3-8b-8192 | Free |
| Embeddings | sentence-transformers / all-MiniLM-L6-v2 | Free |
| Graph DB | Neo4j Aura | Free |
| Vector DB | Neon PostgreSQL + pgvector | Free |
| Orchestration | LangGraph + LangChain | — |
| AST parsing | Tree-sitter | — |
| API | FastAPI + uvicorn | — |
| Frontend | React 18 + Vite | — |
| Deploy | Render + Vercel | Free |
| CI/CD | GitHub Actions | Free |

---

## Benchmark results

See `RESULTS.md` for full methodology.

| Metric | Value |
|---|---|
| Pass rate | **93.3%** (14/15 cases) |
| Avg confidence | **90.1%** |
| Complexity improved | 8/15 cases (O(2^n)→O(n), O(n²)→O(n log n)) |
| First-try pass | 73.3% |
| Avg latency | 6.4s end-to-end |
