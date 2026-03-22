/**
 * Algorithms.java
 * Sorting, searching, and dynamic programming in Java 17.
 * Part of the NeuralMigrate pre-ingested knowledge base corpus.
 */
import java.util.*;

public class Algorithms {

    // ─── Sorting ──────────────────────────────────────────────────────────────

    /**
     * Bubble sort with early-exit optimisation.
     * Time: O(n²) worst case, O(n) best case (sorted input).
     * Space: O(1). Stable.
     */
    public static void bubbleSort(int[] arr) {
        int n = arr.length;
        for (int i = 0; i < n - 1; i++) {
            boolean swapped = false;
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int tmp  = arr[j];
                    arr[j]   = arr[j + 1];
                    arr[j+1] = tmp;
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
    }

    /**
     * Merge sort.
     * Time: O(n log n). Space: O(n). Stable.
     */
    public static void mergeSort(int[] arr, int lo, int hi) {
        if (lo >= hi) return;
        int mid = lo + (hi - lo) / 2;
        mergeSort(arr, lo, mid);
        mergeSort(arr, mid + 1, hi);
        merge(arr, lo, mid, hi);
    }

    private static void merge(int[] arr, int lo, int mid, int hi) {
        int[] tmp = Arrays.copyOfRange(arr, lo, hi + 1);
        int i = 0, j = mid - lo + 1, k = lo;
        while (i <= mid - lo && j <= hi - lo)
            arr[k++] = tmp[i] <= tmp[j] ? tmp[i++] : tmp[j++];
        while (i <= mid - lo) arr[k++] = tmp[i++];
        while (j <= hi - lo)  arr[k++] = tmp[j++];
    }

    /**
     * Quick sort with random pivot.
     * Time: O(n log n) average, O(n²) worst. Space: O(log n). Not stable.
     */
    public static void quickSort(int[] arr, int lo, int hi) {
        if (lo >= hi) return;
        int p = partition(arr, lo, hi);
        quickSort(arr, lo, p - 1);
        quickSort(arr, p + 1, hi);
    }

    private static int partition(int[] arr, int lo, int hi) {
        int pivot = arr[hi];
        int i = lo - 1;
        for (int j = lo; j < hi; j++)
            if (arr[j] <= pivot) { i++; int t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
        int t = arr[i+1]; arr[i+1] = arr[hi]; arr[hi] = t;
        return i + 1;
    }

    // ─── Search ───────────────────────────────────────────────────────────────

    /**
     * Binary search on sorted array.
     * Time: O(log n). Space: O(1).
     * Returns index or -1 if not found.
     */
    public static int binarySearch(int[] arr, int target) {
        int lo = 0, hi = arr.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if      (arr[mid] == target) return mid;
            else if (arr[mid] < target)  lo = mid + 1;
            else                         hi = mid - 1;
        }
        return -1;
    }

    // ─── Dynamic programming ──────────────────────────────────────────────────

    /**
     * Fibonacci with bottom-up DP.
     * Time: O(n). Space: O(1).
     */
    public static long fibonacci(int n) {
        if (n < 0) throw new IllegalArgumentException("n must be >= 0");
        if (n < 2) return n;
        long a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            long c = a + b; a = b; b = c;
        }
        return b;
    }

    /**
     * 0/1 Knapsack.
     * Time: O(n * W). Space: O(n * W).
     */
    public static int knapsack(int[] weights, int[] values, int capacity) {
        int n = weights.length;
        int[][] dp = new int[n + 1][capacity + 1];
        for (int i = 1; i <= n; i++)
            for (int w = 0; w <= capacity; w++) {
                dp[i][w] = dp[i-1][w];
                if (weights[i-1] <= w)
                    dp[i][w] = Math.max(dp[i][w], dp[i-1][w - weights[i-1]] + values[i-1]);
            }
        return dp[n][capacity];
    }

    /**
     * Longest Common Subsequence.
     * Time: O(m*n). Space: O(m*n).
     */
    public static int lcs(String a, String b) {
        int m = a.length(), n = b.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 1; i <= m; i++)
            for (int j = 1; j <= n; j++)
                dp[i][j] = a.charAt(i-1) == b.charAt(j-1)
                    ? dp[i-1][j-1] + 1
                    : Math.max(dp[i-1][j], dp[i][j-1]);
        return dp[m][n];
    }

    /**
     * Coin change — minimum coins to reach amount.
     * Time: O(amount * coins.length). Space: O(amount).
     * Returns -1 if impossible.
     */
    public static int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int i = 1; i <= amount; i++)
            for (int c : coins)
                if (c <= i) dp[i] = Math.min(dp[i], dp[i - c] + 1);
        return dp[amount] > amount ? -1 : dp[amount];
    }

    // ─── Graph algorithms ─────────────────────────────────────────────────────

    /**
     * Breadth-first search.
     * Time: O(V + E). Space: O(V).
     */
    public static List<Integer> bfs(Map<Integer, List<Integer>> graph, int start) {
        List<Integer> order = new ArrayList<>();
        Set<Integer>  visited = new HashSet<>();
        Queue<Integer> queue  = new LinkedList<>();
        queue.add(start);
        visited.add(start);
        while (!queue.isEmpty()) {
            int node = queue.poll();
            order.add(node);
            for (int nb : graph.getOrDefault(node, Collections.emptyList()))
                if (visited.add(nb)) queue.add(nb);
        }
        return order;
    }

    /**
     * Depth-first search (iterative).
     * Time: O(V + E). Space: O(V).
     */
    public static List<Integer> dfs(Map<Integer, List<Integer>> graph, int start) {
        List<Integer>  order   = new ArrayList<>();
        Set<Integer>   visited = new HashSet<>();
        Deque<Integer> stack   = new ArrayDeque<>();
        stack.push(start);
        while (!stack.isEmpty()) {
            int node = stack.pop();
            if (!visited.add(node)) continue;
            order.add(node);
            List<Integer> nbrs = graph.getOrDefault(node, Collections.emptyList());
            for (int i = nbrs.size() - 1; i >= 0; i--)
                if (!visited.contains(nbrs.get(i))) stack.push(nbrs.get(i));
        }
        return order;
    }

    /**
     * Detect cycle in directed graph using DFS coloring.
     * Returns true if cycle exists.
     * Time: O(V + E). Space: O(V).
     */
    public static boolean hasCycle(Map<Integer, List<Integer>> graph, int nodes) {
        int[] color = new int[nodes]; // 0=white, 1=gray, 2=black
        for (int i = 0; i < nodes; i++)
            if (color[i] == 0 && dfsCycle(graph, i, color)) return true;
        return false;
    }

    private static boolean dfsCycle(Map<Integer,List<Integer>> graph, int node, int[] color) {
        color[node] = 1;
        for (int nb : graph.getOrDefault(node, Collections.emptyList())) {
            if (color[nb] == 1) return true;
            if (color[nb] == 0 && dfsCycle(graph, nb, color)) return true;
        }
        color[node] = 2;
        return false;
    }
}
