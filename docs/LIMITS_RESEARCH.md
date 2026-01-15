# Limits Research & Theoretical Boundaries

## Overview

This document compiles research on theoretical and practical limits for HTML-SQLite Fusion. It serves as a reference for understanding what limits to expect and why they exist.

## SQLite Theoretical Limits

### From Official SQLite Documentation

Source: [sqlite.org/limits.html](https://sqlite.org/limits.html)

| Limit | Default | Maximum | Configurable |
|-------|---------|---------|-------------|
| Maximum Database Size | ~140 TB | ~281 TB | Yes (PRAGMA) |
| Maximum Row Size | ~1 GB | ~2 GB | No |
| Maximum String/BLOB Length | 1,000,000,000 bytes | 2,147,483,647 bytes | Yes (compile-time) |
| Maximum Columns Per Table | 2,000 | 32,767 | Yes (compile-time) |
| Maximum SQL Statement Length | 1,000,000 bytes | 1,000,000,000 bytes | Yes (compile-time) |
| Maximum Attached Databases | 10 | 125 | Yes (compile-time) |
| Maximum Rows Per Table | 2^64 | 2^64 | No |
| Maximum Tables | ~2 billion | ~2 billion | No |
| Maximum Index Length | N/A | 8000 bytes | No |
| Maximum Compound SELECT Depth | N/A | 500 | Yes (compile-time) |
| Maximum Expression Tree Depth | 1,000 | ~3,000 | Yes (compile-time) |

### Page Size Limits

```
Default page size: 4,096 bytes (4 KB)
Minimum page size: 512 bytes
Maximum page size: 65,536 bytes (64 KB)

Max pages (32-bit): 2^31 - 1 = 2,147,483,646 pages
Max pages (64-bit): 2^32 - 1 = 4,294,967,294 pages

Maximum DB Size = page_size × max_page_count
```

**Example Calculations:**

```
4 KB pages × 2^31 pages = 8,796,093,018,112 bytes ≈ 8 TB
64 KB pages × 2^31 pages = 140,737,488,289,792 bytes ≈ 140 TB
```

## WebAssembly Limits

### Memory Limits

Source: [WebAssembly Specification](https://webassembly.org/docs/semantics/#linear-memory)

| Limit | Value | Notes |
|-------|-------|-------|
| Memory Page Size | 64 KB | Fixed |
| Initial Memory | Configurable | Typically 256 pages (16 MB) |
| Maximum Memory (32-bit) | 4 GB | 65,536 pages |
| Practical Maximum | ~2 GB | Browser limitations |

### SQLite WASM Specifics

```
Default WASM heap: ~2 GB (browser dependent)
Initial allocation: 16-64 MB
Growth: Dynamic, in 64 KB pages
Maximum: Limited by browser JavaScript engine
```

**Memory Growth:**

```javascript
// SQLite WASM allocates memory dynamically
Initial: 16 MB
After 1K rows: ~20 MB
After 10K rows: ~50 MB
After 100K rows: ~200 MB
After 1M rows: ~1-2 GB (near practical limit)
```

## JavaScript Engine Limits

### String Length Limits

| Browser | Engine | Maximum String Length | Source |
|---------|--------|--------------------|--------|
| Chrome/Edge | V8 | ~536,870,888 chars (512 MB) | V8 source code |
| Firefox | SpiderMonkey | ~536,870,911 chars | MDN |
| Safari | JavaScriptCore | ~536,870,911 chars | WebKit docs |

Note: These are theoretical. Practical limits are lower due to:
- Available heap memory
- Other allocations
- Browser overhead

### Array/TypedArray Limits

```javascript
// Maximum TypedArray length
Uint8Array: 2^32 - 1 bytes (4 GB theoretical)
           ~2 GB practical in most browsers

// Maximum Array length
Array: 2^32 - 1 elements
      ~100M elements practical (depends on element size)
```

### Memory Heap Limits

| Browser | Default Heap | Maximum Heap | Notes |
|---------|-------------|--------------|-------|
| Chrome 64-bit | 1-2 GB | 4 GB | Can be increased with --max-old-space-size |
| Firefox 64-bit | 1-2 GB | ~2-4 GB | Depends on available RAM |
| Safari 64-bit | 1-1.5 GB | ~2 GB | More conservative |
| Mobile browsers | 128-512 MB | 1 GB | Very limited |

## Base64 Encoding Overhead

### Size Increase

```
Binary data: N bytes
Base64 encoded: ceil(N / 3) × 4 bytes
Overhead: ~33% increase

Examples:
1 KB binary → 1.37 KB base64
1 MB binary → 1.37 MB base64
100 MB binary → 137 MB base64
```

### Encoding/Decoding Limits

```javascript
// btoa() / atob() limits
Maximum input: ~500 MB (browser dependent)
Memory required: ~3x input size during encoding
Time complexity: O(n)

Example:
100 MB database
→ 137 MB base64 string
→ ~400 MB peak memory during encoding
→ ~2-5 seconds on modern CPU
```

## Browser-Specific Limits

### File System Access API

| Browser | Support | Max File Size | Notes |
|---------|---------|---------------|-------|
| Chrome 86+ | Full | ~2 GB | Good performance |
| Edge 86+ | Full | ~2 GB | Chromium-based |
| Firefox | No | N/A | Use download fallback |
| Safari | No | N/A | Use download fallback |

### Origin Private File System (OPFS)

| Browser | Support | Max Storage | Notes |
|---------|---------|-------------|-------|
| Chrome 86+ | | ~2 GB | Depends on disk quota |
| Edge 86+ | | ~2 GB | Chromium-based |
| Firefox 111+ | | ~2 GB | Recent addition |
| Safari 15.2+ | | ~1 GB | Limited support |

### Storage Quota

```javascript
// Query available storage
const estimate = await navigator.storage.estimate();

console.log('Quota:', estimate.quota); // Total available
console.log('Usage:', estimate.usage); // Currently used

// Typical values:
// Desktop: 10 GB to unlimited (based on disk space)
// Mobile: 1-5 GB
// Private/Incognito: 100-500 MB
```

## Practical vs. Theoretical Limits

### Why Theoretical Limits Are Higher

1. Multiple constraints. Smallest limit wins.
   - SQLite says 1 GB TEXT field
   - But JavaScript string limit is 512 MB
   - And available memory might be 500 MB
   - Effective limit is around 400 MB with headroom

2. Memory overhead. Operations need extra memory.
   - Database in memory: 100 MB
   - Export operation: +100 MB copy
   - Base64 encoding: +137 MB
   - HTML reconstruction: +237 MB
   - **Peak memory: ~574 MB**

3. Performance degradation. This appears before hard limits.
   - Can technically store 1M rows
   - But queries take 10+ seconds
   - **Practical limit: 100K rows** (for <1s queries)

### Real-World Limits (Estimated)

Based on typical 2026 hardware (16 GB RAM, modern browser):

| Category | Theoretical | Practical | Recommended |
|----------|------------|-----------|-------------|
| Database Size | 140 TB | 500 MB | 50-100 MB |
| Rows in Table | 2^64 | 1M rows | 100K rows |
| TEXT Field | 2 GB | 400 MB | 10 MB |
| BLOB Field | 2 GB | 400 MB | 10 MB |
| Tables in DB | 2B | 100K | 100 tables |
| Columns per Table | 32K | 2K | 50 columns |
| JOIN Depth | 500 | 100 | 10 joins |
| WHERE Conditions | 1M | 10K | 100 conditions |
| Base64 Size | String limit | 400 MB | 50 MB |
| HTML File Size | File system | 600 MB | 100 MB |

## Testing Approach

### Why Binary Search?

1. Efficient. O(log n) instead of O(n).
   ```
   Linear search: Test 1, 2, 3, 4... → 100 tests for limit 100
   Binary search: Test 50, 25, 37, 31... → 7 tests for limit 100
   ```

2. Finds real limits. Not guessed.
   - Don't assume limits based on docs
   - Actually test until failure
   - Verify boundary conditions

3. Reproducible. Same process every time.
   - Start with exponential search (2x each step)
   - Switch to binary search when failure found
   - Narrow down to exact value

### Test Pattern

```javascript
// This is what our limit tests do
async function findLimit(initialGuess, testFunction) {
  // Phase 1: Exponential search
  let value = initialGuess;
  while (await testFunction(value)) {
    value *= 2; // Double until failure
  }
  
  // Phase 2: Binary search
  let low = value / 2;  // Last success
  let high = value;     // First failure
  
  while (high - low > tolerance) {
    let mid = Math.floor((low + high) / 2);
    
    if (await testFunction(mid)) {
      low = mid;  // Success, try higher
    } else {
      high = mid; // Failure, try lower
    }
  }
  
  return low; // Maximum value that works
}
```

## Limit Interdependencies

### How Limits Interact

```
Database Size Limit
  ↓ depends on
Row Count × Row Size
  ↓ depends on
Column Count × Column Size
  ↓ constrained by
Available Memory
  ↓ shared with
Browser, OS, Other Apps
  ↓ limited by
Physical RAM
```

### Example Scenario

```
System: 8 GB RAM, Chrome browser
Available for browser: ~4 GB
Available for tab: ~2 GB
Available for WASM: ~2 GB
Available for database: ~1.5 GB (after overhead)

If rows have 10 columns × 100 bytes = 1KB per row:
Maximum rows = 1.5 GB / 1 KB = 1,500,000 rows

But if rows have 100 columns × 1000 bytes = 100KB per row:
Maximum rows = 1.5 GB / 100 KB = 15,000 rows
```

## Performance vs. Capacity Trade-offs

### Performance Characteristics

```
Query Time = f(rows, indexes, query complexity)

No index:
  1K rows: ~1 ms
  10K rows: ~10 ms
  100K rows: ~100 ms
  1M rows: ~1000 ms (too slow!)

With index:
  1K rows: ~0.1 ms
  10K rows: ~0.2 ms
  100K rows: ~0.5 ms
  1M rows: ~2 ms (acceptable)
```

### Insert Performance

```
Single INSERT (no transaction):
  1 row: ~1 ms
  1K rows: ~1000 ms (sequential)

Transaction INSERT:
  1K rows: ~20 ms (50x faster!)
  10K rows: ~200 ms
  100K rows: ~2000 ms
```

### Export/Save Performance

```
Export + Base64 + HTML Rebuild:
  1 MB database: ~50 ms
  10 MB database: ~500 ms
  100 MB database: ~5000 ms (5 seconds)
  500 MB database: ~25000 ms (25 seconds)
```

## Recommendations Based on Research

### Design Guidelines

1. **Target 80% of Maximum**
   ```
   If max rows = 500K
   Target = 400K rows
   Warn at = 350K rows
   Error at = 450K rows
   ```

2. **Use Appropriate Data Types**
   ```sql
   -- Good
   CREATE TABLE users (
     id INTEGER PRIMARY KEY,  -- 1-8 bytes
     age INTEGER,             -- 1-8 bytes
     active INTEGER           -- 1 byte for boolean
   );
   
   -- Wasteful
   CREATE TABLE users (
     id TEXT,                 -- 36 bytes for UUID
     age TEXT,                -- ~2 bytes for "25"
     active TEXT              -- ~4 bytes for "true"
   );
   ```

3. **Index Strategically**
   ```sql
   -- Index frequently queried columns
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_posts_created ON posts(created_at);
   
   -- Don't over-index (slows INSERTs)
   -- Only index columns used in WHERE, JOIN, ORDER BY
   ```

4. **Batch Operations**
   ```javascript
   // Good
   fusion.run('BEGIN TRANSACTION');
   for (const item of items) {
     fusion.run('INSERT INTO table VALUES (?, ?)', [item.id, item.value]);
   }
   fusion.run('COMMIT');
   
   // Bad
   for (const item of items) {
     fusion.run('INSERT INTO table VALUES (?, ?)', [item.id, item.value]);
     // Each insert is a separate transaction (50x slower!)
   }
   ```

## Future Research Directions

### Areas for Further Investigation

1. **Compression Impact**
   - How much do compression libraries (pako) help?
   - Trade-off between size and decode time?

2. **Streaming Operations**
   - Can we stream large exports to avoid memory spikes?
   - Progressive loading of large databases?

3. **WASM Threads**
   - Can we use Web Workers for parallel operations?
   - Would SharedArrayBuffer help?

4. **IndexedDB Hybrid**
   - Store BLOB fields in IndexedDB?
   - Keep SQLite for structured data?

5. **Incremental Saves**
   - Can we save only changed pages?
   - SQLite session extension for change tracking?

## References

### Official Documentation

- [SQLite Limits](https://sqlite.org/limits.html)
- [SQLite WASM](https://sqlite.org/wasm)
- [WebAssembly Spec](https://webassembly.org/docs/semantics/)
- [V8 Memory Limits](https://v8.dev/blog/heap-size-limit)
- [MDN: Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

### Research Papers

- "WebAssembly: A New Execution Model for the Web" (2017)
- "Bringing the Web Up to Speed with WebAssembly" (2017)
- "SQLite Optimization" - sqlite.org/optoverview.html

### Browser Engine Sources

- Chromium: https://chromium.googlesource.com/v8/v8
- Firefox: https://hg.mozilla.org/mozilla-central
- WebKit: https://webkit.org/

---

*This is a living document. As we discover new limits and constraints, this document will be updated.*

*Last Updated: 2026-01-13*
