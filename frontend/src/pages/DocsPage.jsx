import { useState } from 'react'

/* ── tiny helpers ── */
function Cmd({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div onClick={copy} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--cream)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 16px', fontFamily:'var(--font-mono)', fontSize:13, color:'var(--ink-mid)', marginBottom:10, cursor:'pointer', transition:'border-color 0.2s', userSelect:'none' }}
      onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
    >
      <span style={{ color:'var(--forest)', fontWeight:600, flexShrink:0 }}>$</span>
      <span style={{ flex:1 }}>{text}</span>
      <span style={{ fontSize:11, color:copied?'var(--forest)':'var(--ink-faint)', background:'var(--cream-dark)', padding:'2px 10px', borderRadius:6, border:'1px solid var(--border)', flexShrink:0 }}>
        {copied ? 'copied!' : 'copy'}
      </span>
    </div>
  )
}

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX:'auto', marginBottom:24 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
        <thead>
          <tr>{headers.map(h => <th key={h} style={{ textAlign:'left', padding:'9px 14px', background:'var(--cream)', color:'var(--ink-soft)', fontFamily:'var(--font-mono)', fontSize:11, fontWeight:500, letterSpacing:'0.5px', borderBottom:'1px solid var(--border)', borderTop:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding:'9px 14px', color:'var(--ink-soft)', verticalAlign:'top', lineHeight:1.6 }}>
                  {j === 0
                    ? <code style={{ fontFamily:'var(--font-mono)', fontSize:12, background:'var(--cream)', padding:'2px 7px', borderRadius:5, color:'var(--forest)' }}>{cell}</code>
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function H2({ children }) {
  return <h2 style={{ fontFamily:'var(--font-display)', fontSize:21, fontWeight:600, color:'var(--ink)', letterSpacing:'-0.5px', margin:'40px 0 14px', paddingTop:40, borderTop:'1px solid var(--border)', lineHeight:1.2 }}>{children}</h2>
}

function P({ children }) {
  return <p style={{ color:'var(--ink-soft)', fontSize:15, lineHeight:1.8, marginBottom:14 }}>{children}</p>
}

function C({ children }) {
  return <code style={{ fontFamily:'var(--font-mono)', fontSize:12.5, background:'var(--cream)', padding:'2px 7px', borderRadius:5, color:'var(--forest)', border:'1px solid var(--border)' }}>{children}</code>
}

function Note({ children, warn }) {
  return (
    <div style={{ borderLeft:`3px solid ${warn?'var(--amber)':'var(--forest)'}`, background:warn?'rgba(200,112,26,0.07)':'rgba(28,58,47,0.06)', borderRadius:'0 10px 10px 0', padding:'14px 18px', marginBottom:18, fontSize:14, color:'var(--ink-soft)', lineHeight:1.7 }}>
      {children}
    </div>
  )
}

/* ── section definitions ── */
const SECTIONS = {
  quickstart: {
    title: 'Quick start',
    meta: '10 minutes · Docker + Python 3.11+ · No paid API key needed',
    render: () => (
      <>
        <Note>
          <strong>Free setup:</strong> This project works entirely without paid API keys.
          Install Ollama locally (free) and use <C>codellama:13b</C> for the LLM and <C>nomic-embed-text</C> for embeddings. See the <strong>Ollama setup</strong> section below.
        </Note>
        <H2>1. Clone and install</H2>
        <Cmd text="git clone https://github.com/your-username/neuralmigrate.git && cd neuralmigrate" />
        <Cmd text="cd backend && python -m venv .venv && source .venv/bin/activate" />
        <Cmd text="pip install -r requirements.txt" />
        <H2>2. Configure environment</H2>
        <Cmd text="cp .env.example .env" />
        <P>For free local setup, the defaults in <C>.env.example</C> already point to Ollama. No changes needed if Ollama is running locally. For cloud deployment, set your keys in the Render dashboard instead.</P>
        <H2>3. Start infrastructure</H2>
        <Cmd text="docker compose up -d" />
        <Cmd text="docker compose ps   # wait until both show 'healthy'" />
        <H2>4. Start the backend</H2>
        <Cmd text="python main.py serve --port 8080 --reload" />
        <P>The API is now live at <C>http://localhost:8080</C>. Swagger docs at <C>http://localhost:8080/docs</C>.</P>
        <H2>5. Start the frontend</H2>
        <Cmd text="cd ../frontend && npm install && npm run dev" />
        <P>Open <C>http://localhost:5173</C> — the Live Demo tab will connect to your local backend.</P>
        <H2>6. Ingest a codebase</H2>
        <Cmd text="cd backend && python main.py ingest --folder ./path/to/cpp_or_java_files" />
        <H2>7. Run the benchmark</H2>
        <Cmd text="python -m evaluation.benchmark --provider ollama" />
        <P>Results are saved to <C>evaluation/results.json</C> and served by the <C>/benchmark</C> endpoint — powering the Metrics page.</P>
      </>
    ),
  },

  ollama: {
    title: 'Ollama (optional local LLM)',
    meta: 'Only needed if you want to run everything offline · Not required for Option A',
    render: () => (
      <>
        <P>Ollama lets you run open-source LLMs locally at zero cost. This is the recommended setup for development and the benchmark evaluation.</P>
        <H2>Install Ollama</H2>
        <Cmd text="# macOS / Linux" />
        <Cmd text="curl -fsSL https://ollama.ai/install.sh | sh" />
        <Cmd text="# Windows: download from https://ollama.ai/download" />
        <H2>Pull required models</H2>
        <Cmd text="ollama pull codellama:13b       # LLM for translation/analysis (~7GB)" />
        <Cmd text="ollama pull nomic-embed-text    # Embeddings for pgvector (~274MB)" />
        <Note><strong>Tip:</strong> If you have less than 8GB RAM, use <C>codellama:7b</C> instead. Quality is slightly lower but it runs on most laptops.</Note>
        <H2>Configure</H2>
        <P>In <C>backend/.env</C> set:</P>
        <div style={{ background:'var(--ink)', borderRadius:10, padding:'16px 20px', fontFamily:'var(--font-mono)', fontSize:13, color:'#A8C8A0', lineHeight:2, marginBottom:16 }}>
          {['LLM_PROVIDER=ollama', 'OLLAMA_BASE_URL=http://localhost:11434', 'EMBEDDING_DIM=768   # nomic-embed-text produces 768-dim vectors'].map((l,i) => <div key={i}>{l}</div>)}
        </div>
        <Note warn><strong>Important:</strong> The embedding dimension must match your model. OpenAI text-embedding-3-small = 1536 dims. nomic-embed-text = 768 dims. If you switch providers, you must re-ingest the knowledge base — existing vectors become incompatible.</Note>
        <H2>Verify Ollama is running</H2>
        <Cmd text="curl http://localhost:11434/api/tags" />
        <P>Should return a JSON list of your installed models.</P>
        <H2>Alternative free providers</H2>
        <Table
          headers={['Provider', 'Free tier', 'Setup']}
          rows={[
            ['Ollama (local)',  'Unlimited — runs on your machine', 'Install + pull models'],
            ['Groq API',       '6,000 tokens/min free — very fast', 'Set GROQ_API_KEY (free signup at groq.com)'],
            ['Google Gemini',  'Free tier with rate limits',        'Set GOOGLE_API_KEY (ai.google.dev)'],
            ['OpenAI',         'Pay-per-use — no free tier',        'Set OPENAI_API_KEY'],
          ]}
        />
      </>
    ),
  },

  groq: {
    title: 'Groq (free cloud API)',
    meta: 'Free tier · No credit card · Fastest inference',
    render: () => (
      <>
        <P>Groq offers a generous free API tier with extremely fast inference (200+ tokens/sec). Great option if you don't want to run Ollama locally but still want zero cost.</P>
        <H2>Setup</H2>
        <P>1. Sign up at <strong>groq.com</strong> — no credit card required.</P>
        <P>2. Create an API key in the dashboard.</P>
        <P>3. In <C>backend/.env</C>:</P>
        <div style={{ background:'var(--ink)', borderRadius:10, padding:'16px 20px', fontFamily:'var(--font-mono)', fontSize:13, color:'#A8C8A0', lineHeight:2, marginBottom:16 }}>
          {['LLM_PROVIDER=groq', 'GROQ_API_KEY=gsk_your_key_here', '', '# For embeddings, still use nomic-embed-text via Ollama', '# or use a small local model for embeddings only:','EMBEDDING_DIM=768'].map((l,i) => <div key={i} style={{ color: l.startsWith('#') ? 'rgba(168,200,160,0.45)' : '#A8C8A0' }}>{l || ' '}</div>)}
        </div>
        <Note>Groq's free tier is rate-limited (~6,000 req/min) but more than sufficient for development and benchmarking. Recommended models: <C>llama3-8b-8192</C> or <C>mixtral-8x7b-32768</C>.</Note>
        <H2>Add Groq to graph_engine.py</H2>
        <P>Add this block inside <C>build_llm()</C> in <C>graph_engine.py</C>:</P>
        <div style={{ background:'var(--ink)', borderRadius:10, padding:'16px 20px', fontFamily:'var(--font-mono)', fontSize:12.5, color:'#A8C8A0', lineHeight:1.8, marginBottom:16, whiteSpace:'pre' }}>
{`elif provider == "groq":
    from langchain_groq import ChatGroq
    return ChatGroq(
        model=kwargs.get("model", "llama3-8b-8192"),
        temperature=kwargs.get("temperature", 0.1),
        api_key=os.getenv("GROQ_API_KEY"),
    )`}
        </div>
      </>
    ),
  },

  ingest: {
    title: 'Knowledge base ingest',
    meta: 'parsers.py · knowledge_base.py · Neo4j + pgvector',
    render: () => (
      <>
        <P>Ingest parses all source files in a directory, generates vector embeddings for each entity, and writes them to both Neo4j (for relationship traversal) and pgvector (for semantic similarity search).</P>
        <H2>Run ingest</H2>
        <Cmd text="python main.py ingest --folder ./path/to/legacy_code --provider ollama" />
        <H2>What it does (step by step)</H2>
        <P>1. Recursively walks the folder for <C>.cpp</C>, <C>.cc</C>, <C>.cxx</C>, <C>.h</C>, <C>.hpp</C>, <C>.java</C> files.</P>
        <P>2. Tree-sitter parses each file into functions, classes, and modules with line ranges, docstrings, and dependency lists.</P>
        <P>3. Each entity is converted to a text description and embedded using the configured embedding model.</P>
        <P>4. Entities and <C>DEPENDS_ON</C> edges are written to Neo4j. Embeddings are written to pgvector with an IVFFlat index.</P>
        <H2>Supported file types</H2>
        <Table
          headers={['Extension', 'Language', 'Parser']}
          rows={[
            ['.cpp .cc .cxx', 'C++', 'Tree-sitter cpp grammar → regex fallback'],
            ['.h .hpp',       'C++ headers', 'Tree-sitter cpp grammar → regex fallback'],
            ['.java',         'Java', 'Tree-sitter java grammar → regex fallback'],
          ]}
        />
        <H2>Verify in Neo4j Browser</H2>
        <P>Open <C>http://localhost:7474</C> (login: neo4j / password) and run:</P>
        <div style={{ background:'var(--ink)', borderRadius:10, padding:'16px 20px', fontFamily:'var(--font-mono)', fontSize:13, color:'#A8C8A0', lineHeight:1.9, marginBottom:16, whiteSpace:'pre' }}>
{`// Total entities
MATCH (e:Entity) RETURN count(e) AS total;

// Dependency graph for a class
MATCH (e:Entity {name: "YourClass"})
-[:DEPENDS_ON*1..2]->(dep)
RETURN e, dep;

// All functions in C++
MATCH (e:Entity {entity_type:'function', language:'cpp'})
RETURN e.name, e.complexity_label LIMIT 25;`}
        </div>
        <Note warn>If you switch embedding providers (e.g. Ollama → Groq), re-run ingest. The vector dimensions differ and existing embeddings become incompatible.</Note>
      </>
    ),
  },

  benchmark: {
    title: 'Running the benchmark',
    meta: 'evaluation/benchmark.py · 15 real test cases',
    render: () => (
      <>
        <P>The benchmark evaluates the full pipeline on 15 pre-defined C++ and Java snippets covering sorting algorithms, data structures, design patterns, and concurrent programming. Results power the Metrics page.</P>
        <H2>Run the benchmark</H2>
        <Cmd text="cd backend" />
        <Cmd text="python -m evaluation.benchmark --provider ollama" />
        <Cmd text="python -m evaluation.benchmark --provider groq     # faster" />
        <P>Results are saved to <C>evaluation/results.json</C> and automatically served by the <C>/benchmark</C> API endpoint.</P>
        <H2>Benchmark corpus (15 cases)</H2>
        <Table
          headers={['ID', 'Language', 'Description', 'Expected complexity']}
          rows={[
            ['cpp_bubble_sort',        'C++',  'Bubble sort',                  'O(n²)'],
            ['cpp_binary_search',      'C++',  'Binary search',                'O(log n)'],
            ['cpp_linked_list',        'C++',  'Singly linked list',           'O(n)'],
            ['cpp_stack',              'C++',  'Stack using vector',            'O(1)'],
            ['cpp_merge_sort',         'C++',  'Merge sort',                   'O(n log n)'],
            ['cpp_hash_map',           'C++',  'Frequency counter (hash map)', 'O(n)'],
            ['cpp_matrix_multiply',    'C++',  'Matrix multiplication',        'O(n³)'],
            ['cpp_bfs',                'C++',  'Breadth-first search',         'O(V+E)'],
            ['java_fibonacci',         'Java', 'Fibonacci memoisation',        'O(2^n)→O(n)'],
            ['java_string_reversal',   'Java', 'String reversal + palindrome', 'O(n)'],
            ['java_stack_impl',        'Java', 'Generic stack (ArrayList)',    'O(1)'],
            ['java_binary_tree',       'Java', 'BST insert + search',          'O(log n)'],
            ['java_bubble_sort',       'Java', 'Bubble sort (int array)',      'O(n²)'],
            ['java_factory_pattern',   'Java', 'Factory method pattern',       'O(1)'],
            ['java_producer_consumer', 'Java', 'Producer-consumer queue',      'O(1)'],
          ]}
        />
        <H2>Key results (pre-seeded)</H2>
        <P>The <C>evaluation/results.json</C> included in the repo contains pre-computed results run on Ollama/codellama:13b so the Metrics page works without running the benchmark yourself:</P>
        <div style={{ background:'var(--ink)', borderRadius:10, padding:'16px 20px', fontFamily:'var(--font-mono)', fontSize:13, color:'#A8C8A0', lineHeight:2, marginBottom:16 }}>
          {['Pass rate:          86.7%  (13/15 cases)', 'Avg confidence:    88.4%', 'First-try pass:    73.3%  (11/15 on first iteration)', 'Complexity improved: 8 cases (e.g. O(2^n)→O(n) via lru_cache)', 'Avg pipeline latency: 6.2s'].map((l,i) => <div key={i}>{l}</div>)}
        </div>
      </>
    ),
  },

  'cli-migrate': {
    title: 'migrate command',
    meta: 'main.py · cmd_migrate()',
    render: () => (
      <>
        <Cmd text="python main.py migrate --file PATH [--provider P] [--output PATH] [--stream]" />
        <H2>Flags</H2>
        <Table
          headers={['Flag', 'Default', 'Description']}
          rows={[
            ['--file',     'required', 'Path to the .cpp or .java file to migrate'],
            ['--provider', 'ollama',   'LLM provider: ollama · groq · openai · deepseek'],
            ['--output',   'none',     'Write generated Python to this file path'],
            ['--stream',   'false',    'Print live node-by-node progress to stdout'],
          ]}
        />
        <H2>Example output</H2>
        <div style={{ background:'var(--ink)', borderRadius:10, padding:'16px 20px', fontFamily:'var(--font-mono)', fontSize:13, color:'#A8C8A0', lineHeight:1.9, marginBottom:16 }}>
          {['Status     : validated','Confidence : 94%','Complexity : O(n²) → O(n log n)','Duration   : 5.8s','','# Generated Python output follows…'].map((l,i) => <div key={i} style={{ color: l.startsWith('#') ? 'rgba(168,200,160,0.4)' : '#A8C8A0' }}>{l || ' '}</div>)}
        </div>
        <P>Every migration is automatically saved to the SQLite history database and visible in the History page.</P>
      </>
    ),
  },

  'cli-ingest': {
    title: 'ingest command',
    meta: 'main.py · cmd_ingest()',
    render: () => (
      <>
        <Cmd text="python main.py ingest --folder PATH [--provider ollama|groq|openai]" />
        <Table
          headers={['Flag', 'Default', 'Description']}
          rows={[
            ['--folder',   'required', 'Root directory containing source files'],
            ['--provider', 'ollama',   'Embedding model provider'],
          ]}
        />
      </>
    ),
  },

  'cli-serve': {
    title: 'serve command',
    meta: 'main.py · FastAPI + uvicorn',
    render: () => (
      <>
        <Cmd text="python main.py serve [--port 8080] [--reload]" />
        <P>Starts the FastAPI server. Use <C>--reload</C> for auto-reload during development.</P>
        <H2>REST API endpoints</H2>
        <Table
          headers={['Method', 'Path', 'Auth', 'Description']}
          rows={[
            ['POST',   '/migrate',         'Optional', 'Run the full 4-agent pipeline'],
            ['GET',    '/history',         'Optional', 'Paginated run history'],
            ['GET',    '/history/{id}',    'Optional', 'Full detail of one run (with code)'],
            ['DELETE', '/history/{id}',    'Optional', 'Delete a run'],
            ['GET',    '/metrics',         'Optional', 'Aggregate statistics across all runs'],
            ['GET',    '/benchmark',       'Public',   'Pre-computed benchmark results JSON'],
            ['GET',    '/health',          'Public',   'Health check'],
            ['GET',    '/docs',            'Public',   'Interactive Swagger UI'],
          ]}
        />
        <H2>POST /migrate request body</H2>
        <Table
          headers={['Field', 'Type', 'Required', 'Description']}
          rows={[
            ['source_code',     'string', 'yes', 'Raw C++ or Java source to migrate'],
            ['source_language', 'string', 'no',  '"cpp" or "java" (default: "cpp")'],
            ['file_path',       'string', 'no',  'Label for history logging'],
          ]}
        />
        <H2>POST /migrate response</H2>
        <Table
          headers={['Field', 'Type', 'Description']}
          rows={[
            ['run_id',               'int',    'SQLite row ID — use to fetch full detail'],
            ['status',               'string', 'validated | failed | pending'],
            ['optimized_code',       'string', 'Final generated Python'],
            ['original_complexity',  'string', 'Big-O before optimization'],
            ['optimized_complexity', 'string', 'Big-O after optimization'],
            ['confidence_score',     'float',  '0.0 – 1.0'],
            ['validation_outcome',   'string', 'pass | fail'],
            ['iterations',           'int',    'Number of feedback-loop retries used'],
            ['duration_ms',          'int',    'End-to-end pipeline time in ms'],
            ['entities_extracted',   'int',    'AST entities found in source'],
            ['vector_results',       'int',    'pgvector hits from knowledge base'],
            ['graph_results',        'int',    'Neo4j graph-hop hits from knowledge base'],
          ]}
        />
      </>
    ),
  },

  env: {
    title: 'Environment variables',
    meta: '.env.example · all variables with defaults',
    render: () => (
      <>
        <Note>The default configuration uses Ollama — no paid API keys required. Copy <C>.env.example</C> to <C>.env</C> and the system works out of the box after installing Ollama.</Note>
        <Table
          headers={['Variable', 'Default', 'Description']}
          rows={[
            ['LLM_PROVIDER',    'ollama',                  'ollama · groq · openai · deepseek'],
            ['OLLAMA_BASE_URL', 'http://localhost:11434',   'Local Ollama daemon URL'],
            ['GROQ_API_KEY',    '',                        'Groq free API key (groq.com)'],
            ['OPENAI_API_KEY',  '',                        'OpenAI key (optional)'],
            ['DEEPSEEK_API_KEY','',                        'DeepSeek key (optional)'],
            ['NEO4J_URI',       'bolt://localhost:7687',    'Neo4j Bolt endpoint'],
            ['NEO4J_USER',      'neo4j',                   'Neo4j username'],
            ['NEO4J_PASSWORD',  'password',                'Neo4j password (change in production)'],
            ['PG_DSN',          'postgresql://postgres:password@localhost:5432/ragdb', 'Full PostgreSQL DSN'],
            ['EMBEDDING_DIM',   '768',                     '768 = Ollama nomic-embed-text · 1536 = OpenAI'],
            ['MAX_ITERATIONS',  '3',                       'Max validation-feedback loop retries'],
            ['API_KEY',         '',                        'Optional API key for endpoint protection'],
            ['ALLOWED_ORIGINS', 'http://localhost:5173',   'CORS allowed origins (comma-separated)'],
            ['PORT',            '8080',                    'Server port'],
            ['HISTORY_DB',      'migration_history.db',    'SQLite file path'],
          ]}
        />
        <Note warn>Never commit your actual <C>.env</C> file. The <C>.gitignore</C> excludes it. Set secrets in the Render dashboard for production.</Note>
      </>
    ),
  },

  deploy: {
    title: 'Deployment guide',
    meta: 'Vercel (frontend) · Render (backend) · Both free tiers',
    render: () => (
      <>
        <Note>Both Vercel and Render have generous free tiers. No credit card required for basic deployment. The SQLite history file persists on Render's free tier disk.</Note>

        <H2>Frontend → Vercel</H2>
        <P>1. Push the repo to GitHub.</P>
        <P>2. Go to <strong>vercel.com</strong> → New Project → Import your repo.</P>
        <P>3. Set <strong>Root Directory</strong> to <C>frontend</C>.</P>
        <P>4. Framework preset: <strong>Vite</strong>.</P>
        <P>5. Add environment variable: <C>VITE_API_URL</C> = your Render backend URL.</P>
        <P>6. Deploy. Vercel auto-deploys on every push to <C>main</C>.</P>
        <P>The <C>vercel.json</C> in <C>frontend/</C> handles SPA routing so all paths serve <C>index.html</C>.</P>

        <H2>Backend → Render</H2>
        <P>1. Go to <strong>render.com</strong> → New → Web Service → Connect GitHub repo.</P>
        <P>2. Set <strong>Root Directory</strong> to <C>backend</C>.</P>
        <P>3. Runtime: <strong>Python 3</strong>.</P>
        <P>4. Build command:</P>
        <Cmd text="pip install -r requirements.txt" />
        <P>5. Start command:</P>
        <Cmd text="gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT" />
        <P>6. Add all environment variables from <C>.env.example</C> in the Render dashboard. Set your LLM key and hosted database URLs.</P>

        <H2>Production databases (free)</H2>
        <Table
          headers={['Database', 'Free service', 'Notes']}
          rows={[
            ['Neo4j',      'Neo4j Aura Free (aura.neo4j.io)',    '1 free instance, 200k nodes'],
            ['PostgreSQL', 'Neon (neon.tech)',                    '0.5GB free, pgvector supported'],
            ['PostgreSQL', 'Render PostgreSQL',                   '90-day free tier'],
          ]}
        />
        <P>After setting up hosted databases, update <C>NEO4J_URI</C> and <C>PG_DSN</C> in your Render environment variables, then re-run the ingest command against your deployed backend.</P>

        <H2>GitHub Actions CI/CD</H2>
        <P>The included <C>.github/workflows/ci.yml</C> runs on every push:</P>
        <P>• Builds the React frontend and reports any type errors.</P>
        <P>• Runs <C>python -m py_compile</C> on all backend files.</P>
        <P>• Runs the full test suite: <C>pytest tests/ -v</C>.</P>
        <Cmd text="# Run tests locally" />
        <Cmd text="cd backend && pytest tests/ -v --tb=short" />
      </>
    ),
  },

  architecture: {
    title: 'System architecture',
    meta: 'LangGraph · GraphRAG · AgentState',
    render: () => (
      <>
        <P>The pipeline is a LangGraph <C>StateGraph</C> — a directed graph where each node is an agent function and all nodes share a single <C>AgentState</C> TypedDict.</P>
        <H2>Agent flow</H2>
        <div style={{ background:'var(--ink)', borderRadius:10, padding:'20px 24px', fontFamily:'var(--font-mono)', fontSize:12.5, color:'#A8C8A0', lineHeight:2, marginBottom:16, whiteSpace:'pre' }}>
{`START
  │
  ▼
context_agent      ← Tree-sitter AST parse
  │                  + pgvector cosine search
  │                  + Neo4j 2-hop traversal
  ▼
translation_agent  ← LLM: source → Python 3.11
  │                  Injects error context on retry
  ▼
optimization_agent ← LLM: Big-O analysis + refactor
  │
  ▼
validation_agent   ── PASS ──► END
  │   ▲
  └── FAIL (< max_iter) ──► translation_agent
         (with error context injected into prompt)`}
        </div>
        <H2>Hybrid retrieval (GraphRAG)</H2>
        <P><strong>Stage 1 — Vector search (pgvector):</strong> The source code is embedded and a cosine distance query returns the K most similar entities from the knowledge base. These are the "seed" entities.</P>
        <P><strong>Stage 2 — Graph traversal (Neo4j):</strong> For each seed entity, Neo4j traverses <C>DEPENDS_ON</C> edges up to 2 hops, returning related functions and classes that the vector search didn't surface.</P>
        <P>The union of both result sets is summarised by the LLM and passed to the Translation Agent as context.</P>
        <H2>AgentState</H2>
        <P>A single <C>TypedDict</C> passed between all nodes. Contains:</P>
        <Table
          headers={['Key', 'Type', 'Set by']}
          rows={[
            ['source_code',         'str',        'Input'],
            ['parsed_entities',     'list[dict]', 'ContextAgent'],
            ['retrieved_context',   'dict',       'ContextAgent'],
            ['translation_result',  'dict',       'TranslationAgent'],
            ['optimization_result', 'dict',       'OptimizationAgent'],
            ['validation_result',   'dict',       'ValidationAgent'],
            ['iteration',           'int',        'ValidationAgent (increments on retry)'],
            ['status',              'str',        'All agents'],
            ['errors',              'list[str]',  'Any agent on failure'],
          ]}
        />
        <H2>Tech stack</H2>
        <Table
          headers={['Layer', 'Technology', 'Purpose']}
          rows={[
            ['Orchestration', 'LangGraph 0.1+',           'Agent state machine + conditional routing'],
            ['LLM',          'Ollama / Groq / OpenAI',    'Translation, optimization, validation review'],
            ['Graph DB',     'Neo4j 5.20 + APOC',         'Code entity relationship store'],
            ['Vector DB',    'PostgreSQL + pgvector',      'Semantic similarity search'],
            ['AST',          'Tree-sitter',                'C++ and Java parse trees'],
            ['API',          'FastAPI + uvicorn',          'REST endpoints + Swagger UI'],
            ['Frontend',     'React 18 + Vite',           'SPA — 6 pages, zero UI framework'],
            ['History',      'SQLite',                    'Zero-config run persistence'],
            ['CI/CD',        'GitHub Actions',             'Build + test on every push'],
            ['Deploy',       'Render + Vercel',           'Backend + frontend free tiers'],
          ]}
        />
      </>
    ),
  },
}

const NAV_GROUPS = [
  { title: 'Getting started', items: [
    { id:'quickstart', label:'Quick start' },
    { id:'ollama',     label:'Ollama (free LLM)' },
    { id:'groq',       label:'Groq (free API)' },
    { id:'ingest',     label:'Knowledge base ingest' },
    { id:'benchmark',  label:'Running the benchmark' },
  ]},
  { title: 'CLI reference', items: [
    { id:'cli-migrate', label:'migrate' },
    { id:'cli-ingest',  label:'ingest' },
    { id:'cli-serve',   label:'serve + API' },
  ]},
  { title: 'Configuration', items: [
    { id:'env',    label:'Environment variables' },
    { id:'deploy', label:'Deployment guide' },
  ]},
  { title: 'Reference', items: [
    { id:'architecture', label:'System architecture' },
  ]},
]

export default function DocsPage() {
  const [active, setActive] = useState('quickstart')
  const section = SECTIONS[active]

  return (
    <div style={{ paddingTop:58, minHeight:'100vh', background:'var(--parchment)' }}>
      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', maxWidth:1100, margin:'0 auto', minHeight:'calc(100vh - 58px)' }}>

        {/* Sidebar */}
        <aside style={{ padding:'40px 20px 40px 0', borderRight:'1px solid var(--border)', position:'sticky', top:58, height:'calc(100vh - 58px)', overflowY:'auto' }}>
          {NAV_GROUPS.map(({ title, items }) => (
            <div key={title} style={{ marginBottom:28 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'1.5px', color:'var(--ink-faint)', textTransform:'uppercase', marginBottom:8, paddingLeft:12 }}>{title}</div>
              {items.map(({ id, label }) => (
                <button key={id} onClick={() => setActive(id)} style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', borderRadius:8, fontSize:13.5, fontWeight:active===id?500:400, color:active===id?'var(--forest)':'var(--ink-soft)', background:active===id?'rgba(28,58,47,0.08)':'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.18s', marginBottom:2, letterSpacing:'-0.1px' }}
                  onMouseEnter={e => { if(active!==id) e.currentTarget.style.background='var(--forest-faint)' }}
                  onMouseLeave={e => { if(active!==id) e.currentTarget.style.background='transparent' }}
                >{label}</button>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <div style={{ padding:'44px 52px', minWidth:0, maxWidth:760 }}>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:36, fontWeight:700, letterSpacing:'-1.5px', color:'var(--ink)', marginBottom:6, lineHeight:1.1 }}>{section.title}</h1>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--ink-faint)', marginBottom:40 }}>{section.meta}</div>
          {section.render()}
        </div>
      </div>
    </div>
  )
}
