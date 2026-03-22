/**
 * design_patterns.cpp
 * Common C++ design patterns — singleton, observer, strategy, cache.
 * Part of the NeuralMigrate knowledge base corpus.
 */
#include <vector>
#include <unordered_map>
#include <functional>
#include <stdexcept>
#include <memory>
#include <string>

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Thread-safe Meyer's Singleton.
 * O(1) access after first initialisation.
 */
class Config {
    std::unordered_map<std::string, std::string> data_;
    Config() = default;
public:
    static Config& instance() {
        static Config inst;
        return inst;
    }
    Config(const Config&)            = delete;
    Config& operator=(const Config&) = delete;

    void set(const std::string& key, const std::string& val) { data_[key] = val; }
    std::string get(const std::string& key, const std::string& def = "") const {
        auto it = data_.find(key);
        return it != data_.end() ? it->second : def;
    }
    bool has(const std::string& key) const { return data_.count(key) > 0; }
};

// ─── Observer ────────────────────────────────────────────────────────────────

/**
 * Observer pattern — publish/subscribe.
 * O(n) notify where n = subscriber count.
 */
class EventEmitter {
    std::unordered_map<std::string, std::vector<std::function<void(const std::string&)>>> listeners_;
public:
    void on(const std::string& event, std::function<void(const std::string&)> cb) {
        listeners_[event].push_back(std::move(cb));
    }
    void emit(const std::string& event, const std::string& data = "") {
        auto it = listeners_.find(event);
        if (it != listeners_.end())
            for (auto& cb : it->second) cb(data);
    }
    void off(const std::string& event) { listeners_.erase(event); }
};

// ─── LRU Cache ───────────────────────────────────────────────────────────────

/**
 * LRU Cache — O(1) get and put using doubly linked list + hash map.
 */
class LRUCache {
    int capacity_;
    std::list<std::pair<int,int>> items_;   // (key, value)
    std::unordered_map<int, std::list<std::pair<int,int>>::iterator> cache_;

public:
    explicit LRUCache(int capacity) : capacity_(capacity) {
        if (capacity <= 0) throw std::invalid_argument("capacity must be > 0");
    }

    int get(int key) {
        auto it = cache_.find(key);
        if (it == cache_.end()) return -1;
        items_.splice(items_.begin(), items_, it->second);
        return it->second->second;
    }

    void put(int key, int value) {
        auto it = cache_.find(key);
        if (it != cache_.end()) {
            it->second->second = value;
            items_.splice(items_.begin(), items_, it->second);
            return;
        }
        if ((int)items_.size() == capacity_) {
            cache_.erase(items_.back().first);
            items_.pop_back();
        }
        items_.push_front({key, value});
        cache_[key] = items_.begin();
    }

    int size() const { return items_.size(); }
};

// ─── Strategy ────────────────────────────────────────────────────────────────

/**
 * Strategy pattern for sortable collections.
 * Decouples sorting algorithm from the container.
 */
class Sorter {
    std::function<void(std::vector<int>&)> strategy_;
public:
    explicit Sorter(std::function<void(std::vector<int>&)> s) : strategy_(std::move(s)) {}

    void sort(std::vector<int>& v) { strategy_(v); }

    static Sorter ascending() {
        return Sorter([](std::vector<int>& v){ std::sort(v.begin(), v.end()); });
    }
    static Sorter descending() {
        return Sorter([](std::vector<int>& v){ std::sort(v.rbegin(), v.rend()); });
    }
    static Sorter byAbsoluteValue() {
        return Sorter([](std::vector<int>& v){
            std::sort(v.begin(), v.end(), [](int a, int b){ return std::abs(a) < std::abs(b); });
        });
    }
};

// ─── Object Pool ─────────────────────────────────────────────────────────────

/**
 * Generic object pool — reuse expensive objects.
 * O(1) acquire/release.
 */
template<typename T>
class ObjectPool {
    std::vector<std::unique_ptr<T>> pool_;
    std::vector<T*> available_;
public:
    explicit ObjectPool(int size) {
        pool_.reserve(size);
        available_.reserve(size);
        for (int i = 0; i < size; i++) {
            pool_.push_back(std::make_unique<T>());
            available_.push_back(pool_.back().get());
        }
    }

    T* acquire() {
        if (available_.empty()) throw std::runtime_error("Pool exhausted");
        T* obj = available_.back();
        available_.pop_back();
        return obj;
    }

    void release(T* obj) { available_.push_back(obj); }
    int available() const { return available_.size(); }
};
