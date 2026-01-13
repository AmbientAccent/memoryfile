/**
 * Test Utilities for HTML-SQLite Fusion
 * Provides testing framework and helper functions
 */

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0
    };
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Register a test
   */
  test(name, fn, options = {}) {
    this.tests.push({
      name,
      fn,
      skip: options.skip || false,
      only: options.only || false,
      timeout: options.timeout || 5000
    });
  }

  /**
   * Register a test suite
   */
  describe(suiteName, fn) {
    const suite = {
      name: suiteName,
      tests: []
    };
    
    // Temporarily redirect test registration
    const originalTest = this.test.bind(this);
    this.test = (name, testFn, options) => {
      suite.tests.push({
        name: `${suiteName} - ${name}`,
        fn: testFn,
        skip: options?.skip || false,
        only: options?.only || false,
        timeout: options?.timeout || 5000
      });
    };
    
    fn();
    
    // Restore original test function
    this.test = originalTest;
    
    // Add suite tests to main tests
    this.tests.push(...suite.tests);
  }

  /**
   * Run all registered tests
   */
  async runAll(outputElement = null) {
    this.startTime = Date.now();
    this.results = { passed: 0, failed: 0, skipped: 0, total: 0 };
    
    // Check if there are any "only" tests
    const onlyTests = this.tests.filter(t => t.only);
    const testsToRun = onlyTests.length > 0 ? onlyTests : this.tests;
    
    this.results.total = testsToRun.length;
    
    this.log('🧪 Running tests...\n', outputElement);
    
    for (const test of testsToRun) {
      if (test.skip) {
        this.results.skipped++;
        this.log(`⊘ SKIPPED: ${test.name}`, outputElement, 'skip');
        continue;
      }
      
      try {
        await this.runTest(test, outputElement);
        this.results.passed++;
        this.log(`✓ PASSED: ${test.name}`, outputElement, 'pass');
      } catch (error) {
        this.results.failed++;
        this.log(`✗ FAILED: ${test.name}`, outputElement, 'fail');
        this.log(`  Error: ${error.message}`, outputElement, 'error');
        if (error.stack) {
          this.log(`  ${error.stack}`, outputElement, 'error');
        }
      }
    }
    
    this.endTime = Date.now();
    this.printSummary(outputElement);
    
    return this.results;
  }

  /**
   * Run a single test with timeout
   */
  async runTest(test, outputElement) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Test timeout after ${test.timeout}ms`));
      }, test.timeout);
      
      try {
        const result = test.fn();
        
        if (result instanceof Promise) {
          result
            .then(() => {
              clearTimeout(timeoutId);
              resolve();
            })
            .catch(err => {
              clearTimeout(timeoutId);
              reject(err);
            });
        } else {
          clearTimeout(timeoutId);
          resolve();
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Print test summary
   */
  printSummary(outputElement) {
    const duration = this.endTime - this.startTime;
    this.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', outputElement);
    this.log('📊 Test Summary', outputElement, 'summary');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', outputElement);
    this.log(`Total: ${this.results.total}`, outputElement);
    this.log(`✓ Passed: ${this.results.passed}`, outputElement, 'pass');
    this.log(`✗ Failed: ${this.results.failed}`, outputElement, 'fail');
    this.log(`⊘ Skipped: ${this.results.skipped}`, outputElement, 'skip');
    this.log(`Duration: ${duration}ms`, outputElement);
    
    const successRate = this.results.total > 0 
      ? ((this.results.passed / this.results.total) * 100).toFixed(1)
      : 0;
    this.log(`Success Rate: ${successRate}%`, outputElement);
  }

  /**
   * Log output to console and optional DOM element
   */
  log(message, outputElement, type = 'info') {
    console.log(message);
    
    if (outputElement) {
      const line = document.createElement('div');
      line.className = `test-log test-log-${type}`;
      line.textContent = message;
      outputElement.appendChild(line);
    }
  }

  /**
   * Clear all tests
   */
  clear() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, skipped: 0, total: 0 };
  }
}

/**
 * Assertion utilities
 */
class Assert {
  static assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
      );
    }
  }

  static assertNotEqual(actual, expected, message = '') {
    if (actual === expected) {
      throw new Error(
        message || `Expected values to be different but both are ${JSON.stringify(actual)}`
      );
    }
  }

  static assertTrue(value, message = '') {
    if (value !== true) {
      throw new Error(message || `Expected true but got ${JSON.stringify(value)}`);
    }
  }

  static assertFalse(value, message = '') {
    if (value !== false) {
      throw new Error(message || `Expected false but got ${JSON.stringify(value)}`);
    }
  }

  static assertNull(value, message = '') {
    if (value !== null) {
      throw new Error(message || `Expected null but got ${JSON.stringify(value)}`);
    }
  }

  static assertNotNull(value, message = '') {
    if (value === null) {
      throw new Error(message || 'Expected value to not be null');
    }
  }

  static assertUndefined(value, message = '') {
    if (value !== undefined) {
      throw new Error(message || `Expected undefined but got ${JSON.stringify(value)}`);
    }
  }

  static assertDefined(value, message = '') {
    if (value === undefined) {
      throw new Error(message || 'Expected value to be defined');
    }
  }

  static assertThrows(fn, expectedError = null, message = '') {
    let threw = false;
    let error = null;
    
    try {
      fn();
    } catch (e) {
      threw = true;
      error = e;
    }
    
    if (!threw) {
      throw new Error(message || 'Expected function to throw an error');
    }
    
    if (expectedError) {
      if (typeof expectedError === 'string') {
        if (!error.message.includes(expectedError)) {
          throw new Error(
            `Expected error message to include "${expectedError}" but got "${error.message}"`
          );
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(error.message)) {
          throw new Error(
            `Expected error message to match ${expectedError} but got "${error.message}"`
          );
        }
      }
    }
  }

  static async assertThrowsAsync(fn, expectedError = null, message = '') {
    let threw = false;
    let error = null;
    
    try {
      await fn();
    } catch (e) {
      threw = true;
      error = e;
    }
    
    if (!threw) {
      throw new Error(message || 'Expected async function to throw an error');
    }
    
    if (expectedError) {
      if (typeof expectedError === 'string') {
        if (!error.message.includes(expectedError)) {
          throw new Error(
            `Expected error message to include "${expectedError}" but got "${error.message}"`
          );
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(error.message)) {
          throw new Error(
            `Expected error message to match ${expectedError} but got "${error.message}"`
          );
        }
      }
    }
  }

  static assertArrayEqual(actual, expected, message = '') {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      throw new Error('Both values must be arrays');
    }
    
    if (actual.length !== expected.length) {
      throw new Error(
        message || `Array lengths differ: expected ${expected.length}, got ${actual.length}`
      );
    }
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(
          message || `Arrays differ at index ${i}: expected ${expected[i]}, got ${actual[i]}`
        );
      }
    }
  }

  static assertObjectEqual(actual, expected, message = '') {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    
    if (actualKeys.length !== expectedKeys.length) {
      throw new Error(
        message || `Object key counts differ: expected ${expectedKeys.length}, got ${actualKeys.length}`
      );
    }
    
    for (const key of expectedKeys) {
      if (actual[key] !== expected[key]) {
        throw new Error(
          message || `Objects differ at key "${key}": expected ${expected[key]}, got ${actual[key]}`
        );
      }
    }
  }

  static assertGreaterThan(actual, expected, message = '') {
    if (actual <= expected) {
      throw new Error(
        message || `Expected ${actual} to be greater than ${expected}`
      );
    }
  }

  static assertLessThan(actual, expected, message = '') {
    if (actual >= expected) {
      throw new Error(
        message || `Expected ${actual} to be less than ${expected}`
      );
    }
  }

  static assertContains(haystack, needle, message = '') {
    if (typeof haystack === 'string') {
      if (!haystack.includes(needle)) {
        throw new Error(
          message || `Expected string to contain "${needle}"`
        );
      }
    } else if (Array.isArray(haystack)) {
      if (!haystack.includes(needle)) {
        throw new Error(
          message || `Expected array to contain ${JSON.stringify(needle)}`
        );
      }
    } else {
      throw new Error('haystack must be a string or array');
    }
  }

  static assertNotContains(haystack, needle, message = '') {
    if (typeof haystack === 'string') {
      if (haystack.includes(needle)) {
        throw new Error(
          message || `Expected string to not contain "${needle}"`
        );
      }
    } else if (Array.isArray(haystack)) {
      if (haystack.includes(needle)) {
        throw new Error(
          message || `Expected array to not contain ${JSON.stringify(needle)}`
        );
      }
    } else {
      throw new Error('haystack must be a string or array');
    }
  }

  static assertInstanceOf(value, type, message = '') {
    if (!(value instanceof type)) {
      throw new Error(
        message || `Expected value to be instance of ${type.name}`
      );
    }
  }
}

/**
 * Mock database helper
 */
class MockDatabase {
  static createTestSchema() {
    return `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE INDEX idx_posts_user_id ON posts(user_id);
    `;
  }

  static insertTestData(fusion) {
    // Insert users
    fusion.run(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      ['Alice', 'alice@example.com']
    );
    fusion.run(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      ['Bob', 'bob@example.com']
    );
    fusion.run(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      ['Charlie', 'charlie@example.com']
    );
    
    // Insert posts
    fusion.run(
      'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
      [1, 'First Post', 'Hello World!']
    );
    fusion.run(
      'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
      [1, 'Second Post', 'Another post by Alice']
    );
    fusion.run(
      'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
      [2, 'Bob\'s Post', 'Bob writes something']
    );
  }

  static createLargeDataset(fusion, rowCount = 1000) {
    fusion.run('BEGIN TRANSACTION');
    
    for (let i = 0; i < rowCount; i++) {
      fusion.run(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        [`User${i}`, `user${i}@example.com`]
      );
    }
    
    fusion.run('COMMIT');
  }
}

/**
 * Performance measurement utilities
 */
class PerformanceTest {
  static async measure(name, fn, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return {
      name,
      iterations,
      average: avg,
      min,
      max,
      total: times.reduce((a, b) => a + b, 0)
    };
  }

  static formatResults(results) {
    return `
      ${results.name}:
      - Iterations: ${results.iterations}
      - Average: ${results.average.toFixed(2)}ms
      - Min: ${results.min.toFixed(2)}ms
      - Max: ${results.max.toFixed(2)}ms
      - Total: ${results.total.toFixed(2)}ms
    `.trim();
  }
}

/**
 * Test data generators
 */
class TestDataGenerator {
  static randomString(length = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static randomEmail() {
    return `${this.randomString(8)}@${this.randomString(6)}.com`;
  }

  static randomInt(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static randomDate(start = new Date(2020, 0, 1), end = new Date()) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    TestRunner,
    Assert,
    MockDatabase,
    PerformanceTest,
    TestDataGenerator
  };
} else if (typeof window !== 'undefined') {
  // Browser environment - attach to window
  window.TestRunner = TestRunner;
  window.Assert = Assert;
  window.MockDatabase = MockDatabase;
  window.PerformanceTest = PerformanceTest;
  window.TestDataGenerator = TestDataGenerator;
}
