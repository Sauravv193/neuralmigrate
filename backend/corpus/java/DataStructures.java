/**
 * DataStructures.java
 * Classic data structures implemented in Java 17.
 * Part of the NeuralMigrate pre-ingested knowledge base corpus.
 */
import java.util.*;
import java.util.function.Consumer;

// ─── Generic Stack ────────────────────────────────────────────────────────────

/**
 * Generic stack backed by ArrayList.
 * O(1) amortised push/pop/peek.
 */
class Stack<T> {
    private final ArrayList<T> data = new ArrayList<>();

    public void push(T item) {
        data.add(item);
    }

    public T pop() {
        if (data.isEmpty()) throw new EmptyStackException();
        return data.remove(data.size() - 1);
    }

    public T peek() {
        if (data.isEmpty()) throw new EmptyStackException();
        return data.get(data.size() - 1);
    }

    public boolean isEmpty() { return data.isEmpty(); }
    public int     size()    { return data.size(); }
    public void    clear()   { data.clear(); }
}

// ─── Generic Queue ────────────────────────────────────────────────────────────

/**
 * Queue backed by LinkedList.
 * O(1) enqueue and dequeue.
 */
class Queue<T> {
    private final LinkedList<T> data = new LinkedList<>();

    public void enqueue(T item) { data.addLast(item); }

    public T dequeue() {
        if (data.isEmpty()) throw new NoSuchElementException("Queue is empty");
        return data.removeFirst();
    }

    public T peek()      { return data.peekFirst(); }
    public boolean isEmpty() { return data.isEmpty(); }
    public int     size()    { return data.size(); }
}

// ─── Linked list ──────────────────────────────────────────────────────────────

/**
 * Singly linked list with head pointer.
 * O(1) prepend, O(n) search/remove.
 */
class LinkedList<T> {
    private static class Node<T> {
        T       val;
        Node<T> next;
        Node(T val) { this.val = val; }
    }

    private Node<T> head = null;
    private int     size = 0;

    public void prepend(T val) {
        Node<T> n = new Node<>(val);
        n.next = head;
        head   = n;
        size++;
    }

    public void append(T val) {
        Node<T> n = new Node<>(val);
        if (head == null) { head = n; size++; return; }
        Node<T> cur = head;
        while (cur.next != null) cur = cur.next;
        cur.next = n;
        size++;
    }

    public boolean remove(T val) {
        if (head == null) return false;
        if (head.val.equals(val)) { head = head.next; size--; return true; }
        Node<T> cur = head;
        while (cur.next != null && !cur.next.val.equals(val)) cur = cur.next;
        if (cur.next == null) return false;
        cur.next = cur.next.next;
        size--;
        return true;
    }

    public boolean contains(T val) {
        Node<T> cur = head;
        while (cur != null) {
            if (cur.val.equals(val)) return true;
            cur = cur.next;
        }
        return false;
    }

    public void forEach(Consumer<T> action) {
        Node<T> cur = head;
        while (cur != null) { action.accept(cur.val); cur = cur.next; }
    }

    public int     size()    { return size; }
    public boolean isEmpty() { return size == 0; }
}

// ─── Binary Search Tree ───────────────────────────────────────────────────────

/**
 * Binary search tree for Comparable types.
 * O(log n) average insert/search, O(n) worst case.
 */
class BST<T extends Comparable<T>> {
    private Node root = null;

    private class Node {
        T    val;
        Node left, right;
        Node(T val) { this.val = val; }
    }

    public void insert(T val) { root = insert(root, val); }

    private Node insert(Node n, T val) {
        if (n == null) return new Node(val);
        int cmp = val.compareTo(n.val);
        if      (cmp < 0) n.left  = insert(n.left,  val);
        else if (cmp > 0) n.right = insert(n.right, val);
        return n;
    }

    public boolean search(T val) { return search(root, val); }

    private boolean search(Node n, T val) {
        if (n == null) return false;
        int cmp = val.compareTo(n.val);
        if      (cmp == 0) return true;
        else if (cmp < 0)  return search(n.left, val);
        else               return search(n.right, val);
    }

    /** Returns elements in sorted order (in-order traversal). */
    public List<T> inorder() {
        List<T> result = new ArrayList<>();
        inorder(root, result);
        return result;
    }

    private void inorder(Node n, List<T> result) {
        if (n == null) return;
        inorder(n.left, result);
        result.add(n.val);
        inorder(n.right, result);
    }

    public int height() { return height(root); }

    private int height(Node n) {
        if (n == null) return 0;
        return 1 + Math.max(height(n.left), height(n.right));
    }
}

// ─── Min Heap ─────────────────────────────────────────────────────────────────

/**
 * Min-heap backed by ArrayList.
 * O(log n) insert/extractMin, O(1) peekMin.
 */
class MinHeap<T extends Comparable<T>> {
    private final ArrayList<T> data = new ArrayList<>();

    public void insert(T val) {
        data.add(val);
        siftUp(data.size() - 1);
    }

    public T extractMin() {
        if (data.isEmpty()) throw new NoSuchElementException("Heap is empty");
        T min = data.get(0);
        int last = data.size() - 1;
        data.set(0, data.get(last));
        data.remove(last);
        if (!data.isEmpty()) siftDown(0);
        return min;
    }

    public T peekMin() {
        if (data.isEmpty()) throw new NoSuchElementException("Heap is empty");
        return data.get(0);
    }

    private void siftUp(int i) {
        while (i > 0) {
            int parent = (i - 1) / 2;
            if (data.get(i).compareTo(data.get(parent)) >= 0) break;
            Collections.swap(data, i, parent);
            i = parent;
        }
    }

    private void siftDown(int i) {
        int n = data.size();
        while (true) {
            int smallest = i, l = 2*i+1, r = 2*i+2;
            if (l < n && data.get(l).compareTo(data.get(smallest)) < 0) smallest = l;
            if (r < n && data.get(r).compareTo(data.get(smallest)) < 0) smallest = r;
            if (smallest == i) break;
            Collections.swap(data, i, smallest);
            i = smallest;
        }
    }

    public boolean isEmpty() { return data.isEmpty(); }
    public int     size()    { return data.size(); }
}
