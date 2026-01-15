# System Limits Documentation

## Overview

System limits of HTML-SQLite Fusion, how they were discovered, and how to test them. All limits are empirically determined using binary search and exponential testing - not guessed or assumed.

## Table of Contents

- [Testing Methodology](#testing-methodology)
- [Limit Categories](#limit-categories)
- [Running Limit Tests](#running-limit-tests)
- [Understanding Results](#understanding-results)
- [Known Limits](#known-limits)
- [Browser Differences](#browser-differences)
- [Recommendations](#recommendations)

## Testing Methodology

### Binary Search Approach

We use a systematic approach to find true limits:

```
1. Exponential Search Phase:
   - Start with a reasonable base value (e.g., 1000 rows)
   - Double the value until failure: 1000 → 2000 → 4000 → 8000...
   - Quickly identifies the rough limit range

2. Binary Search Phase:
   - Take the last passing value and first failing value
   - Test the midpoint
   - Narrow down to exact limit within tolerance
   
3. Verification:
   - Test at limit - 1 (should pass)
   - Test at limit (should pass)
   - Test at limit + 1 (should fail)
```

### Example: Finding Maximum Row Count

```javascript
// This is what the system does automatically
const result = await LimitFinder.findLimit(1000, async (rowCount) => {
  const fusion = new HTMLSQLiteFusion();
  await fusion.createDatabase();
  fusion.run('CREATE TABLE test (id INTEGER, value TEXT)');
  
  try {
    fusion.run('BEGIN TRANSACTION');
    for (let i = 0; i < rowCount; i++) {
      fusion.run('INSERT INTO test VALUES (?, ?)', [i, `value${i}`]);
    }
    fusion.run('COMMIT');
    return true; // Passed
  } catch (error) {
    return false; // Failed
  } finally {
    fusion.close();
  }
});

console.log(`Maximum rows: ${result.limit}`);
console.log(`Last passed: ${result.passed}`);
console.log(`First failed: ${result.failed}`);
```

## Limit Categories

### 1. Database Size Limits

These limits determine how much data can be stored:

Maximum rows in single table determines how many rows one table can hold. Maximum database size (bytes) measures the total size of the database in memory. Maximum number of tables defines how many tables can exist in one database.

Key factors include WASM memory allocation (default ~2GB heap), browser memory limits, and page file size (SQLite default is 4KB pages).

### 2. Data Size Limits

Limits on individual data items:

Maximum TEXT field size determines the longest string that can be stored. Maximum BLOB size defines the largest binary data field.

SQLite theoretical limits: TEXT/BLOB can be 1,000,000,000 bytes (1GB) by default, and can be increased to 2,147,483,647 bytes (2GB).

Practical limits are constrained by JavaScript string length (~500MB to 1GB in modern browsers), memory allocation for single values, and base64 encoding overhead when saving.

### 3. Query Complexity Limits

How complex can queries be:

Maximum JOIN depth determines how many tables can be joined. Maximum WHERE conditions defines the number of conditions in WHERE clause. Maximum compound SELECT depth measures nested subquery depth.

Key factors include SQL parser recursion limits, query compilation memory, and execution plan complexity.

### 4. Schema Limits

Database structure constraints:

Maximum columns per table determines how many columns can exist in one table. Maximum indexes per table defines how many indexes can be created.

SQLite default limits: Columns per table is 2,000 (can be increased to 32,767). There is no hard limit on indexes (practical limit based on performance).

### 5. Encoding Limits

Limits related to base64 encoding and HTML embedding:

Maximum base64 encodable size determines the largest data that can be encoded. Maximum HTML rebuild size defines the largest HTML file that can be reconstructed.

Key factors include JavaScript string length limits (varies by browser), DOM manipulation limits, and File System Access API limits.

### 6. Transaction Limits

Limits on database transactions:

Maximum statements per transaction determines how many operations can occur in one transaction.

Key factors include rollback journal size, memory for uncommitted changes, and lock duration.

### 7. Performance Limits

Not hard limits, but performance degradation points:

- Query response time at scale
- Insert/update throughput with large datasets
- Memory pressure indicators

## Running Limit Tests

### Quick Start (5 minutes)

Test a sample of key limits:

```bash
open tests/limits-runner.html
# Click "Quick Test"
```

This runs 5 key tests:
1. Maximum rows in single table
2. Maximum TEXT field size
3. Maximum JOIN depth
4. Maximum columns per table
5. Maximum base64 encodable size

### Full Suite (10-15 minutes)

Run all limit tests:

```bash
open tests/limits-runner.html
# Click "Run All Limit Tests"
```

This runs ~15-20 comprehensive tests across all categories.

### Command Line Testing

For automated testing or CI/CD:

```javascript
// In Node.js or headless browser
const { registerLimitTests } = require('./lib/limit-tests.js');
const runner = new TestRunner();

await registerLimitTests(runner);
const results = await runner.runAll();

// Export results
const markdown = window.limitResults.toMarkdown();
fs.writeFileSync('limits-report.md', markdown);
```

## Understanding Results

### Result Format

Each limit test produces:

```json
{
  "limit": 50000,           // The maximum working value
  "passed": 50000,          // Last value that passed
  "failed": 51000,          // First value that failed
  "details": "Additional info",
  "notes": "Context and explanation"
}
```

### Reading the Report

When you download results, you get a markdown file like:

```markdown
## Database Size Limits

### Maximum Rows in Single Table

- Limit Found: 50,000
- Last Passed: 50,000
- First Failed: 51,000
- Notes: Limited by memory and transaction size

### Maximum Database Size (bytes)

- Limit Found: 52,428,800 bytes
- Last Passed: 52,428,800 bytes
- First Failed: 53,477,376 bytes
- Details: 50.00 MB
- Notes: Limited by WASM memory allocation
```

### Interpreting Limits

Hard limits are values the system cannot exceed (e.g., WASM heap size). Soft limits indicate points where performance degrades significantly. Configuration limits can be changed with SQLite PRAGMA statements. Browser limits vary by browser engine and version.

## Known Limits

Note: These are example values. Run tests on your system to find actual limits.

### Typical Chrome/Edge Limits (2026)

| Category | Limit | Value | Notes |
|----------|-------|-------|-------|
| Database Size | Max Rows | ~100,000-500,000 | Depends on row size |
| Database Size | Max DB Size | ~100-500 MB | Before performance degrades |
| Database Size | Max Tables | 10,000+ | Practical limit |
| Data Size | Max TEXT | ~100-500 MB | JavaScript string limit |
| Data Size | Max BLOB | ~100-500 MB | Memory allocation limit |
| Query | Max JOIN Depth | 64+ | Parser limit |
| Query | Max WHERE Conditions | 1,000+ | Statement length limit |
| Schema | Max Columns | 2,000 | SQLite default |
| Schema | Max Indexes | 100+ | Performance limit |
| Encoding | Max Base64 | ~100-400 MB | String length limit |
| Transaction | Max Statements | 100,000+ | Memory limit |

### Firefox Limits

Generally similar to Chrome, but:
- Slightly lower memory limits in some cases
- Different File System Access API support

### Safari Limits

- More conservative memory limits
- No File System Access API (uses download fallback)
- OPFS not supported in older versions

## Browser Differences

### Memory Allocation

| Browser | Typical Heap Size | String Limit | Notes |
|---------|------------------|--------------|-------|
| Chrome 100+ | ~2GB | ~500MB | V8 engine |
| Firefox 100+ | ~2GB | ~500MB | SpiderMonkey |
| Safari 16+ | ~1.5GB | ~500MB | JavaScriptCore |

### API Support

| Feature | Chrome | Firefox | Safari |
|---------|--------|---------|--------|
| File System Access | Yes | No | No |
| OPFS | Yes | Yes | Partial (16+) |
| WASM Threads | Yes | Yes | Partial (16.4+) |

## Recommendations

### For Optimal Performance

1. Keep databases under 50MB for best performance
2. Limit rows to 100,000 per table for responsive queries
3. Use transactions for bulk operations (50x faster)
4. Index frequently queried columns (10-100x faster queries)
5. Avoid very deep JOINs (>10 tables) if possible

### For Maximum Capacity

1. Use compression (pako library) - reduces size by 50-70%
2. Normalize your data - avoid redundant storage
3. Use INTEGER PRIMARY KEY - most efficient
4. VACUUM database periodically to reclaim space
5. Consider OPFS for working storage (better performance)

### Warning Signs

Stop and optimize if you see:

- Database size > 100MB
- Query times > 1 second for simple SELECT
- Save operations > 10 seconds
- Browser memory warning
- Frequent page crashes

### Scaling Beyond Limits

If you hit limits:

1. **Split data across multiple files**
   - One HTML-SQLite file per project/category
   - User selects which to load

2. **Use OPFS for working data**
   - Keep working data in OPFS
   - Export to HTML-SQLite for portability

3. **Server-side SQLite**
   - Move to traditional SQLite on server
   - Use HTML-SQLite for offline sync

4. **Alternative storage**
   - IndexedDB for very large datasets
   - PostgreSQL/MySQL for server-side

## Testing Best Practices

### When to Run Limit Tests

- Before major releases
- After significant refactoring
- On new browser versions
- When users report performance issues
- When targeting new platforms

### What to Monitor

```javascript
// Add performance monitoring to your app
function checkPerformance(fusion) {
  const dbSize = fusion.getDatabaseSize();
  const base64Size = fusion.getBase64Size();
  
  if (dbSize > 50 * 1024 * 1024) {
    console.warn('Database size is large:', dbSize);
  }
  
  if (performance.memory) {
    const heapUsed = performance.memory.usedJSHeapSize;
    const heapLimit = performance.memory.jsHeapSizeLimit;
    const usagePercent = (heapUsed / heapLimit) * 100;
    
    if (usagePercent > 80) {
      console.warn('High memory usage:', usagePercent.toFixed(1) + '%');
    }
  }
}
```

### Custom Limit Tests

Create your own limit tests:

```javascript
// Test your specific use case
runner.test('find limit: my specific scenario', async () => {
  const testFn = async (value) => {
    // Your test logic here
    // Return true if passes, false if fails
  };
  
  const result = await LimitFinder.findLimit(
    initialGuess,  // e.g., 1000
    testFn,
    { tolerance: 10 }
  );
  
  console.log(`Limit found: ${result.limit}`);
});
```

## Continuous Monitoring

### In Production

```javascript
// Log performance metrics
setInterval(() => {
  if (db) {
    const size = fusion.getDatabaseSize();
    const tables = fusion.getTables();
    
    // Send to analytics
    analytics.track('db_metrics', {
      size,
      tableCount: tables.length,
      memory: performance.memory?.usedJSHeapSize
    });
  }
}, 60000); // Every minute
```

### Automated Testing

```bash
# Add to CI/CD pipeline
npm run test:limits

# Set thresholds
if [ $MAX_DB_SIZE -gt 104857600 ]; then
  echo "Database size limit test failed"
  exit 1
fi
```

## FAQ

### Q: Why do limits vary between runs?

A: Several factors:
- Available system memory
- Browser tab count
- Other running applications
- JavaScript garbage collection timing
- CPU load

### Q: Can I increase limits?

A: Some limits can be increased:
- SQLite PRAGMA settings (e.g., `PRAGMA max_page_count`)
- WASM heap size (requires recompiling SQLite WASM)
- Browser flags (not recommended for production)

### Q: Are these limits guaranteed?

A: No - they're empirically determined and may vary:
- Different hardware
- Different OS
- Browser version
- System load
- Other factors

### Q: What happens when I hit a limit?

Common behaviors:
- Database operations throw errors
- Browser becomes unresponsive
- "Out of memory" errors
- Save operations fail
- Tab crashes

### Q: How do I recover from hitting a limit?

1. Catch errors and alert user
2. Offer to export data
3. Suggest splitting data
4. Provide cleanup tools (DELETE old data)
5. Archive and start fresh

## Resources

- [SQLite Limits Documentation](https://sqlite.org/limits.html)
- [WebAssembly Memory](https://webassembly.org/docs/semantics/#linear-memory)
- [V8 Heap Limits](https://v8.dev/blog/heap-size-limit)
- [MDN: Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)

## Contributing

Found a new limit? Run the tests and submit results:

```bash
# Run tests
open tests/limits-runner.html
# Download results
# Create issue with your findings
```

Include:
- Browser name and version
- OS and version
- Available RAM
- Test results (markdown file)

---

*Last Updated: 2026-01-13*
*Test Suite Version: 1.0.0*
