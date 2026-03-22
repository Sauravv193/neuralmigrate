import { useState, useEffect, useRef } from 'react'

function Counter({ target, suffix = '', duration = 1400 }) {
  const [val, setVal] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) requestAnimationFrame(step)
    }
    setTimeout(() => requestAnimationFrame(step), 300)
  }, [target, duration])
  return <>{val}{suffix}</>
}

const FEATURES = [
  { icon: '◈', label: 'Hybrid GraphRAG Retrieval', desc: 'pgvector cosine search seeds Neo4j graph traversal. Two-stage retrieval surfaces patterns that vector search alone cannot find.', tag: 'Knowledge Graph', c: '#1C3A2F', bg: 'rgba(28,58,47,0.07)' },
  { icon: '⌥', label: 'Tree-sitter AST Parsing', desc: 'Full parse tree extraction for C++ and Java. Functions, classes, docstrings, and dependency graphs — all structured before translation begins.', tag: 'Static Analysis', c: '#7A4520', bg: 'rgba(200,112,26,0.08)' },
  { icon: '↻', label: 'Self-healing Feedback Loop', desc: 'When validation fails, the exact subprocess errors are injected back into the translation prompt. Each retry has concrete context — not a blind repeat.', tag: 'Feedback Loop', c: '#1C3A2F', bg: 'rgba(28,58,47,0.07)' },
  { icon: '∑', label: 'Big-O Complexity Analysis', desc: 'A dedicated agent detects Big-O before and after optimisation. Prefers bisect, heapq, lru_cache over hand-rolled loops.', tag: 'Big-O Aware', c: '#7A4520', bg: 'rgba(200,112,26,0.08)' },
  { icon: '⚿', label: 'Sandboxed Execution', desc: 'Generated code runs in a subprocess with a stripped env, captured I/O, and a 15-second hard timeout. No inherited secrets.', tag: 'Secure Sandbox', c: '#1C3A2F', bg: 'rgba(28,58,47,0.07)' },
  { icon: '⇄', label: 'Free LLM Support', desc: 'Works with local Ollama (CodeLlama, Mistral — completely free) or OpenAI/DeepSeek for cloud. One env variable to switch.', tag: 'Multi-LLM', c: '#7A4520', bg: 'rgba(200,112,26,0.08)' },
]

const STEPS = [
  { num:'01', label:'Context', sub:'AST parse + hybrid retrieval' },
  { num:'02', label:'Translate', sub:'C++/Java → Python 3.11' },
  { num:'03', label:'Optimise', sub:'Big-O analysis + refactor' },
  { num:'04', label:'Validate', sub:'Sandbox + auto-retry' },
]

export default function HomePage({ setPage }) {
  const [activeStep, setActiveStep] = useState(0)
  useEffect(() => { const t = setInterval(() => setActiveStep(s => (s+1)%4), 2200); return () => clearInterval(t) }, [])

  return (
    <div style={{ paddingTop: 58 }}>
      {/* HERO */}
      <section style={{ minHeight: '92vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', position:'relative', overflow:'hidden', background:'linear-gradient(180deg,var(--parchment) 0%,var(--cream) 100%)' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.35, backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'radial-gradient(ellipse,rgba(200,112,26,0.09) 0%,rgba(28,58,47,0.06) 50%,transparent 75%)', top:'50%', left:'50%', transform:'translate(-50%,-52%)', pointerEvents:'none' }} />

        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px 5px 10px', background:'var(--cream-dark)', border:'1px solid var(--border-strong)', borderRadius:100, marginBottom:36, animation:'fadeUp 0.55s ease both' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--forest)', animation:'pulse 2s ease-in-out infinite', display:'inline-block' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--forest)', fontWeight:500 }}>v1.0 — LangGraph · Neo4j · pgvector · Tree-sitter</span>
        </div>

        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(52px,8vw,96px)', fontWeight:700, lineHeight:1.0, letterSpacing:'-3px', textAlign:'center', color:'var(--ink)', marginBottom:28, maxWidth:900, animation:'fadeUp 0.55s 0.08s ease both' }}>
          Legacy code,{' '}
          <span style={{ fontStyle:'italic', color:'var(--forest)' }}>finally</span>
          <br />
          <span style={{ background:'linear-gradient(135deg,var(--amber) 0%,var(--rust) 70%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>migrated.</span>
        </h1>

        <p style={{ fontSize:19, color:'var(--ink-soft)', fontWeight:400, maxWidth:560, textAlign:'center', lineHeight:1.7, marginBottom:44, animation:'fadeUp 0.55s 0.16s ease both' }}>
          A four-agent LangGraph pipeline that translates C++ and Java to idiomatic Python 3.11+ — with graph-augmented retrieval, Big-O optimisation, and a self-healing validation loop.
        </p>

        <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', animation:'fadeUp 0.55s 0.24s ease both', marginBottom:72 }}>
          <button onClick={() => setPage('demo')} style={{ padding:'13px 28px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--forest) 0%,var(--forest-mid) 100%)', color:'var(--cream)', fontSize:15, fontWeight:600, fontFamily:'var(--font-body)', cursor:'pointer', boxShadow:'0 4px 20px rgba(28,58,47,0.3)', letterSpacing:'-0.2px', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(28,58,47,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 20px rgba(28,58,47,0.3)' }}>
            Run live demo →
          </button>
          <button onClick={() => setPage('metrics')} style={{ padding:'13px 28px', borderRadius:10, border:'1.5px solid var(--border-strong)', background:'transparent', color:'var(--ink-mid)', fontSize:15, fontWeight:500, fontFamily:'var(--font-body)', cursor:'pointer', letterSpacing:'-0.2px', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--cream-dark)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            View benchmark results
          </button>
        </div>

        {/* Pipeline stepper */}
        <div style={{ display:'flex', alignItems:'center', gap:0, background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:16, padding:6, boxShadow:'var(--shadow-md)', animation:'fadeUp 0.55s 0.32s ease both', maxWidth:680, width:'100%' }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ flex:1, display:'flex', alignItems:'center' }}>
              <div onClick={() => setActiveStep(i)} style={{ flex:1, padding:'13px 10px', borderRadius:11, cursor:'pointer', transition:'all 0.3s', background:activeStep===i?'var(--cream-dark)':'transparent', boxShadow:activeStep===i?'var(--shadow-sm)':'none', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:activeStep===i?'var(--forest)':'var(--ink-faint)', fontWeight:500, marginBottom:4, letterSpacing:'0.5px' }}>{step.num}</div>
                <div style={{ fontFamily:'var(--font-body)', fontSize:13, fontWeight:600, color:activeStep===i?'var(--ink)':'var(--ink-soft)', marginBottom:2, letterSpacing:'-0.1px' }}>{step.label}</div>
                <div style={{ fontSize:10.5, color:activeStep===i?'var(--ink-soft)':'var(--ink-faint)', fontFamily:'var(--font-mono)' }}>{step.sub}</div>
              </div>
              {i < 3 && <div style={{ width:1, height:32, background:'var(--border)', flexShrink:0 }} />}
            </div>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section style={{ background:'var(--forest)', padding:'0 40px' }}>
        <div style={{ maxWidth:960, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
          {[
            { n:86, s:'%', lbl:'benchmark pass rate' },
            { n:88, s:'%', lbl:'avg confidence score' },
            { n:15, s:'',  lbl:'benchmark test cases' },
            { n:8,  s:'',  lbl:'complexity improvements' },
          ].map(({ n, s, lbl }, i) => (
            <div key={i} style={{ padding:'36px 24px', textAlign:'center', borderRight:i<3?'1px solid rgba(245,240,232,0.12)':'none' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:42, fontWeight:700, lineHeight:1, color:'var(--cream)', letterSpacing:'-1.5px', marginBottom:6 }}>
                <Counter target={n} suffix={s} />
              </div>
              <div style={{ fontSize:13, color:'rgba(245,240,232,0.55)', fontFamily:'var(--font-body)' }}>{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding:'100px 40px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ marginBottom:56 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'2px', color:'var(--amber)', textTransform:'uppercase', marginBottom:14 }}>How it works</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(32px,4vw,50px)', fontWeight:700, letterSpacing:'-1.5px', color:'var(--ink)', lineHeight:1.1, marginBottom:16 }}>Four agents,<br />one coherent pipeline.</h2>
          <p style={{ fontSize:17, color:'var(--ink-soft)', maxWidth:500, fontWeight:400 }}>Each agent owns exactly one responsibility. LangGraph routes state between them — including routing failures back for automatic retry.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16 }}>
          {[
            { n:'01', icon:'◈', title:'Context Agent', desc:'Parses source via Tree-sitter AST. Runs hybrid retrieval — pgvector similarity first, then Neo4j relationship hops for related patterns.' },
            { n:'02', icon:'⟳', title:'Translation Agent', desc:'Converts to idiomatic Python 3.11+. On retry, receives the exact subprocess errors and suggestions from the validator.', accent:'var(--amber)' },
            { n:'03', icon:'∿', title:'Optimization Agent', desc:'Detects Big-O complexity. Replaces manual loops with bisect, heapq, lru_cache, and numpy where applicable.', accent:'var(--forest-mid)' },
            { n:'04', icon:'◎', title:'Validation Agent', desc:'Runs code in a subprocess sandbox. Sends errors + stdout to an LLM reviewer which writes actionable fix suggestions.', accent:'var(--rust)' },
          ].map(({ n, icon, title, desc, accent='var(--forest)' }, i) => (
            <div key={i} style={{ background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 24px', transition:'all 0.25s', position:'relative', overflow:'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='var(--shadow-lg)'; e.currentTarget.style.borderColor='var(--border-strong)' }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='var(--border)' }}>
              <div style={{ position:'absolute', top:20, right:20, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-faint)' }}>{n}</div>
              <div style={{ fontSize:26, marginBottom:16, color:accent }}>{icon}</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:600, color:'var(--ink)', marginBottom:10, letterSpacing:'-0.4px' }}>{title}</div>
              <div style={{ fontSize:13.5, color:'var(--ink-soft)', lineHeight:1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:16, padding:'14px 20px', background:'rgba(155,61,26,0.06)', border:'1px solid rgba(155,61,26,0.18)', borderRadius:12, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:15 }}>↩</span>
          <span style={{ fontSize:14, color:'var(--rust)', fontWeight:500 }}>Self-healing:</span>
          <span style={{ fontSize:14, color:'var(--ink-soft)' }}>Validation failure routes back to Translation Agent with the full error context — not a blind retry. Configurable up to 3 iterations.</span>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ background:'var(--cream)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'100px 40px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ marginBottom:56 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'2px', color:'var(--amber)', textTransform:'uppercase', marginBottom:14 }}>Capabilities</div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(30px,4vw,46px)', fontWeight:700, letterSpacing:'-1.5px', color:'var(--ink)', lineHeight:1.1 }}>Built for real codebases.</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:1, background:'var(--border)', borderRadius:18, overflow:'hidden', border:'1px solid var(--border)' }}>
            {FEATURES.map(({ icon, label, desc, tag, c, bg }) => (
              <div key={label} style={{ background:'var(--cream)', padding:'36px 30px', transition:'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--parchment)'}
                onMouseLeave={e => e.currentTarget.style.background='var(--cream)'}>
                <div style={{ width:44, height:44, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:18, color:c }}>{icon}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:600, color:'var(--ink)', marginBottom:10, letterSpacing:'-0.3px' }}>{label}</div>
                <div style={{ fontSize:14, color:'var(--ink-soft)', lineHeight:1.7, marginBottom:14 }}>{desc}</div>
                <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:100, fontSize:11, fontFamily:'var(--font-mono)', background:bg, color:c, border:`1px solid ${c}22` }}>{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TERMINAL */}
      <section style={{ padding:'100px 40px', maxWidth:860, margin:'0 auto' }}>
        <div style={{ marginBottom:40 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'2px', color:'var(--amber)', textTransform:'uppercase', marginBottom:14 }}>Quick start</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(28px,3.5vw,42px)', fontWeight:700, letterSpacing:'-1.5px', color:'var(--ink)', lineHeight:1.1 }}>Up in three commands.</h2>
        </div>
        <div style={{ background:'var(--ink)', borderRadius:18, overflow:'hidden', boxShadow:'var(--shadow-lg)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)' }}>
            {['#FF605C','#FFBD44','#00CA4E'].map((c,i) => <div key={i} style={{ width:12, height:12, borderRadius:'50%', background:c }} />)}
            <span style={{ marginLeft:8, fontSize:12, color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-mono)' }}>Terminal</span>
          </div>
          <div style={{ padding:'24px 30px', fontFamily:'var(--font-mono)', fontSize:13, lineHeight:2 }}>
            {[
              { c:'rgba(255,255,255,0.3)', t:'# 1. Start databases (Neo4j + PostgreSQL)' },
              { c:'#7EC8A4', t:'docker compose up -d' },
              { c:'rgba(255,255,255,0.05)', t:'' },
              { c:'rgba(255,255,255,0.3)', t:'# 2. Ingest your legacy codebase' },
              { c:'#7EC8A4', t:'python main.py ingest --folder ./legacy_codebase' },
              { c:'rgba(255,255,255,0.05)', t:'' },
              { c:'rgba(255,255,255,0.3)', t:'# 3. Migrate a file  (uses Ollama — free, local)' },
              { c:'#7EC8A4', t:'python main.py migrate --file Sorter.cpp --output sorter.py' },
              { c:'rgba(255,255,255,0.05)', t:'' },
              { c:'#E8D4B0', t:'──────────────────────────────────────────────' },
              { c:'#A8D8A0', t:'Status          : validated' },
              { c:'#A8D8A0', t:'Confidence      : 94%' },
              { c:'#F0C878', t:'Complexity (in) : O(n²)' },
              { c:'#A8D8A0', t:'Complexity (out): O(n log n)' },
              { c:'#A8D8A0', t:'Validation      : pass ✓  (1 iteration)' },
            ].map(({ c, t }, i) => <div key={i} style={{ color:c }}>{t || ' '}</div>)}
          </div>
        </div>
        <div style={{ marginTop:28, display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
          <button onClick={() => setPage('docs')} style={{ padding:'10px 22px', borderRadius:10, border:'1.5px solid var(--border-strong)', background:'transparent', color:'var(--ink-mid)', fontSize:14, fontWeight:500, fontFamily:'var(--font-body)', cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--cream-dark)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            Read the docs →
          </button>
          <button onClick={() => setPage('metrics')} style={{ padding:'10px 22px', borderRadius:10, border:'1.5px solid rgba(28,58,47,0.25)', background:'rgba(28,58,47,0.06)', color:'var(--forest)', fontSize:14, fontWeight:500, fontFamily:'var(--font-body)', cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(28,58,47,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(28,58,47,0.06)'}>
            View benchmark metrics →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:'1px solid var(--border)', padding:'36px 40px', display:'flex', alignItems:'center', justifyContent:'space-between', maxWidth:1100, margin:'0 auto', flexWrap:'wrap', gap:12 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:600, color:'var(--ink-soft)' }}>NeuralMigrate</div>
        <div style={{ fontSize:12, color:'var(--ink-faint)', fontFamily:'var(--font-mono)' }}>LangGraph · Neo4j · pgvector · Tree-sitter · FastAPI · React</div>
        <div style={{ fontSize:12, color:'var(--ink-faint)', fontFamily:'var(--font-body)' }}>Final Year Project — SDE Track</div>
      </footer>
    </div>
  )
}
