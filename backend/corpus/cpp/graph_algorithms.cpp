/**
 * graph_algorithms.cpp
 * Graph traversal and shortest path algorithms — C++17.
 * Part of the NeuralMigrate pre-ingested knowledge base corpus.
 * These patterns teach the Translation Agent how to handle
 * adjacency lists, priority queues, and graph state correctly.
 */
#include <vector>
#include <queue>
#include <unordered_map>
#include <unordered_set>
#include <limits>
#include <stdexcept>
#include <functional>

using Graph = std::vector<std::vector<int>>;
using WeightedGraph = std::vector<std::vector<std::pair<int,int>>>;

// ─── Breadth-First Search ─────────────────────────────────────────────────────

/**
 * BFS traversal — O(V+E) time, O(V) space.
 * Returns nodes in visit order from start.
 */
std::vector<int> bfs(const Graph& g, int start) {
    std::vector<int> order;
    std::unordered_set<int> visited;
    std::queue<int> q;
    q.push(start);
    visited.insert(start);
    while (!q.empty()) {
        int node = q.front(); q.pop();
        order.push_back(node);
        for (int nb : g[node]) {
            if (!visited.count(nb)) {
                visited.insert(nb);
                q.push(nb);
            }
        }
    }
    return order;
}

// ─── Depth-First Search ───────────────────────────────────────────────────────

/**
 * Iterative DFS — O(V+E) time, O(V) space.
 */
std::vector<int> dfs(const Graph& g, int start) {
    std::vector<int> order;
    std::unordered_set<int> visited;
    std::vector<int> stk = {start};
    while (!stk.empty()) {
        int node = stk.back(); stk.pop_back();
        if (visited.count(node)) continue;
        visited.insert(node);
        order.push_back(node);
        for (auto it = g[node].rbegin(); it != g[node].rend(); ++it)
            stk.push_back(*it);
    }
    return order;
}

// ─── Dijkstra's Shortest Path ─────────────────────────────────────────────────

/**
 * Dijkstra — O((V+E) log V) with min-heap.
 * Returns shortest distance from src to every node.
 * -1 means unreachable.
 */
std::vector<int> dijkstra(const WeightedGraph& g, int src) {
    int n = g.size();
    std::vector<int> dist(n, std::numeric_limits<int>::max());
    dist[src] = 0;
    // min-heap: (distance, node)
    std::priority_queue<std::pair<int,int>,
                        std::vector<std::pair<int,int>>,
                        std::greater<>> pq;
    pq.push({0, src});
    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;
        for (auto [v, w] : g[u]) {
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
    // Replace INT_MAX with -1 for unreachable nodes
    for (auto& d : dist) if (d == std::numeric_limits<int>::max()) d = -1;
    return dist;
}

// ─── Cycle Detection ─────────────────────────────────────────────────────────

/**
 * Detect cycle in directed graph using DFS coloring.
 * 0=unvisited, 1=in-stack, 2=done.
 * O(V+E) time.
 */
bool hasCycleHelper(const Graph& g, int node,
                    std::vector<int>& color) {
    color[node] = 1;
    for (int nb : g[node]) {
        if (color[nb] == 1) return true;
        if (color[nb] == 0 && hasCycleHelper(g, nb, color)) return true;
    }
    color[node] = 2;
    return false;
}

bool hasCycle(const Graph& g) {
    std::vector<int> color(g.size(), 0);
    for (int i = 0; i < (int)g.size(); i++)
        if (color[i] == 0 && hasCycleHelper(g, i, color)) return true;
    return false;
}

// ─── Topological Sort ─────────────────────────────────────────────────────────

/**
 * Kahn's algorithm — O(V+E).
 * Returns empty vector if graph has a cycle.
 */
std::vector<int> topologicalSort(const Graph& g) {
    int n = g.size();
    std::vector<int> indegree(n, 0);
    for (int u = 0; u < n; u++)
        for (int v : g[u]) indegree[v]++;

    std::queue<int> q;
    for (int i = 0; i < n; i++)
        if (indegree[i] == 0) q.push(i);

    std::vector<int> order;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        order.push_back(u);
        for (int v : g[u])
            if (--indegree[v] == 0) q.push(v);
    }
    if ((int)order.size() != n) return {}; // cycle detected
    return order;
}

// ─── Connected Components ─────────────────────────────────────────────────────

/**
 * Union-Find for undirected graph connected components — O(α(n)) per op.
 */
class UnionFind {
    std::vector<int> parent, rank_;
public:
    explicit UnionFind(int n) : parent(n), rank_(n, 0) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }
    bool unite(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return false;
        if (rank_[px] < rank_[py]) std::swap(px, py);
        parent[py] = px;
        if (rank_[px] == rank_[py]) rank_[px]++;
        return true;
    }
    bool connected(int x, int y) { return find(x) == find(y); }
    int componentCount() {
        std::unordered_set<int> roots;
        for (int i = 0; i < (int)parent.size(); i++) roots.insert(find(i));
        return roots.size();
    }
};
