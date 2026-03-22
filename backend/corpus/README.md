# Knowledge Base Corpus

Pre-built source files for populating the NeuralMigrate knowledge graph.
Ingest these **before** running the demo or benchmark so the GraphRAG
retrieval has real patterns to work from.

## Quick ingest

```bash
cd backend
python main.py ingest --folder corpus/ --provider ollama
```

## What's included (~1,500 lines across 7 files)

### C++ (4 files)
| File | Contents | Lines |
|---|---|---|
| `cpp/algorithms.cpp` | Bubble/merge/quick sort, binary search, matrix multiply | 229 |
| `cpp/data_structures.h` | Stack, queue, linked list, hash map, min-heap | 262 |
| `cpp/graph_algorithms.cpp` | BFS, DFS, Dijkstra, cycle detection, topological sort, Union-Find | ~170 |
| `cpp/design_patterns.cpp` | Singleton, observer, LRU cache, strategy, object pool | ~170 |

### Java (3 files)
| File | Contents | Lines |
|---|---|---|
| `java/DataStructures.java` | Stack, queue, linked list, BST, generic pair | 228 |
| `java/Algorithms.java` | Binary search, sliding window, LCS, knapsack, BFS, palindrome | ~160 |
| `java/ConcurrentPatterns.java` | AtomicCounter, BoundedQueue, RW-lock cache, worker pool | ~140 |

## Why this corpus matters

Without a populated corpus the Context Agent returns 0 results and the
GraphRAG advantage disappears — translation becomes a plain LLM call.

With this corpus, the system finds patterns like:
- "bubbleSort uses swap → Python uses tuple swap `a, b = b, a`"
- "LRU cache uses linked list + hash map → Python uses `functools.lru_cache`"
- "AtomicInteger → Python `threading.Lock` or `multiprocessing.Value`"

## Adding your own codebase

```bash
python main.py ingest --folder /path/to/your/legacy_project --provider ollama
```

Supported: `.cpp` `.cc` `.cxx` `.h` `.hpp` `.java`
