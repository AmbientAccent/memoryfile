# Limits Testing - Quick Start Guide

**Important:** Due to browser CORS restrictions with WASM files, you must run a local HTTP server. You cannot open HTML files directly from the filesystem.

## Goal

Discover the real limits of HTML-SQLite Fusion on your system in 5-15 minutes.

## Running Limits Tests

### Option 1: Quick Test (5 minutes)

Test the 5 most important limits:

```bash
open limits-runner.html
```

Click "Quick Test"

This tests:
1. Maximum rows in a table
2. Maximum TEXT field size
3. Maximum JOIN depth
4. Maximum columns per table
5. Maximum base64 encoding size

### Option 2: Full Test Suite (15 minutes)

Test all system limits comprehensively:

```bash
# Make sure your local server is running
open http://localhost:3000/limits-runner.html
```

Click "Run All Limit Tests"

This runs ~18 tests across 7 categories.

### Option 3: Command Line

For CI/CD or automation:

```javascript
// In browser console or Node.js with jsdom
const runner = new TestRunner();
await registerLimitTests(runner);
const results = await runner.runAll();

// Download results
const markdown = window.limitResults.toMarkdown();
console.log(markdown);
```

## What You'll Learn

After running tests, you'll know:

- Maximum rows your browser can handle
- Database size limit before performance degrades
- Maximum field sizes for TEXT and BLOB
- Query complexity limits (JOINs, subqueries)
- Schema limits (columns, indexes)
- Encoding limits (base64, HTML size)
- Performance characteristics at scale

## Getting Results

### View in Browser

Results appear in the console log with detailed progress:

```
Binary search starting: range [1000, 1000000]
  Testing value: 500500 (range: 1000-1000000)
  Passed at 500500
  Testing value: 750250 (range: 500500-1000000)
  Failed at 750250
  Testing value: 625375 (range: 500500-750250)
  Passed at 625375
Binary search complete: limit found at 625375

Maximum rows found: 625,375
```

### Download Report

Click "Download Results" to get a markdown file:

```markdown
# HTML-SQLite Fusion System Limits

*Generated: 2026-01-13T10:30:00.000Z*

## Database Size Limits

### Maximum Rows in Single Table

- **Limit Found**: 625,375
- **Last Passed**: 625,375
- **First Failed**: 626,000
- **Notes**: Limited by memory and transaction size
```

### Use Results Programmatically

```javascript
// Access results object
const results = window.limitResults.getAll();

// Get specific category
const dbLimits = window.limitResults.get('Database Size');

console.log('Database limits:', dbLimits);
```

## Understanding Results

### What is "Binary Search"?

Instead of guessing limits, we **systematically find them**:

```
Step 1: Try 1,000 rows → Works
Step 2: Try 2,000 rows → Works  (double it)
Step 3: Try 4,000 rows → Works  (double it)
Step 4: Try 8,000 rows → Works  (double it)
...
Step N: Try 512,000 rows → Works
Step N+1: Try 1,024,000 rows → FAILS

Now we know the limit is between 512,000 and 1,024,000.

Binary search:
Try 768,000 → FAILS
Try 640,000 → Works
Try 704,000 → FAILS
Try 672,000 → Works
Try 688,000 → Works
Try 696,000 → FAILS
Try 692,000 → Works

Limit found: 692,000 rows
```

This finds **real limits**, not guessed values!

### Test That Passes vs. Fails

Each limit test creates:

1. **Test at limit**: Should pass
2. **Test just over limit**: Should fail

Example:

```javascript
// Found limit: 50,000 rows
// These tests verify it:

test('passes at limit', async () => {
  const fusion = new HTMLSQLiteFusion();
  await fusion.createDatabase();
  fusion.run('CREATE TABLE test (id INTEGER, value TEXT)');
  
  // Insert exactly 50,000 rows
  fusion.run('BEGIN TRANSACTION');
  for (let i = 0; i < 50000; i++) {
    fusion.run('INSERT INTO test VALUES (?, ?)', [i, 'value']);
  }
  fusion.run('COMMIT');
  
  // Should succeed
});

test('fails above limit', async () => {
  // Try 50,001 rows
  // Should fail
});
```

## Analyzing Your Results

### Good Results (Typical for 2026)

```
Maximum rows: 100,000+
Database size: 50-100 MB
TEXT field: 100+ MB
JOIN depth: 50+
Columns per table: 2,000+
Base64 encoding: 100+ MB
```

### Warning Signs

```
Maximum rows: <10,000        → Low memory available
Database size: <10 MB         → Memory pressure
TEXT field: <10 MB            → String length issues
JOIN depth: <10               → Parser issues
Test failures or crashes      → System overload
```

### What to Do with Low Limits

If your limits are lower than expected:

1. **Close other applications** - free up memory
2. **Close other browser tabs** - reduce memory pressure
3. **Restart browser** - clear memory leaks
4. **Update browser** - newer versions have improvements
5. **Check system resources** - ensure adequate RAM

## Next Steps

### After Running Tests

1. Review the results
   - Are limits acceptable for your use case?
   - Any concerning low values?

2. Document your findings
   - Save the markdown report
   - Share with team
   - Add to project docs

3. Design within limits
   - Keep databases smaller than max
   - Add warnings at 80% of limits
   - Plan for data archiving

4. Monitor in production
   - Track database sizes
   - Alert on approaching limits
   - Plan capacity

### Designing Your Application

Use discovered limits to set soft limits:

```javascript
// Based on test results:
// Maximum rows found: 500,000
// Set soft limit at 80%: 400,000

const SOFT_LIMITS = {
  MAX_ROWS: 400000,
  MAX_DB_SIZE: 80 * 1024 * 1024, // 80 MB (if max was 100 MB)
  MAX_TEXT_SIZE: 80 * 1024 * 1024, // 80 MB
  WARN_AT_PERCENT: 80
};

function checkLimits(fusion) {
  const dbSize = fusion.getDatabaseSize();
  
  if (dbSize > SOFT_LIMITS.MAX_DB_SIZE * 0.8) {
    showWarning('Database is getting large. Consider archiving old data.');
  }
  
  if (dbSize > SOFT_LIMITS.MAX_DB_SIZE) {
    showError('Database size limit reached. Please archive data.');
    return false;
  }
  
  return true;
}
```

### Testing Your Own Limits

Create custom tests for your specific use case:

```javascript
// Add to your test suite
runner.test('find limit: my blog posts', async () => {
  const testFn = async (postCount) => {
    const fusion = new HTMLSQLiteFusion();
    await fusion.createDatabase();
    
    fusion.run(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        title TEXT,
        content TEXT,
        tags TEXT,
        created_at DATETIME
      )
    `);
    
    fusion.run('BEGIN TRANSACTION');
    for (let i = 0; i < postCount; i++) {
      fusion.run(
        'INSERT INTO posts (title, content, tags, created_at) VALUES (?, ?, ?, ?)',
        [`Post ${i}`, 'Content...', 'tag1,tag2', new Date().toISOString()]
      );
    }
    fusion.run('COMMIT');
    
    // Can we query them efficiently?
    const start = performance.now();
    fusion.exec('SELECT * FROM posts ORDER BY created_at DESC LIMIT 10');
    const duration = performance.now() - start;
    
    fusion.close();
    
    // Pass if query is fast (<100ms)
    return duration < 100;
  };
  
  const result = await LimitFinder.findLimit(100, testFn);
  console.log(`Can handle ${result.limit} blog posts efficiently`);
});
```

## Re-running Tests

### When to Re-run

- After browser updates
- On different devices (laptop, tablet, phone)
- After code changes that affect database
- Before major releases
- When users report performance issues

### Comparing Results

```bash
# Run tests and save results
open limits-runner.html
# Download: limits-2026-01-13.md

# Later, run again
open limits-runner.html
# Download: limits-2026-02-15.md

# Compare files
diff limits-2026-01-13.md limits-2026-02-15.md
```

## Troubleshooting

### Tests Taking Too Long

Some tests may take 1-2 minutes each. This is normal for:
- Maximum database size
- Large BLOB tests
- Performance scaling tests

If tests take >5 minutes each:
- Browser might be slow
- System might be under load
- Try the "Quick Test" instead

### Tests Crashing Browser

If tests crash the browser tab:
1. Close other tabs
2. Restart browser
3. Run "Quick Test" instead of full suite
4. Run tests one category at a time

### Inconsistent Results

If results vary significantly between runs:
- Close other applications
- Restart browser
- Run tests when system is idle
- Update to latest browser version

### Low Limits

If limits are much lower than expected:
- Check available RAM
- Close other applications
- Try different browser
- Update browser to latest version

## Further Reading

- [Complete Limits Documentation](./LIMITS.md)
- [Testing Methodology](./LIMITS.md#testing-methodology)
- [Browser Differences](./LIMITS.md#browser-differences)
- [Recommendations](./LIMITS.md#recommendations)

---

**Ready to discover your system's limits?**

```bash
open limits-runner.html
```

Click "Quick Test" to start!

---

*Estimated time: 5 minutes for quick test, 15 minutes for full suite*
