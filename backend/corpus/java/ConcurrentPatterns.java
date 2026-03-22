/**
 * ConcurrentPatterns.java
 * Thread-safe Java data structures and concurrency patterns.
 * Part of the NeuralMigrate pre-ingested knowledge base corpus.
 * Teaches the Translation Agent how to map Java concurrency to Python threading.
 */
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.*;

public class ConcurrentPatterns {

    // ─── Thread-safe Counter ──────────────────────────────────────────────────

    /**
     * Lock-free counter using AtomicInteger — O(1) operations.
     */
    public static class AtomicCounter {
        private final AtomicInteger value = new AtomicInteger(0);

        public int increment()     { return value.incrementAndGet(); }
        public int decrement()     { return value.decrementAndGet(); }
        public int get()           { return value.get(); }
        public void reset()        { value.set(0); }
        public int addAndGet(int n){ return value.addAndGet(n); }
    }

    // ─── Bounded Blocking Queue ───────────────────────────────────────────────

    /**
     * Producer-consumer buffer — O(1) enqueue/dequeue.
     * Blocks producers when full, blocks consumers when empty.
     */
    public static class BoundedQueue<T> {
        private final Queue<T> queue = new LinkedList<>();
        private final int maxSize;
        private final Object lock = new Object();

        public BoundedQueue(int maxSize) {
            if (maxSize <= 0) throw new IllegalArgumentException("maxSize must be > 0");
            this.maxSize = maxSize;
        }

        public void produce(T item) throws InterruptedException {
            synchronized (lock) {
                while (queue.size() == maxSize) lock.wait();
                queue.add(item);
                lock.notifyAll();
            }
        }

        public T consume() throws InterruptedException {
            synchronized (lock) {
                while (queue.isEmpty()) lock.wait();
                T item = queue.poll();
                lock.notifyAll();
                return item;
            }
        }

        public int size() {
            synchronized (lock) { return queue.size(); }
        }
    }

    // ─── Read-Write Lock Cache ────────────────────────────────────────────────

    /**
     * Thread-safe cache with ReadWriteLock — allows concurrent reads,
     * exclusive writes. O(1) average get/put.
     */
    public static class RWCache<K, V> {
        private final Map<K, V> map = new HashMap<>();
        private final ReadWriteLock lock = new ReentrantReadWriteLock();

        public V get(K key) {
            lock.readLock().lock();
            try     { return map.get(key); }
            finally { lock.readLock().unlock(); }
        }

        public void put(K key, V value) {
            lock.writeLock().lock();
            try     { map.put(key, value); }
            finally { lock.writeLock().unlock(); }
        }

        public boolean containsKey(K key) {
            lock.readLock().lock();
            try     { return map.containsKey(key); }
            finally { lock.readLock().unlock(); }
        }

        public int size() {
            lock.readLock().lock();
            try     { return map.size(); }
            finally { lock.readLock().unlock(); }
        }
    }

    // ─── Worker Pool ──────────────────────────────────────────────────────────

    /**
     * Fixed-size thread pool for parallel task execution.
     */
    public static class WorkerPool {
        private final ExecutorService executor;
        private final List<Future<?>> futures = new ArrayList<>();

        public WorkerPool(int nThreads) {
            this.executor = Executors.newFixedThreadPool(nThreads);
        }

        public void submit(Runnable task) {
            futures.add(executor.submit(task));
        }

        public <T> Future<T> submit(Callable<T> task) {
            return executor.submit(task);
        }

        public void awaitAll() throws InterruptedException, ExecutionException {
            for (Future<?> f : futures) f.get();
            futures.clear();
        }

        public void shutdown() throws InterruptedException {
            executor.shutdown();
            executor.awaitTermination(30, TimeUnit.SECONDS);
        }
    }
}
