# NeuralMigrate

Multi-Agent RAG system that converts C++ and Java code into optimized Python 3.11+

--------------------------------------------------

## Why this matters

Legacy code migration is slow, manual, and error-prone

NeuralMigrate automates it with:
- multi-agent reasoning
- retrieval-augmented context
- self-healing execution loop

--------------------------------------------------

## Key results

93.3 percent success rate (14 out of 15 cases)  
73.3 percent first-pass success  
Average confidence 90 percent  
Improved time complexity in 8 cases  
End-to-end latency 6.4 seconds  

--------------------------------------------------

## What makes it different

Context-aware translation  
Uses pgvector plus Neo4j graph traversal for dependency-aware retrieval  

Self-healing pipeline  
Runs generated code, captures errors, retries with feedback  

Built-in optimization  
Automatically improves Big-O using lru_cache, bisect, heapq  

Full observability  
Tracks confidence, latency, and agent-level execution  

--------------------------------------------------

## Architecture

C++ or Java input  

Context Agent  
Retrieval using embeddings and graph traversal  

Translation Agent  
LLM generates Python  

Optimization Agent  
Improves performance  

Validation Agent  
Executes and retries on failure  

Max 3 retries  

--------------------------------------------------

## Tech stack

LangGraph and LangChain  
Groq LLM (llama-3.3-70b)  
Neo4j (graph)  
PostgreSQL with pgvector (vector search)  
FastAPI backend  
React frontend  
SQLite for history  

--------------------------------------------------

## Run locally

git clone https://github.com/Sauravv193/neuralmigrate.git  
cd neuralmigrate/backend  

python -m venv .venv  
source .venv/bin/activate  
pip install -r requirements.txt  

cp .env.example .env  

python main.py ingest --folder ./corpus  
python main.py serve --port 8080  

Frontend  

cd ../frontend  
npm install  
npm run dev  

--------------------------------------------------

## API

POST /migrate  
GET /history  
GET /metrics  

--------------------------------------------------

## Tests

66 tests all passing  

--------------------------------------------------

## Deployment

Frontend: Vercel  
Backend: Render  

--------------------------------------------------

## License

MIT
