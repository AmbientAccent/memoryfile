/**
 * Limits Testing Suite for HTML-SQLite Fusion
 * 
 * This suite systematically discovers and verifies the actual limits of the system.
 * Tests use binary search and iterative approaches to find true boundaries.
 * Each limit test includes a test that fails at the limit and one that passes just below.
 */

class LimitFinder {
  /**
   * Binary search to find the maximum value that passes a test
   * 
   * @param {number} min - Known passing value
   * @param {number} max - Known failing value (or estimated upper bound)
   * @param {Function} testFn - Async test function that returns true if passes, false if fails
   * @param {number} tolerance - Acceptable difference between min and max
   * @returns {Promise<{limit: number, passed: number, failed: number}>}
   */
  static async binarySearch(min, max, testFn, tolerance = 1) {
    let low = min;
    let high = max;
    let lastPassed = min;
    let lastFailed = max;
    
    console.log(`🔍 Binary search starting: range [${min}, ${max}]`);
    
    while (high - low > tolerance) {
      const mid = Math.floor((low + high) / 2);
      console.log(`  Testing value: ${mid} (range: ${low}-${high})`);
      
      try {
        const passed = await testFn(mid);
        
        if (passed) {
          console.log(`  ✓ Passed at ${mid}`);
          low = mid;
          lastPassed = mid;
        } else {
          console.log(`  ✗ Failed at ${mid}`);
          high = mid;
          lastFailed = mid;
        }
      } catch (error) {
        console.log(`  ✗ Error at ${mid}: ${error.message}`);
        high = mid;
        lastFailed = mid;
      }
    }
    
    console.log(`🎯 Binary search complete: limit found at ${lastPassed}`);
    return {
      limit: lastPassed,
      passed: lastPassed,
      failed: lastFailed
    };
  }
  
  /**
   * Exponential search to quickly find an upper bound
   * Starts at a base value and doubles until failure
   */
  static async exponentialSearch(base, testFn, maxIterations = 20) {
    let value = base;
    let lastPassed = base;
    
    console.log(`🚀 Exponential search starting from ${base}`);
    
    for (let i = 0; i < maxIterations; i++) {
      console.log(`  Testing value: ${value}`);
      
      try {
        const passed = await testFn(value);
        
        if (passed) {
          console.log(`  ✓ Passed at ${value}`);
          lastPassed = value;
          value *= 2;
        } else {
          console.log(`  ✗ Failed at ${value}`);
          return { lastPassed, firstFailed: value };
        }
      } catch (error) {
        console.log(`  ✗ Error at ${value}: ${error.message}`);
        return { lastPassed, firstFailed: value };
      }
    }
    
    console.log(`⚠️ Reached max iterations at ${value}`);
    return { lastPassed, firstFailed: value };
  }
  
  /**
   * Find limit using exponential search followed by binary search
   */
  static async findLimit(initialGuess, testFn, options = {}) {
    const {
      tolerance = 1,
      maxValue = initialGuess * 1000,
      skipExponential = false
    } = options;
    
    if (skipExponential) {
      return await this.binarySearch(1, maxValue, testFn, tolerance);
    }
    
    // First, exponential search to find rough bounds
    const { lastPassed, firstFailed } = await this.exponentialSearch(initialGuess, testFn);
    
    // Then binary search to find exact limit
    return await this.binarySearch(lastPassed, firstFailed, testFn, tolerance);
  }
}

/**
 * Limit test results tracker
 */
class LimitResults {
  constructor() {
    this.results = new Map();
  }
  
  record(category, testName, result) {
    if (!this.results.has(category)) {
      this.results.set(category, []);
    }
    
    this.results.get(category).push({
      testName,
      ...result,
      timestamp: new Date().toISOString()
    });
  }
  
  get(category) {
    return this.results.get(category) || [];
  }
  
  getAll() {
    return Object.fromEntries(this.results);
  }
  
  toMarkdown() {
    let md = '# HTML-SQLite Fusion System Limits\n\n';
    md += `*Generated: ${new Date().toISOString()}*\n\n`;
    md += '---\n\n';
    
    for (const [category, tests] of this.results) {
      md += `## ${category}\n\n`;
      
      for (const test of tests) {
        md += `### ${test.testName}\n\n`;
        md += `- **Limit Found**: ${test.limit}\n`;
        md += `- **Last Passed**: ${test.passed}\n`;
        md += `- **First Failed**: ${test.failed}\n`;
        
        if (test.details) {
          md += `- **Details**: ${test.details}\n`;
        }
        
        if (test.notes) {
          md += `- **Notes**: ${test.notes}\n`;
        }
        
        md += '\n';
      }
      
      md += '---\n\n';
    }
    
    return md;
  }
}

/**
 * Register all limit tests
 */
async function registerLimitTests(runner) {
  const { Assert, PerformanceTest, TestDataGenerator } = window;
  const limitResults = new LimitResults();
  
  // Make limitResults available globally for inspection
  window.limitResults = limitResults;
  
  // ==========================================
  // Database Size Limits
  // ==========================================
  
  runner.describe('Database Size Limits', () => {
    runner.test('find limit: maximum rows in single table', async () => {
      console.log('\n🎯 Finding maximum rows limit...\n');
      
      const testFn = async (rowCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
          fusion.run('BEGIN TRANSACTION');
          
          for (let i = 0; i < rowCount; i++) {
            fusion.run('INSERT INTO test VALUES (?, ?)', [i, `value${i}`]);
          }
          
          fusion.run('COMMIT');
          
          // Verify data
          const result = fusion.exec('SELECT COUNT(*) as count FROM test');
          const count = result[0].count;
          
          fusion.close();
          
          return count === rowCount;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(1000, testFn, {
        tolerance: 100
      });
      
      limitResults.record('Database Size', 'Maximum Rows in Single Table', {
        ...result,
        notes: 'Limited by memory and transaction size'
      });
      
      console.log(`\n✅ Maximum rows found: ${result.limit}`);
      Assert.assertGreaterThan(result.limit, 10000, 'Should support at least 10,000 rows');
    }, { timeout: 60000 });
    
    runner.test('find limit: database size in bytes', async () => {
      console.log('\n🎯 Finding maximum database size in bytes...\n');
      
      const testFn = async (rowCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
          fusion.run('BEGIN TRANSACTION');
          
          // Use 1KB strings to make database grow
          const bigString = 'x'.repeat(1024);
          
          for (let i = 0; i < rowCount; i++) {
            fusion.run('INSERT INTO test VALUES (?, ?)', [i, bigString]);
          }
          
          fusion.run('COMMIT');
          
          const dbSize = fusion.getDatabaseSize();
          console.log(`  Database size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);
          
          fusion.close();
          
          return true;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(100, testFn, {
        tolerance: 10
      });
      
      // Calculate actual size
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
      fusion.run('BEGIN TRANSACTION');
      const bigString = 'x'.repeat(1024);
      for (let i = 0; i < result.limit; i++) {
        fusion.run('INSERT INTO test VALUES (?, ?)', [i, bigString]);
      }
      fusion.run('COMMIT');
      const maxSize = fusion.getDatabaseSize();
      fusion.close();
      
      limitResults.record('Database Size', 'Maximum Database Size (bytes)', {
        ...result,
        details: `${(maxSize / 1024 / 1024).toFixed(2)} MB`,
        notes: 'Limited by WASM memory allocation'
      });
      
      console.log(`\n✅ Maximum database size: ${(maxSize / 1024 / 1024).toFixed(2)} MB`);
    }, { timeout: 120000 });
    
    runner.test('find limit: maximum number of tables', async () => {
      console.log('\n🎯 Finding maximum number of tables...\n');
      
      const testFn = async (tableCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          for (let i = 0; i < tableCount; i++) {
            fusion.run(`CREATE TABLE table_${i} (id INTEGER PRIMARY KEY, value TEXT)`);
          }
          
          const tables = fusion.getTables();
          fusion.close();
          
          return tables.length === tableCount;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(10, testFn, {
        tolerance: 1
      });
      
      limitResults.record('Database Size', 'Maximum Number of Tables', {
        ...result,
        notes: 'SQLite theoretical limit is very high, practical limit depends on memory'
      });
      
      console.log(`\n✅ Maximum tables: ${result.limit}`);
      Assert.assertGreaterThan(result.limit, 100, 'Should support at least 100 tables');
    }, { timeout: 60000 });
  });
  
  // ==========================================
  // Data Size Limits
  // ==========================================
  
  runner.describe('Data Size Limits', () => {
    runner.test('find limit: maximum string/TEXT field size', async () => {
      console.log('\n🎯 Finding maximum TEXT field size...\n');
      
      const testFn = async (stringSize) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
          
          const bigString = 'x'.repeat(stringSize);
          fusion.run('INSERT INTO test VALUES (?, ?)', [1, bigString]);
          
          const result = fusion.exec('SELECT length(data) as len FROM test');
          const length = result[0].len;
          
          fusion.close();
          
          return length === stringSize;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(1000, testFn, {
        tolerance: 1000
      });
      
      limitResults.record('Data Size', 'Maximum TEXT Field Size (chars)', {
        ...result,
        details: `${(result.limit / 1024 / 1024).toFixed(2)} MB`,
        notes: 'SQLite default limit is 1 billion bytes, but memory constrains this'
      });
      
      console.log(`\n✅ Maximum TEXT field size: ${(result.limit / 1024 / 1024).toFixed(2)} MB`);
    }, { timeout: 120000 });
    
    runner.test('find limit: maximum BLOB size', async () => {
      console.log('\n🎯 Finding maximum BLOB size...\n');
      
      const testFn = async (blobSize) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, data BLOB)');
          
          const bigBlob = new Uint8Array(blobSize);
          for (let i = 0; i < Math.min(blobSize, 1000); i++) {
            bigBlob[i] = i % 256;
          }
          
          fusion.run('INSERT INTO test VALUES (?, ?)', [1, bigBlob]);
          
          const result = fusion.exec('SELECT length(data) as len FROM test');
          const length = result[0].len;
          
          fusion.close();
          
          return length === blobSize;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(10000, testFn, {
        tolerance: 1000
      });
      
      limitResults.record('Data Size', 'Maximum BLOB Size (bytes)', {
        ...result,
        details: `${(result.limit / 1024 / 1024).toFixed(2)} MB`,
        notes: 'Limited by memory allocation'
      });
      
      console.log(`\n✅ Maximum BLOB size: ${(result.limit / 1024 / 1024).toFixed(2)} MB`);
    }, { timeout: 120000 });
  });
  
  // ==========================================
  // Query Complexity Limits
  // ==========================================
  
  runner.describe('Query Complexity Limits', () => {
    runner.test('find limit: maximum JOIN depth', async () => {
      console.log('\n🎯 Finding maximum JOIN depth...\n');
      
      const testFn = async (joinDepth) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          // Create tables
          for (let i = 0; i <= joinDepth; i++) {
            fusion.run(`CREATE TABLE t${i} (id INTEGER PRIMARY KEY, value TEXT)`);
            fusion.run(`INSERT INTO t${i} VALUES (1, 'value${i}')`);
          }
          
          // Build JOIN query
          let query = 'SELECT t0.id';
          let fromClause = ' FROM t0';
          
          for (let i = 1; i <= joinDepth; i++) {
            fromClause += ` JOIN t${i} ON t${i - 1}.id = t${i}.id`;
          }
          
          query += fromClause;
          
          const result = fusion.exec(query);
          fusion.close();
          
          return result.length > 0;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(5, testFn, {
        tolerance: 1
      });
      
      limitResults.record('Query Complexity', 'Maximum JOIN Depth', {
        ...result,
        notes: 'SQLite can handle very deep JOINs, limited by compilation time'
      });
      
      console.log(`\n✅ Maximum JOIN depth: ${result.limit}`);
      Assert.assertGreaterThan(result.limit, 10, 'Should support at least 10-way JOINs');
    }, { timeout: 60000 });
    
    runner.test('find limit: maximum WHERE clause conditions', async () => {
      console.log('\n🎯 Finding maximum WHERE clause conditions...\n');
      
      const testFn = async (conditionCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)');
          fusion.run('INSERT INTO test VALUES (1, 100)');
          
          // Build WHERE clause with many OR conditions
          let whereClause = 'WHERE ';
          const conditions = [];
          for (let i = 0; i < conditionCount; i++) {
            conditions.push(`value = ${i}`);
          }
          whereClause += conditions.join(' OR ');
          
          const query = `SELECT * FROM test ${whereClause}`;
          const result = fusion.exec(query);
          
          fusion.close();
          
          return true; // If we get here, it worked
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(10, testFn, {
        tolerance: 10
      });
      
      limitResults.record('Query Complexity', 'Maximum WHERE Conditions', {
        ...result,
        notes: 'Limited by SQL statement length and parser'
      });
      
      console.log(`\n✅ Maximum WHERE conditions: ${result.limit}`);
    }, { timeout: 60000 });
    
    runner.test('find limit: maximum compound SELECT depth', async () => {
      console.log('\n🎯 Finding maximum compound SELECT depth...\n');
      
      const testFn = async (depth) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)');
          fusion.run('INSERT INTO test VALUES (1, 100)');
          
          // Build nested query
          let query = 'SELECT * FROM test';
          for (let i = 0; i < depth; i++) {
            query = `SELECT * FROM (${query})`;
          }
          
          const result = fusion.exec(query);
          fusion.close();
          
          return result.length > 0;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(5, testFn, {
        tolerance: 1
      });
      
      limitResults.record('Query Complexity', 'Maximum Compound SELECT Depth', {
        ...result,
        notes: 'Limited by SQLite parser recursion depth'
      });
      
      console.log(`\n✅ Maximum compound SELECT depth: ${result.limit}`);
    }, { timeout: 60000 });
  });
  
  // ==========================================
  // Schema Limits
  // ==========================================
  
  runner.describe('Schema Limits', () => {
    runner.test('find limit: maximum columns per table', async () => {
      console.log('\n🎯 Finding maximum columns per table...\n');
      
      const testFn = async (columnCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          // Build CREATE TABLE statement
          const columns = ['id INTEGER PRIMARY KEY'];
          for (let i = 1; i < columnCount; i++) {
            columns.push(`col${i} TEXT`);
          }
          
          fusion.run(`CREATE TABLE test (${columns.join(', ')})`);
          
          // Insert a row
          const values = [1, ...Array(columnCount - 1).fill('test')];
          const placeholders = Array(columnCount).fill('?').join(', ');
          fusion.run(`INSERT INTO test VALUES (${placeholders})`, values);
          
          const result = fusion.exec('SELECT * FROM test');
          fusion.close();
          
          return result.length > 0;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(10, testFn, {
        tolerance: 10
      });
      
      limitResults.record('Schema', 'Maximum Columns Per Table', {
        ...result,
        notes: 'SQLite default maximum is 2000, can be increased to 32767'
      });
      
      console.log(`\n✅ Maximum columns: ${result.limit}`);
      Assert.assertGreaterThan(result.limit, 100, 'Should support at least 100 columns');
    }, { timeout: 60000 });
    
    runner.test('find limit: maximum indexes per table', async () => {
      console.log('\n🎯 Finding maximum indexes per table...\n');
      
      const testFn = async (indexCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          // Create table with enough columns
          const columns = ['id INTEGER PRIMARY KEY'];
          for (let i = 1; i <= indexCount; i++) {
            columns.push(`col${i} INTEGER`);
          }
          fusion.run(`CREATE TABLE test (${columns.join(', ')})`);
          
          // Create indexes
          for (let i = 1; i <= indexCount; i++) {
            fusion.run(`CREATE INDEX idx${i} ON test(col${i})`);
          }
          
          fusion.close();
          return true;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(5, testFn, {
        tolerance: 1
      });
      
      limitResults.record('Schema', 'Maximum Indexes Per Table', {
        ...result,
        notes: 'Practical limit, SQLite theoretical limit is much higher'
      });
      
      console.log(`\n✅ Maximum indexes: ${result.limit}`);
    }, { timeout: 60000 });
  });
  
  // ==========================================
  // Encoding Limits
  // ==========================================
  
  runner.describe('Encoding Limits', () => {
    runner.test('find limit: maximum base64 encodable size', async () => {
      console.log('\n🎯 Finding maximum base64 encodable size...\n');
      
      const testFn = async (byteSize) => {
        const fusion = new HTMLSQLiteFusion();
        
        try {
          const data = new Uint8Array(byteSize);
          // Fill with some data
          for (let i = 0; i < Math.min(byteSize, 1000); i++) {
            data[i] = i % 256;
          }
          
          const base64 = fusion.uint8ArrayToBase64(data);
          const decoded = fusion.base64ToUint8Array(base64);
          
          return decoded.length === byteSize;
        } catch (error) {
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(100000, testFn, {
        tolerance: 10000
      });
      
      limitResults.record('Encoding', 'Maximum Base64 Encodable Size', {
        ...result,
        details: `${(result.limit / 1024 / 1024).toFixed(2)} MB`,
        notes: 'Limited by JavaScript string length (depends on browser)'
      });
      
      console.log(`\n✅ Maximum base64 size: ${(result.limit / 1024 / 1024).toFixed(2)} MB`);
    }, { timeout: 120000 });
    
    runner.test('find limit: maximum HTML rebuild size', async () => {
      console.log('\n🎯 Finding maximum HTML rebuild size...\n');
      
      const testFn = async (rowCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
          fusion.run('BEGIN TRANSACTION');
          
          const bigString = 'x'.repeat(1000);
          for (let i = 0; i < rowCount; i++) {
            fusion.run('INSERT INTO test VALUES (?, ?)', [i, bigString]);
          }
          
          fusion.run('COMMIT');
          
          // Try to export and rebuild HTML
          const exported = fusion.exportDatabase();
          const base64 = fusion.uint8ArrayToBase64(exported);
          const html = fusion.rebuildHTML(base64);
          
          fusion.close();
          
          return html.length > 0;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(100, testFn, {
        tolerance: 10
      });
      
      limitResults.record('Encoding', 'Maximum HTML Rebuild Size', {
        ...result,
        notes: 'Limited by DOM manipulation and string concatenation'
      });
      
      console.log(`\n✅ Maximum HTML rebuild at ${result.limit} rows`);
    }, { timeout: 120000 });
  });
  
  // ==========================================
  // Transaction Limits
  // ==========================================
  
  runner.describe('Transaction Limits', () => {
    runner.test('find limit: maximum statements in single transaction', async () => {
      console.log('\n🎯 Finding maximum statements in transaction...\n');
      
      const testFn = async (statementCount) => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        
        try {
          fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
          fusion.run('BEGIN TRANSACTION');
          
          for (let i = 0; i < statementCount; i++) {
            fusion.run('INSERT INTO test VALUES (?, ?)', [i, `value${i}`]);
          }
          
          fusion.run('COMMIT');
          
          const result = fusion.exec('SELECT COUNT(*) as count FROM test');
          const count = result[0].count;
          
          fusion.close();
          
          return count === statementCount;
        } catch (error) {
          fusion.close();
          return false;
        }
      };
      
      const result = await LimitFinder.findLimit(1000, testFn, {
        tolerance: 100
      });
      
      limitResults.record('Transactions', 'Maximum Statements Per Transaction', {
        ...result,
        notes: 'Limited by memory for rollback journal'
      });
      
      console.log(`\n✅ Maximum transaction statements: ${result.limit}`);
    }, { timeout: 120000 });
  });
  
  // ==========================================
  // Performance Under Load
  // ==========================================
  
  runner.describe('Performance at Limits', () => {
    runner.test('verify: performance with large row count', async () => {
      console.log('\n🎯 Testing performance with large datasets...\n');
      
      const rowCounts = [1000, 5000, 10000, 50000];
      const results = [];
      
      for (const rowCount of rowCounts) {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        fusion.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
        
        const insertTime = await PerformanceTest.measure(
          `Insert ${rowCount} rows`,
          () => {
            fusion.run('BEGIN TRANSACTION');
            for (let i = 0; i < rowCount; i++) {
              fusion.run('INSERT INTO test VALUES (?, ?)', [i, `value${i}`]);
            }
            fusion.run('COMMIT');
          },
          1
        );
        
        const selectTime = await PerformanceTest.measure(
          `Select all ${rowCount} rows`,
          () => {
            fusion.exec('SELECT * FROM test');
          },
          1
        );
        
        const dbSize = fusion.getDatabaseSize();
        
        results.push({
          rowCount,
          insertTime: insertTime.average,
          selectTime: selectTime.average,
          dbSize
        });
        
        console.log(`  ${rowCount} rows: Insert=${insertTime.average.toFixed(2)}ms, Select=${selectTime.average.toFixed(2)}ms, Size=${(dbSize / 1024).toFixed(2)}KB`);
        
        fusion.close();
      }
      
      limitResults.record('Performance', 'Performance Scaling with Row Count', {
        limit: 'N/A',
        passed: 'N/A',
        failed: 'N/A',
        details: JSON.stringify(results, null, 2),
        notes: 'Performance characteristics at various data sizes'
      });
      
      // Verify linear-ish scaling (not exponential)
      for (let i = 1; i < results.length; i++) {
        const ratio = results[i].insertTime / results[i - 1].insertTime;
        const sizeRatio = results[i].rowCount / results[i - 1].rowCount;
        
        console.log(`  Size increased ${sizeRatio}x, insert time increased ${ratio.toFixed(2)}x`);
        
        // Performance shouldn't degrade more than 3x when data size increases
        Assert.assertLessThan(ratio, sizeRatio * 3, 
          `Insert performance degraded too much: ${ratio}x vs ${sizeRatio}x increase`);
      }
    }, { timeout: 180000 });
  });
  
  // ==========================================
  // Final summary test
  // ==========================================
  
  runner.test('generate limits documentation', async () => {
    console.log('\n📝 Generating limits documentation...\n');
    
    const markdown = limitResults.toMarkdown();
    
    // Log to console
    console.log(markdown);
    
    // Also make it available for download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    console.log('\n📊 Limits documentation generated!');
    console.log('To download: Use window.limitResults.toMarkdown() and save to file');
    
    // Verify we found some limits
    Assert.assertGreaterThan(limitResults.results.size, 0, 'Should have recorded some limits');
  });
}

// Export for use in test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerLimitTests, LimitFinder, LimitResults };
}
