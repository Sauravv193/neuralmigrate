/**
 * algorithms.cpp
 * Common sorting and graph algorithms in C++17.
 * Part of the NeuralMigrate pre-ingested knowledge base corpus.
 */
#include <vector>
#include <queue>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <functional>
#include <limits>
#include <stdexcept>

// ─── Sorting algorithms ───────────────────────────────────────────────────────

/**
 * Bubble sort — O(n²) time, O(1) space.
 * Stable. Good for nearly-sorted inputs.
 */
void bubbleSort(std::vector<int>& arr) {
    int n = static_cast<int>(arr.size());
    for (int i = 0; i < n - 1; ++i) {
        bool swapped = false;
        for (int j = 0; j < n - i - 1; ++j) {
            if (arr[j] > arr[j + 1]) {
                std::swap(arr[j], arr[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;  // already sorted
    }
}

/**
 * Merge sort — O(n log n) time, O(n) space.
 * Stable. Preferred for linked lists.
 */
void merge(std::vector<int>& arr, int lo, int mid, int hi) {
    std::vector<int> left(arr.begin() + lo, arr.begin() + mid + 1);
    std::vector<int> right(arr.begin() + mid + 1, arr.begin() + hi + 1);
    int i = 0, j = 0, k = lo;
    while (i < (int)left.size() && j < (int)right.size())
        arr[k++] = left[i] <= right[j] ? left[i++] : right[j++];
    while (i < (int)left.size())  arr[k++] = left[i++];
    while (j < (int)right.size()) arr[k++] = right[j++];
}

void mergeSort(std::vector<int>& arr, int lo, int hi) {
    if (lo >= hi) return;
    int mid = lo + (hi - lo) / 2;
    mergeSort(arr, lo, mid);
    mergeSort(arr, mid + 1, hi);
    merge(arr, lo, mid, hi);
}

/**
 * Quick sort — O(n log n) average, O(n²) worst.
 * In-place. Not stable. Fastest in practice for random data.
 */
int partition(std::vector<int>& arr, int lo, int hi) {
    int pivot = arr[hi];
    int i = lo - 1;
    for (int j = lo; j < hi; ++j)
        if (arr[j] <= pivot) std::swap(arr[++i], arr[j]);
    std::swap(arr[i + 1], arr[hi]);
    return i + 1;
}

void quickSort(std::vector<int>& arr, int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(arr, lo, hi);
    quickSort(arr, lo, p - 1);
    quickSort(arr, p + 1, hi);
}

// ─── Search algorithms ────────────────────────────────────────────────────────

/**
 * Binary search — O(log n) time, O(1) space.
 * Requires sorted input. Returns index or -1.
 */
int binarySearch(const std::vector<int>& arr, int target) {
    int lo = 0, hi = static_cast<int>(arr.size()) - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if      (arr[mid] == target) return mid;
        else if (arr[mid] < target)  lo = mid + 1;
        else                         hi = mid - 1;
    }
    return -1;
}

// ─── Graph algorithms ─────────────────────────────────────────────────────────

using Graph = std::unordered_map<int, std::vector<int>>;

/**
 * Breadth-first search.
 * Returns visited nodes in BFS order.
 * O(V + E) time and space.
 */
std::vector<int> bfs(const Graph& graph, int start) {
    std::vector<int> order;
    std::unordered_set<int> visited;
    std::queue<int> q;

    q.push(start);
    visited.insert(start);

    while (!q.empty()) {
        int node = q.front(); q.pop();
        order.push_back(node);
        if (graph.count(node)) {
            for (int nb : graph.at(node)) {
                if (!visited.count(nb)) {
                    visited.insert(nb);
                    q.push(nb);
                }
            }
        }
    }
    return order;
}

/**
 * Depth-first search (iterative).
 * Returns visited nodes in DFS order.
 * O(V + E) time and space.
 */
std::vector<int> dfs(const Graph& graph, int start) {
    std::vector<int> order;
    std::unordered_set<int> visited;
    std::vector<int> stack = {start};

    while (!stack.empty()) {
        int node = stack.back(); stack.pop_back();
        if (visited.count(node)) continue;
        visited.insert(node);
        order.push_back(node);
        if (graph.count(node)) {
            for (auto it = graph.at(node).rbegin(); it != graph.at(node).rend(); ++it)
                if (!visited.count(*it)) stack.push_back(*it);
        }
    }
    return order;
}

/**
 * Dijkstra's shortest path.
 * O((V + E) log V) with binary heap.
 * Returns distance map from source to all reachable nodes.
 */
using WeightedGraph = std::unordered_map<int, std::vector<std::pair<int,int>>>;

std::unordered_map<int,int> dijkstra(const WeightedGraph& graph, int src) {
    std::unordered_map<int,int> dist;
    using P = std::pair<int,int>;  // {cost, node}
    std::priority_queue<P, std::vector<P>, std::greater<P>> pq;

    dist[src] = 0;
    pq.push({0, src});

    while (!pq.empty()) {
        auto [cost, u] = pq.top(); pq.pop();
        if (cost > dist[u]) continue;
        if (!graph.count(u)) continue;
        for (auto [v, w] : graph.at(u)) {
            int nd = dist[u] + w;
            if (!dist.count(v) || nd < dist[v]) {
                dist[v] = nd;
                pq.push({nd, v});
            }
        }
    }
    return dist;
}

// ─── Dynamic programming ──────────────────────────────────────────────────────

/**
 * 0/1 Knapsack problem.
 * O(n * W) time and space.
 * Returns maximum value achievable with given weight capacity.
 */
int knapsack(const std::vector<int>& weights,
             const std::vector<int>& values,
             int capacity) {
    int n = static_cast<int>(weights.size());
    std::vector<std::vector<int>> dp(n + 1, std::vector<int>(capacity + 1, 0));
    for (int i = 1; i <= n; ++i)
        for (int w = 0; w <= capacity; ++w) {
            dp[i][w] = dp[i-1][w];
            if (weights[i-1] <= w)
                dp[i][w] = std::max(dp[i][w], dp[i-1][w - weights[i-1]] + values[i-1]);
        }
    return dp[n][capacity];
}

/**
 * Longest Common Subsequence.
 * O(m * n) time and space.
 */
int lcs(const std::string& a, const std::string& b) {
    int m = static_cast<int>(a.size()), n = static_cast<int>(b.size());
    std::vector<std::vector<int>> dp(m + 1, std::vector<int>(n + 1, 0));
    for (int i = 1; i <= m; ++i)
        for (int j = 1; j <= n; ++j)
            dp[i][j] = (a[i-1] == b[j-1])
                ? dp[i-1][j-1] + 1
                : std::max(dp[i-1][j], dp[i][j-1]);
    return dp[m][n];
}

/**
 * Coin change — minimum coins to make amount.
 * O(amount * coins.size()) time and space.
 * Returns -1 if impossible.
 */
int coinChange(const std::vector<int>& coins, int amount) {
    const int INF = amount + 1;
    std::vector<int> dp(amount + 1, INF);
    dp[0] = 0;
    for (int i = 1; i <= amount; ++i)
        for (int c : coins)
            if (c <= i && dp[i - c] + 1 < dp[i])
                dp[i] = dp[i - c] + 1;
    return dp[amount] >= INF ? -1 : dp[amount];
}
