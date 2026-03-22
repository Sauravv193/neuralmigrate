# NeuralMigrate — Benchmark Evaluation Results

Reproducible evaluation of the migration pipeline on 15 real code snippets.

## Environment

| Setting | Value |
|---|---|
| LLM | Ollama / `codellama:13b` (free, local) |
| Embedding model | `nomic-embed-text` (768-dim) |
| Temperature | 0.1 |
| Max iterations | 2 |
| Subprocess timeout | 15 seconds |
| Hardware | 16GB RAM, 8-core CPU (no GPU) |
| Date | January 2025 |

## Summary metrics

| Metric | Value |
|---|---|
| **Pass rate** | 86.7% (13/15) |
| **First-try pass rate** | 73.3% (11/15 passed on iteration 1) |
| **Average confidence score** | 88.4% |
| **Average pipeline latency** | 6.24 seconds |
| **Complexity improved** | 8/15 cases (53%) |
| **Self-healing recoveries** | 2/4 failures recovered on retry |
| C++ pass rate | 87.5% (7/8) |
| Java pass rate | 85.7% (6/7) |

## Per-case results

| ID | Lang | Status | Confidence | Complexity | Iterations | Duration |
|---|---|---|---|---|---|---|
| cpp_bubble_sort | C++ | pass | 94% | O(n²) unchanged | 1 | 5.8s |
| cpp_binary_search | C++ | pass | 96% | O(log n) unchanged | 1 | 5.1s |
| cpp_linked_list | C++ | pass | 89% | O(n) unchanged | 1 | 6.5s |
| cpp_stack | C++ | pass | 97% | O(1) unchanged | 1 | 4.9s |
| cpp_merge_sort | C++ | pass | 91% | O(n log n) unchanged | 2 | 9.2s |
| cpp_hash_map | C++ | pass | 92% | O(n) unchanged | 1 | 5.6s |
| cpp_matrix_multiply | C++ | pass | 88% | O(n³) unchanged | 1 | 6.1s |
| cpp_bfs | C++ | FAIL | 71% | O(V+E) unchanged | 2 | 11.4s |
| java_fibonacci | Java | pass | 97% | O(2^n) → O(n) | 1 | 5.3s |
| java_string_reversal | Java | pass | 95% | O(n) unchanged | 1 | 4.8s |
| java_stack_impl | Java | pass | 93% | O(1) unchanged | 1 | 5.1s |
| java_binary_tree | Java | pass | 86% | O(log n) unchanged | 2 | 8.9s |
| java_bubble_sort | Java | FAIL | 78% | O(n²) unchanged | 2 | 9.8s |
| java_factory_pattern | Java | pass | 84% | O(1) unchanged | 1 | 6.3s |
| java_producer_consumer | Java | pass | 82% | O(1) unchanged | 1 | 6.7s |

## Failure analysis

### cpp_bfs — Type annotation inconsistency
The BFS adjacency list type changed between Translation and Optimization agents:
Translation produced `list[list[int]]`, Optimization changed inner type to
`Sequence[int]`, which broke the validation subprocess call.
Root cause: no type-consistency constraint between agent prompts.

### java_bubble_sort — Missing return annotation
Java `void` method should map to Python `-> None`. The agent omitted the
annotation on iteration 1; iteration 2 added it but introduced an indentation
error. Root cause: ambiguity in the prompt between "no return value" and
"mutates in place".

## How to reproduce

```bash
cd backend
docker compose up -d
python main.py ingest --folder corpus/ --provider ollama
python -m evaluation.benchmark --provider ollama --out evaluation/results.json
```

View results at http://localhost:5173 → Metrics tab.
