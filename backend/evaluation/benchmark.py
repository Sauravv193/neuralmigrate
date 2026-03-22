"""
evaluation/benchmark.py
Run the migration pipeline on a fixed benchmark corpus and record results.

Usage:
    python -m evaluation.benchmark --provider ollama
    python -m evaluation.benchmark --provider openai --out results.json

Uses Ollama (free, local) by default. Switch to openai if you have credits.
Generates a results JSON that powers the Metrics page on the frontend.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

# Add parent to path when run as a module
sys.path.insert(0, str(Path(__file__).parent.parent))

logger = logging.getLogger("benchmark")
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")

# ─── Benchmark corpus (15 cases: 8 C++, 7 Java) ──────────────────────────────
CORPUS = [
    {
        "id": "cpp_bubble_sort",
        "language": "cpp",
        "description": "Classic bubble sort — O(n²)",
        "source": """\
#include <vector>
void bubbleSort(std::vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n-1; i++)
        for (int j = 0; j < n-i-1; j++)
            if (arr[j] > arr[j+1])
                std::swap(arr[j], arr[j+1]);
}""",
        "expected_complexity_class": "quadratic",
    },
    {
        "id": "cpp_binary_search",
        "language": "cpp",
        "description": "Binary search — O(log n)",
        "source": """\
#include <vector>
int binarySearch(std::vector<int>& arr, int target) {
    int lo = 0, hi = arr.size()-1;
    while (lo <= hi) {
        int mid = lo + (hi-lo)/2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) lo = mid+1;
        else hi = mid-1;
    }
    return -1;
}""",
        "expected_complexity_class": "logarithmic",
    },
    {
        "id": "cpp_linked_list",
        "language": "cpp",
        "description": "Singly linked list insert",
        "source": """\
struct Node { int data; Node* next; };
class LinkedList {
    Node* head = nullptr;
public:
    void insert(int val) {
        Node* n = new Node{val, head};
        head = n;
    }
    int size() {
        int c = 0;
        for (Node* n = head; n; n = n->next) c++;
        return c;
    }
};""",
        "expected_complexity_class": "linear",
    },
    {
        "id": "cpp_stack",
        "language": "cpp",
        "description": "Stack using vector",
        "source": """\
#include <vector>
#include <stdexcept>
class Stack {
    std::vector<int> data;
public:
    void push(int v) { data.push_back(v); }
    int pop() {
        if (data.empty()) throw std::runtime_error("empty");
        int v = data.back(); data.pop_back(); return v;
    }
    bool empty() const { return data.empty(); }
    int size()   const { return data.size(); }
};""",
        "expected_complexity_class": "constant",
    },
    {
        "id": "cpp_merge_sort",
        "language": "cpp",
        "description": "Merge sort — O(n log n)",
        "source": """\
#include <vector>
void merge(std::vector<int>& a, int l, int m, int r) {
    std::vector<int> L(a.begin()+l, a.begin()+m+1);
    std::vector<int> R(a.begin()+m+1, a.begin()+r+1);
    int i=0, j=0, k=l;
    while (i<L.size() && j<R.size())
        a[k++] = L[i]<=R[j] ? L[i++] : R[j++];
    while (i<L.size()) a[k++]=L[i++];
    while (j<R.size()) a[k++]=R[j++];
}
void mergeSort(std::vector<int>& a, int l, int r) {
    if (l>=r) return;
    int m=(l+r)/2;
    mergeSort(a,l,m); mergeSort(a,m+1,r); merge(a,l,m,r);
}""",
        "expected_complexity_class": "linearithmic",
    },
    {
        "id": "cpp_hash_map",
        "language": "cpp",
        "description": "Simple frequency counter using unordered_map",
        "source": """\
#include <unordered_map>
#include <vector>
std::unordered_map<int,int> frequency(std::vector<int>& nums) {
    std::unordered_map<int,int> freq;
    for (int n : nums) freq[n]++;
    return freq;
}
int mostCommon(std::vector<int>& nums) {
    auto freq = frequency(nums);
    int best = -1, bestCount = 0;
    for (auto& p : freq)
        if (p.second > bestCount) { best=p.first; bestCount=p.second; }
    return best;
}""",
        "expected_complexity_class": "linear",
    },
    {
        "id": "cpp_matrix_multiply",
        "language": "cpp",
        "description": "Matrix multiplication — O(n³)",
        "source": """\
#include <vector>
using Matrix = std::vector<std::vector<double>>;
Matrix multiply(const Matrix& A, const Matrix& B) {
    int n = A.size(), m = B[0].size(), p = B.size();
    Matrix C(n, std::vector<double>(m, 0));
    for (int i=0;i<n;i++)
        for (int j=0;j<m;j++)
            for (int k=0;k<p;k++)
                C[i][j] += A[i][k]*B[k][j];
    return C;
}""",
        "expected_complexity_class": "cubic",
    },
    {
        "id": "cpp_bfs",
        "language": "cpp",
        "description": "Breadth-first search on adjacency list graph",
        "source": """\
#include <vector>
#include <queue>
#include <unordered_set>
std::vector<int> bfs(std::vector<std::vector<int>>& graph, int start) {
    std::vector<int> order;
    std::unordered_set<int> visited;
    std::queue<int> q;
    q.push(start); visited.insert(start);
    while (!q.empty()) {
        int node = q.front(); q.pop();
        order.push_back(node);
        for (int nb : graph[node])
            if (!visited.count(nb)) { visited.insert(nb); q.push(nb); }
    }
    return order;
}""",
        "expected_complexity_class": "linear",
    },
    {
        "id": "java_fibonacci",
        "language": "java",
        "description": "Fibonacci with ArrayList memoisation — O(2^n) naive",
        "source": """\
import java.util.ArrayList;
public class Fibonacci {
    private ArrayList<Long> memo = new ArrayList<>();
    public Fibonacci() { memo.add(0L); memo.add(1L); }
    public long compute(int n) {
        if (n < memo.size()) return memo.get(n);
        long result = compute(n-1) + compute(n-2);
        memo.add(result); return result;
    }
}""",
        "expected_complexity_class": "linear_after_opt",
    },
    {
        "id": "java_string_reversal",
        "language": "java",
        "description": "String reversal and palindrome check",
        "source": """\
public class StringUtils {
    public static String reverse(String s) {
        StringBuilder sb = new StringBuilder();
        for (int i = s.length()-1; i >= 0; i--)
            sb.append(s.charAt(i));
        return sb.toString();
    }
    public static boolean isPalindrome(String s) {
        return s.equals(reverse(s));
    }
}""",
        "expected_complexity_class": "linear",
    },
    {
        "id": "java_stack_impl",
        "language": "java",
        "description": "Generic stack using ArrayList",
        "source": """\
import java.util.ArrayList;
public class Stack<T> {
    private ArrayList<T> data = new ArrayList<>();
    public void push(T item) { data.add(item); }
    public T pop() {
        if (data.isEmpty()) throw new RuntimeException("Stack is empty");
        return data.remove(data.size()-1);
    }
    public T peek() { return data.get(data.size()-1); }
    public boolean isEmpty() { return data.isEmpty(); }
    public int size() { return data.size(); }
}""",
        "expected_complexity_class": "constant",
    },
    {
        "id": "java_binary_tree",
        "language": "java",
        "description": "Binary search tree insert and search",
        "source": """\
public class BST {
    private int val;
    private BST left, right;
    public BST(int val) { this.val = val; }
    public void insert(int v) {
        if (v < val) { if (left==null) left=new BST(v); else left.insert(v); }
        else          { if (right==null) right=new BST(v); else right.insert(v); }
    }
    public boolean search(int v) {
        if (v == val) return true;
        if (v < val)  return left != null && left.search(v);
        return right != null && right.search(v);
    }
}""",
        "expected_complexity_class": "logarithmic",
    },
    {
        "id": "java_bubble_sort",
        "language": "java",
        "description": "Bubble sort on int array",
        "source": """\
public class Sorter {
    public static void bubbleSort(int[] arr) {
        int n = arr.length;
        for (int i=0; i<n-1; i++)
            for (int j=0; j<n-i-1; j++)
                if (arr[j] > arr[j+1]) {
                    int tmp = arr[j]; arr[j]=arr[j+1]; arr[j+1]=tmp;
                }
    }
}""",
        "expected_complexity_class": "quadratic",
    },
    {
        "id": "java_factory_pattern",
        "language": "java",
        "description": "Factory method design pattern",
        "source": """\
public abstract class Shape {
    public abstract double area();
    public static Shape create(String type, double size) {
        switch (type) {
            case "circle":   return new Circle(size);
            case "square":   return new Square(size);
            default: throw new IllegalArgumentException("Unknown: "+type);
        }
    }
}
class Circle extends Shape {
    private double r;
    Circle(double r) { this.r = r; }
    public double area() { return Math.PI * r * r; }
}
class Square extends Shape {
    private double s;
    Square(double s) { this.s = s; }
    public double area() { return s * s; }
}""",
        "expected_complexity_class": "constant",
    },
    {
        "id": "java_producer_consumer",
        "language": "java",
        "description": "Producer-consumer with blocking queue",
        "source": """\
import java.util.LinkedList;
import java.util.Queue;
public class Buffer {
    private Queue<Integer> queue = new LinkedList<>();
    private int maxSize;
    public Buffer(int maxSize) { this.maxSize = maxSize; }
    public synchronized void produce(int item) throws InterruptedException {
        while (queue.size() == maxSize) wait();
        queue.add(item);
        notifyAll();
    }
    public synchronized int consume() throws InterruptedException {
        while (queue.isEmpty()) wait();
        int item = queue.poll();
        notifyAll();
        return item;
    }
}""",
        "expected_complexity_class": "constant",
    },
]


def run_benchmark(provider: str = "ollama", out_path: str = "evaluation/results.json") -> dict:
    """
    Run the full migration pipeline on every corpus entry.
    Records pass/fail, confidence, complexity change, duration.
    Saves results JSON and returns summary metrics.
    """
    from graph_engine import MigrationGraph, build_embedding_client, build_llm
    from knowledge_base import KnowledgeBase
    from history import init_db, save_run

    init_db()
    results = []
    passed = failed = 0

    logger.info("Starting benchmark: %d cases, provider=%s", len(CORPUS), provider)

    try:
        kb = KnowledgeBase()
        kb.bootstrap()
    except Exception as e:
        logger.warning("KB unavailable (%s) — running without retrieval context", e)
        kb = None

    try:
        llm = build_llm(provider=provider)
        embed = build_embedding_client(provider=provider)
    except Exception as e:
        logger.error("Failed to build LLM: %s", e)
        return {}

    for i, case in enumerate(CORPUS):
        logger.info("[%d/%d] %s — %s", i+1, len(CORPUS), case["id"], case["description"])
        start = time.perf_counter()

        try:
            graph = MigrationGraph(
                kb=kb,
                llm=llm,
                embedding_client=embed,
                max_iterations=2,
            )
            state = graph.run(
                source_code=case["source"],
                source_language=case["language"],
                file_path=f"benchmark/{case['id']}.{case['language']}",
            )
        except Exception as exc:
            logger.error("  CRASH: %s", exc)
            state = {"status": "failed", "errors": [str(exc)]}

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        trans  = state.get("translation_result", {})
        opt    = state.get("optimization_result", {})
        val    = state.get("validation_result", {})
        status = state.get("status", "failed")
        conf   = float(trans.get("confidence_score", 0.0))
        iters  = int(state.get("iteration", 1))
        before = opt.get("original_complexity", "")
        after  = opt.get("optimized_complexity", "")

        is_pass = (status == "validated")
        if is_pass: passed += 1
        else:       failed += 1

        entry = {
            "id":                   case["id"],
            "language":             case["language"],
            "description":          case["description"],
            "expected_complexity":  case["expected_complexity_class"],
            "status":               status,
            "passed":               is_pass,
            "confidence_score":     conf,
            "confidence_pct":       round(conf * 100, 1),
            "iterations":           iters,
            "original_complexity":  before,
            "optimized_complexity": after,
            "complexity_improved":  bool(before and after and before != after),
            "validation_outcome":   val.get("outcome", "fail"),
            "duration_ms":          elapsed_ms,
            "errors":               state.get("errors", []),
        }
        results.append(entry)

        # Persist to SQLite history
        try:
            src_lines = case["source"].count("\n") + 1
            out_code  = opt.get("optimized_code", trans.get("translated_code", ""))
            out_lines = out_code.count("\n") + 1
            ctx       = state.get("retrieved_context", {})
            save_run(
                file_path=f"benchmark/{case['id']}",
                source_language=case["language"],
                status=status,
                confidence_score=conf,
                iterations=iters,
                original_complexity=before,
                optimized_complexity=after,
                validation_outcome=val.get("outcome", ""),
                source_lines=src_lines,
                output_lines=out_lines,
                duration_ms=elapsed_ms,
                entities_extracted=len(state.get("parsed_entities", [])),
                vector_results=len(ctx.get("vector_results", [])),
                graph_results=len(ctx.get("graph_results", [])),
                error_count=len(state.get("errors", [])),
                source_code=case["source"],
                output_code=out_code[:4000],
                explanation=trans.get("explanation", ""),
                complexity_report=opt.get("optimization_notes", ""),
            )
        except Exception as e:
            logger.warning("  History save failed: %s", e)

        logger.info("  %s  conf=%.0f%%  %s→%s  %dms",
                    "✓" if is_pass else "✗",
                    conf * 100, before or "?", after or "?", elapsed_ms)

    # Summary
    total = len(CORPUS)
    summary = {
        "total":             total,
        "passed":            passed,
        "failed":            failed,
        "pass_rate_pct":     round(passed / total * 100, 1),
        "avg_confidence_pct": round(sum(r["confidence_pct"] for r in results) / total, 1),
        "avg_duration_ms":   round(sum(r["duration_ms"] for r in results) / total),
        "complexity_improved": sum(1 for r in results if r["complexity_improved"]),
        "first_try_pass":    sum(1 for r in results if r["passed"] and r["iterations"] == 1),
        "provider":          provider,
        "cases":             results,
    }

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(__import__("json").dumps(summary, indent=2))
    logger.info("Results saved → %s", out_path)
    logger.info("SUMMARY: %d/%d passed (%.1f%%)  avg_conf=%.1f%%",
                passed, total, summary["pass_rate_pct"], summary["avg_confidence_pct"])

    if kb:
        kb.close()
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run NeuralMigrate benchmark")
    parser.add_argument("--provider", default="ollama", choices=["ollama", "openai", "deepseek"])
    parser.add_argument("--out", default="evaluation/results.json")
    args = parser.parse_args()
    run_benchmark(provider=args.provider, out_path=args.out)
