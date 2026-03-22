import { useState } from 'react'

const CARDS = [
  {
    id: 'retrieval', icon: '◈', title: 'Hybrid Retrieval', file: 'knowledge_base.py',
    color: 'var(--forest)', bg: 'rgba(28,58,47,0.07)',
    body: `Two-stage GraphRAG retrieval. Stage 1: pgvector runs a cosine distance query and returns the K most semantically similar code entities from the knowledge base.\n\nStage 2: for each seed entity, Neo4j traverses DEPENDS_ON edges up to 2 hops — surfacing related functions and classes that the vector index never saw.\n\nThe union of both result sets is summarised by the LLM and injected into the Translation Agent prompt as structured context.`,
    pills: ['pgvector IVFFlat', 'Neo4j APOC', 'cosine distance', '2-hop traversal', 'DEPENDS_ON edges'],
  },
  {
    id: 'ast', icon: '⌥', title: 'AST Parsing', file: 'parsers.py',
    color: '#7A4520', bg: 'rgba(200,112,26,0.08)',
    body: `Tree-sitter with pre-compiled grammars extracts every function, class, and module — capturing names, line ranges, docstrings, and dependency lists.\n\nA regex fallback activates silently when the shared library is absent, so the ingest command never fails hard in CI or minimal environments.\n\nDependency edges are created between entities and written to Neo4j as DEPENDS_ON relationships during ingest.`,
    pills: ['tree-sitter-languages', 'C++ grammar', 'Java grammar', 'regex fallback', 'Doxygen/Javadoc'],
  },
  {
    id: 'databases', icon: '⊞', title: 'Dual Database', file: 'Neo4j + PostgreSQL',
    color: 'var(--forest)', bg: 'rgba(28,58,47,0.07)',
    body: `Neo4j stores code entities as nodes with DEPENDS_ON relationship edges — well-suited for multi-hop dependency traversal.\n\nPostgreSQL with pgvector stores 1536-dim embedding vectors indexed with IVFFlat for sub-linear cosine search.\n\nBoth are populated by a single ingest command and read by the Context Agent on every migration run. A SQLite history database tracks all past runs with full metrics.`,
    pills: ['Neo4j 5.20', 'pgvector/pgvector:pg16', 'APOC plugin', 'psycopg2', 'SQLite history'],
  },
  {
    id: 'sandbox', icon: '◎', title: 'Validation Sandbox', file: 'agents.py → validation_agent()',
    color: '#7A4520', bg: 'rgba(200,112,26,0.08)',
    body: `Generated Python is written to /tmp and executed by subprocess.run() with a stripped env dict, captured stdout/stderr, and a 15-second hard timeout. No inherited secrets. No network access from the spawned process.\n\nThe LLM then reviews both the code and the subprocess output — producing structured errors and actionable fix suggestions that the Translation Agent uses on the next iteration.`,
    pills: ['subprocess.run', '15s timeout', 'stripped env', 'captured I/O', 'LLM code review'],
  },
  {
    id: 'state', icon: '≡', title: 'AgentState — shared contract', file: 'schema.py',
    body: `Every node reads and writes a single TypedDict. LangGraph serialises and passes it between nodes. Pydantic v2 models (CodeEntity, RetrievedContext, TranslationResult, OptimizationResult, ValidationResult) are stored as plain dicts inside the state for JSON-serialisability.\n\nThe conditional edge after validation_agent reads state["validation_result"]["outcome"] to route either to END or back to translation_agent for a retry with the error context injected.`,
    pills: ['TypedDict', 'Pydantic v2', 'conditional edge', 'MigrationStatus enum', 'ValidationOutcome enum'],
    color: 'var(--forest)', bg: 'rgba(28,58,47,0.07)', wide: true,
  },
]

const FLOW = [
  { label: 'Context',   color: 'var(--forest)',     icon: '◈' },
  { label: 'Translate', color: 'var(--amber)',       icon: '⟳' },
  { label: 'Optimise',  color: 'var(--forest-mid)', icon: '∿' },
  { label: 'Validate',  color: '#9B3D1A',            icon: '◎' },
  { label: 'Output',    color: 'var(--ink-faint)',   icon: '🐍' },
]

const cardMap = { Context: 'retrieval', Translate: 'ast', Optimise: 'databases', Validate: 'sandbox' }

export default function ArchPage() {
  const [highlight, setHighlight] = useState(null)

  const scrollTo = id => {
    setHighlight(id)
    setTimeout(() => document.getElementById('card-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  return (
    <div style={{ paddingTop: 58, background: 'var(--parchment)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 40px' }}>

        <div style={{ marginBottom: 56 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '2px', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 14 }}>System design</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,58px)', fontWeight: 700, letterSpacing: '-2px', color: 'var(--ink)', lineHeight: 1.05, marginBottom: 16 }}>Architecture</h1>
          <p style={{ fontSize: 17, color: 'var(--ink-soft)', maxWidth: 500, lineHeight: 1.7 }}>From a folder of .cpp files to validated Python — how each layer fits together. Click any node in the flow diagram to jump to its detail card.</p>
        </div>

        {/* Flow diagram */}
        <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 32px', marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '1.5px', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 32, textAlign: 'center' }}>LangGraph State Machine</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
            {FLOW.map(({ label, color, icon }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: cardMap[label] ? 'pointer' : 'default' }}
                  onClick={() => cardMap[label] && scrollTo(cardMap[label])}>
                  <div style={{ width: 80, height: 80, borderRadius: 18, border: `1.5px solid ${color}40`, background: `${color}0D`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.25s', fontSize: 22 }}
                    onMouseEnter={e => { if (cardMap[label]) { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none' }}>
                    {icon}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '0.5px' }}>{label.toLowerCase()}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{label}</div>
                </div>
                {i < FLOW.length - 1 && <div style={{ width: 28, height: 1, background: 'var(--border-strong)', margin: '0 2px', marginBottom: 22, flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 24px', border: '1px dashed rgba(155,61,26,0.28)', borderRadius: 100, maxWidth: 540, margin: '28px auto 0' }}>
            <span style={{ fontSize: 14 }}>↩</span>
            <span style={{ fontSize: 12.5, color: '#7A3010', fontFamily: 'var(--font-body)' }}>
              <strong>FAIL:</strong> Validation routes back to Translation Agent with full error context — up to 3 retries
            </span>
          </div>
        </div>

        {/* Detail cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {CARDS.map(({ id, icon, title, file, color, bg, body, pills, wide }) => (
            <div key={id} id={`card-${id}`} style={{
              gridColumn: wide ? '1 / -1' : 'auto',
              background: 'var(--parchment)', borderRadius: 16, padding: 32,
              border: '1px solid', borderColor: highlight === id ? `${color}50` : 'var(--border)',
              boxShadow: highlight === id ? `0 0 0 3px ${color}14, var(--shadow-md)` : 'var(--shadow-sm)',
              transition: 'all 0.35s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = highlight === id ? `0 0 0 3px ${color}14, var(--shadow-md)` : 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 50, height: 50, borderRadius: 13, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, color }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.2, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-faint)' }}>{file}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.75, whiteSpace: 'pre-line', marginBottom: 20 }}>{body}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pills.map(p => (
                  <span key={p} style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontFamily: 'var(--font-mono)', background: bg, color, border: `1px solid ${color}22` }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tech stack summary */}
        <div style={{ marginTop: 28, background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 20, letterSpacing: '-0.4px' }}>Full tech stack</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            {[
              { label: 'Orchestration', items: ['LangGraph 0.1+', 'LangChain 0.2+', 'Python 3.11+'] },
              { label: 'LLM Providers', items: ['Ollama (free/local)', 'OpenAI GPT-4o', 'DeepSeek API'] },
              { label: 'Databases', items: ['Neo4j 5.20 + APOC', 'PostgreSQL + pgvector', 'SQLite (history)'] },
              { label: 'Analysis', items: ['Tree-sitter (AST)', 'Regex fallback', 'Big-O detection'] },
              { label: 'API / Deploy', items: ['FastAPI + uvicorn', 'Render (backend)', 'Vercel (frontend)'] },
              { label: 'Frontend', items: ['React 18 + Vite', 'Fraunces + Geist Mono', 'Zero dependencies'] },
            ].map(({ label, items }) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>{label}</div>
                {items.map(item => (
                  <div key={item} style={{ fontSize: 13.5, color: 'var(--ink-soft)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--forest)', flexShrink: 0, opacity: 0.5 }} />
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
