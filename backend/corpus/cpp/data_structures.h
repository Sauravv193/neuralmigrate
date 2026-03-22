/**
 * data_structures.h
 * Classic data structures implementation in C++17.
 * Used as the pre-ingested knowledge base corpus for NeuralMigrate.
 * Source: original implementation for educational use.
 */
#pragma once
#include <vector>
#include <stdexcept>
#include <optional>
#include <functional>

// ─── Stack ────────────────────────────────────────────────────────────────────

/**
 * Generic stack implemented over std::vector.
 * LIFO semantics. O(1) push/pop/peek.
 */
template<typename T>
class Stack {
    std::vector<T> data_;
public:
    void push(const T& val) { data_.push_back(val); }
    void push(T&& val)      { data_.push_back(std::move(val)); }

    T pop() {
        if (data_.empty()) throw std::underflow_error("Stack::pop on empty stack");
        T val = std::move(data_.back());
        data_.pop_back();
        return val;
    }

    const T& peek() const {
        if (data_.empty()) throw std::underflow_error("Stack::peek on empty stack");
        return data_.back();
    }

    bool  empty()  const noexcept { return data_.empty(); }
    size_t size()  const noexcept { return data_.size(); }
    void  clear()        noexcept { data_.clear(); }
};

// ─── Queue ────────────────────────────────────────────────────────────────────

/**
 * Circular queue with fixed capacity.
 * O(1) enqueue/dequeue.
 */
template<typename T>
class CircularQueue {
    std::vector<T> buf_;
    size_t head_ = 0, tail_ = 0, size_ = 0;
    size_t cap_;
public:
    explicit CircularQueue(size_t capacity) : buf_(capacity), cap_(capacity) {}

    void enqueue(const T& val) {
        if (size_ == cap_) throw std::overflow_error("CircularQueue is full");
        buf_[tail_] = val;
        tail_ = (tail_ + 1) % cap_;
        ++size_;
    }

    T dequeue() {
        if (size_ == 0) throw std::underflow_error("CircularQueue is empty");
        T val = buf_[head_];
        head_ = (head_ + 1) % cap_;
        --size_;
        return val;
    }

    bool   empty()    const noexcept { return size_ == 0; }
    size_t size()     const noexcept { return size_; }
    size_t capacity() const noexcept { return cap_; }
};

// ─── Linked list ──────────────────────────────────────────────────────────────

/**
 * Singly linked list with sentinel head node.
 * O(1) prepend, O(n) search/delete.
 */
template<typename T>
class LinkedList {
    struct Node {
        T     val;
        Node* next = nullptr;
        explicit Node(T v) : val(std::move(v)) {}
    };

    Node*  head_ = nullptr;
    size_t size_ = 0;

public:
    ~LinkedList() { clear(); }

    void prepend(T val) {
        Node* n = new Node(std::move(val));
        n->next = head_;
        head_   = n;
        ++size_;
    }

    void append(T val) {
        Node* n = new Node(std::move(val));
        if (!head_) { head_ = n; }
        else {
            Node* cur = head_;
            while (cur->next) cur = cur->next;
            cur->next = n;
        }
        ++size_;
    }

    bool remove(const T& val) {
        if (!head_) return false;
        if (head_->val == val) {
            Node* tmp = head_;
            head_ = head_->next;
            delete tmp;
            --size_;
            return true;
        }
        Node* cur = head_;
        while (cur->next && cur->next->val != val)
            cur = cur->next;
        if (!cur->next) return false;
        Node* tmp = cur->next;
        cur->next = tmp->next;
        delete tmp;
        --size_;
        return true;
    }

    bool contains(const T& val) const {
        Node* cur = head_;
        while (cur) {
            if (cur->val == val) return true;
            cur = cur->next;
        }
        return false;
    }

    size_t size()  const noexcept { return size_; }
    bool   empty() const noexcept { return size_ == 0; }

    void clear() {
        Node* cur = head_;
        while (cur) { Node* tmp = cur->next; delete cur; cur = tmp; }
        head_ = nullptr; size_ = 0;
    }
};

// ─── Binary search tree ───────────────────────────────────────────────────────

/**
 * Binary search tree (unbalanced).
 * O(log n) average insert/search, O(n) worst case.
 */
template<typename T>
class BST {
    struct Node {
        T     val;
        Node* left  = nullptr;
        Node* right = nullptr;
        explicit Node(T v) : val(std::move(v)) {}
    };

    Node* root_ = nullptr;

    Node* insert_(Node* n, T val) {
        if (!n) return new Node(std::move(val));
        if (val < n->val) n->left  = insert_(n->left,  std::move(val));
        else if (val > n->val) n->right = insert_(n->right, std::move(val));
        return n;
    }

    bool search_(Node* n, const T& val) const {
        if (!n) return false;
        if (val == n->val) return true;
        return val < n->val ? search_(n->left, val) : search_(n->right, val);
    }

    void inorder_(Node* n, std::vector<T>& out) const {
        if (!n) return;
        inorder_(n->left, out);
        out.push_back(n->val);
        inorder_(n->right, out);
    }

    void destroy_(Node* n) {
        if (!n) return;
        destroy_(n->left);
        destroy_(n->right);
        delete n;
    }

public:
    ~BST() { destroy_(root_); }

    void insert(T val) { root_ = insert_(root_, std::move(val)); }
    bool search(const T& val) const { return search_(root_, val); }

    std::vector<T> inorder() const {
        std::vector<T> result;
        inorder_(root_, result);
        return result;
    }
};

// ─── Min-Heap ─────────────────────────────────────────────────────────────────

/**
 * Min-heap (priority queue) built on std::vector.
 * O(log n) push/pop, O(1) peek.
 */
template<typename T, typename Cmp = std::less<T>>
class MinHeap {
    std::vector<T> data_;
    Cmp            cmp_;

    void sift_up(size_t i) {
        while (i > 0) {
            size_t p = (i - 1) / 2;
            if (!cmp_(data_[i], data_[p])) break;
            std::swap(data_[i], data_[p]);
            i = p;
        }
    }

    void sift_down(size_t i) {
        size_t n = data_.size();
        while (true) {
            size_t smallest = i;
            size_t l = 2*i+1, r = 2*i+2;
            if (l < n && cmp_(data_[l], data_[smallest])) smallest = l;
            if (r < n && cmp_(data_[r], data_[smallest])) smallest = r;
            if (smallest == i) break;
            std::swap(data_[i], data_[smallest]);
            i = smallest;
        }
    }

public:
    void push(T val) {
        data_.push_back(std::move(val));
        sift_up(data_.size() - 1);
    }

    T pop() {
        if (data_.empty()) throw std::underflow_error("MinHeap::pop on empty heap");
        T top = std::move(data_[0]);
        data_[0] = std::move(data_.back());
        data_.pop_back();
        if (!data_.empty()) sift_down(0);
        return top;
    }

    const T& peek()  const { return data_[0]; }
    bool     empty() const noexcept { return data_.empty(); }
    size_t   size()  const noexcept { return data_.size(); }
};
