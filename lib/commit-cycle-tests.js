/**
 * Commit Cycle Integration Tests
 * Tests full save/load/commit workflow as it works on the homepage
 */

async function registerCommitCycleTests(runner) {
  const { Assert } = window;

  // Helper to generate commit hash (mirrors homepage logic)
  async function generateHash(data) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(data))
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8);
  }

  // Simulates the homepage MemoryFile behavior
  class MemoryFileSimulator {
    constructor() {
      this.db = null;
      this.sqlJS = null;
      this.metadata = {
        commitHash: null,
        parentHash: null,
        commitMessage: null,
        commitDate: null
      };
    }

    async init() {
      this.sqlJS = await initSqlJs({ locateFile: f => `lib/${f}` });
      this.db = new this.sqlJS.Database();
      this.createSchema();
      await this.ensureInitialCommit();
    }

    createSchema() {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      this.db.run(`
        CREATE TABLE IF NOT EXISTS commits (
          hash TEXT PRIMARY KEY,
          parent_hash TEXT,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
    }

    async ensureInitialCommit() {
      if (this.metadata.commitHash !== null) return;

      const now = new Date().toISOString();
      const commitData = {
        timestamp: Date.now(),
        message: 'Initial commit',
        firstOpen: true
      };
      const commitHash = await generateHash(commitData);

      this.metadata = {
        commitHash,
        parentHash: null,
        commitMessage: 'Initial commit',
        commitDate: now
      };

      this.db.run(
        'INSERT OR IGNORE INTO commits (hash, parent_hash, message, created_at) VALUES (?, ?, ?, ?)',
        [this.metadata.commitHash, null, this.metadata.commitMessage, this.metadata.commitDate]
      );
    }

    isFirstRun() {
      const result = this.db.exec('SELECT COUNT(*) FROM commits');
      return result.length > 0 && result[0].values[0][0] <= 1;
    }

    getEntryCount() {
      const result = this.db.exec('SELECT COUNT(*) FROM entries');
      return result[0]?.values[0]?.[0] || 0;
    }

    getCommitCount() {
      const result = this.db.exec('SELECT COUNT(*) FROM commits');
      return result[0]?.values[0]?.[0] || 0;
    }

    getCommits() {
      const result = this.db.exec('SELECT hash, parent_hash, message, created_at FROM commits ORDER BY created_at DESC');
      if (!result.length) return [];
      return result[0].values.map(([hash, parent_hash, message, created_at]) => ({
        hash, parent_hash, message, created_at
      }));
    }

    async addEntry(text) {
      // Add entry
      this.db.run(
        'INSERT INTO entries (text, created_at) VALUES (?, ?)',
        [text, new Date().toISOString()]
      );

      // Generate commit
      const dbBytes = this.db.export();
      const commitData = {
        db: btoa(String.fromCharCode(...dbBytes.slice(0, 100))), // partial for hash
        timestamp: Date.now(),
        text: text.slice(0, 50),
        parent: this.metadata.commitHash
      };
      const newHash = await generateHash(commitData);
      const now = new Date().toISOString();

      // Add commit
      this.db.run(
        'INSERT INTO commits (hash, parent_hash, message, created_at) VALUES (?, ?, ?, ?)',
        [newHash, this.metadata.commitHash, text.slice(0, 50), now]
      );

      // Update metadata
      this.metadata = {
        commitHash: newHash,
        parentHash: this.metadata.commitHash,
        commitMessage: text.slice(0, 50),
        commitDate: now
      };

      return newHash;
    }

    // Export state as if saving HTML file
    exportState() {
      return {
        dbBase64: btoa(String.fromCharCode(...this.db.export())),
        metadata: { ...this.metadata }
      };
    }

    // Import state as if loading saved HTML file
    async importState(state) {
      const bytes = Uint8Array.from(atob(state.dbBase64), c => c.charCodeAt(0));
      this.db = new this.sqlJS.Database(bytes);
      this.metadata = { ...state.metadata };
    }

    clearData() {
      this.db.run('DELETE FROM entries');
      this.db.run('DELETE FROM commits WHERE parent_hash IS NOT NULL');
    }

    close() {
      if (this.db) this.db.close();
    }
  }

  // ==========================================
  // Commit Cycle Tests
  // ==========================================

  runner.describe('Commit Cycle - Initial State', () => {
    runner.test('should generate real initial commit on first open', async () => {
      const mf = new MemoryFileSimulator();
      await mf.init();

      // Should have generated initial commit
      Assert.assertNotNull(mf.metadata.commitHash);
      Assert.assertEqual(mf.metadata.commitHash.length, 8);
      Assert.assertNull(mf.metadata.parentHash);
      Assert.assertEqual(mf.metadata.commitMessage, 'Initial commit');
      Assert.assertNotNull(mf.metadata.commitDate);

      // Should be first run
      Assert.assertTrue(mf.isFirstRun());
      Assert.assertEqual(mf.getCommitCount(), 1);
      Assert.assertEqual(mf.getEntryCount(), 0);

      mf.close();
    });

    runner.test('should have unique hash each initialization', async () => {
      const mf1 = new MemoryFileSimulator();
      await mf1.init();
      const hash1 = mf1.metadata.commitHash;
      mf1.close();

      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 10));

      const mf2 = new MemoryFileSimulator();
      await mf2.init();
      const hash2 = mf2.metadata.commitHash;
      mf2.close();

      Assert.assertNotEqual(hash1, hash2);
    });
  });

  runner.describe('Commit Cycle - Single Save', () => {
    runner.test('should create second commit on first entry', async () => {
      const mf = new MemoryFileSimulator();
      await mf.init();

      const initialHash = mf.metadata.commitHash;
      Assert.assertTrue(mf.isFirstRun());

      // Add first entry
      const newHash = await mf.addEntry('My first note');

      Assert.assertNotEqual(newHash, initialHash);
      Assert.assertEqual(mf.metadata.parentHash, initialHash);
      Assert.assertFalse(mf.isFirstRun());
      Assert.assertEqual(mf.getCommitCount(), 2);
      Assert.assertEqual(mf.getEntryCount(), 1);

      mf.close();
    });

    runner.test('should preserve state through save/load cycle', async () => {
      const mf1 = new MemoryFileSimulator();
      await mf1.init();
      await mf1.addEntry('Test entry');
      
      const state = mf1.exportState();
      const originalHash = mf1.metadata.commitHash;
      const originalCommitCount = mf1.getCommitCount();
      mf1.close();

      // Simulate opening saved file
      const mf2 = new MemoryFileSimulator();
      mf2.sqlJS = await initSqlJs({ locateFile: f => `lib/${f}` });
      await mf2.importState(state);

      Assert.assertEqual(mf2.metadata.commitHash, originalHash);
      Assert.assertEqual(mf2.getCommitCount(), originalCommitCount);
      Assert.assertFalse(mf2.isFirstRun());

      mf2.close();
    });
  });

  runner.describe('Commit Cycle - Multiple Commits', () => {
    runner.test('should handle 4 sequential commits correctly', async () => {
      const mf = new MemoryFileSimulator();
      await mf.init();

      const hashes = [mf.metadata.commitHash];

      // Add 4 entries
      for (let i = 1; i <= 4; i++) {
        const hash = await mf.addEntry(`Entry number ${i}`);
        hashes.push(hash);
      }

      // Should have 5 commits total (1 initial + 4 entries)
      Assert.assertEqual(mf.getCommitCount(), 5);
      Assert.assertEqual(mf.getEntryCount(), 4);
      Assert.assertFalse(mf.isFirstRun());

      // Verify commit chain structure
      const commits = mf.getCommits();
      Assert.assertEqual(commits.length, 5);

      // Build hash set for validation
      const hashSet = new Set(hashes);
      
      // All commits should have hashes we generated
      for (const commit of commits) {
        Assert.assertTrue(hashSet.has(commit.hash));
      }

      // Current metadata should point to last entry
      Assert.assertEqual(mf.metadata.commitHash, hashes[4]);
      Assert.assertEqual(mf.metadata.parentHash, hashes[3]);

      // Find initial commit and verify it has no parent
      const initialCommit = commits.find(c => c.message === 'Initial commit');
      Assert.assertNotNull(initialCommit);
      Assert.assertNull(initialCommit.parent_hash);

      mf.close();
    });

    runner.test('should maintain chain through multiple save/load cycles', async () => {
      let state = null;

      // Cycle 1: Create and add first entry
      const mf1 = new MemoryFileSimulator();
      await mf1.init();
      await mf1.addEntry('Cycle 1 entry');
      state = mf1.exportState();
      const hash1 = mf1.metadata.commitHash;
      mf1.close();

      // Cycle 2: Load, add second entry
      const mf2 = new MemoryFileSimulator();
      mf2.sqlJS = await initSqlJs({ locateFile: f => `lib/${f}` });
      await mf2.importState(state);
      Assert.assertEqual(mf2.metadata.commitHash, hash1);
      await mf2.addEntry('Cycle 2 entry');
      state = mf2.exportState();
      const hash2 = mf2.metadata.commitHash;
      Assert.assertEqual(mf2.metadata.parentHash, hash1);
      mf2.close();

      // Cycle 3: Load, add third entry
      const mf3 = new MemoryFileSimulator();
      mf3.sqlJS = await initSqlJs({ locateFile: f => `lib/${f}` });
      await mf3.importState(state);
      Assert.assertEqual(mf3.metadata.commitHash, hash2);
      await mf3.addEntry('Cycle 3 entry');
      state = mf3.exportState();
      const hash3 = mf3.metadata.commitHash;
      Assert.assertEqual(mf3.metadata.parentHash, hash2);
      mf3.close();

      // Cycle 4: Load, verify full chain
      const mf4 = new MemoryFileSimulator();
      mf4.sqlJS = await initSqlJs({ locateFile: f => `lib/${f}` });
      await mf4.importState(state);

      Assert.assertEqual(mf4.getCommitCount(), 4); // initial + 3 entries
      Assert.assertEqual(mf4.getEntryCount(), 3);

      const commits = mf4.getCommits();
      Assert.assertEqual(commits[0].hash, hash3);
      Assert.assertEqual(commits[0].parent_hash, hash2);
      Assert.assertEqual(commits[1].hash, hash2);
      Assert.assertEqual(commits[1].parent_hash, hash1);

      mf4.close();
    });
  });

  runner.describe('Commit Cycle - Clear Data', () => {
    runner.test('should reset to first-run state after clear', async () => {
      const mf = new MemoryFileSimulator();
      await mf.init();

      // Add some entries
      await mf.addEntry('Entry 1');
      await mf.addEntry('Entry 2');
      Assert.assertFalse(mf.isFirstRun());
      Assert.assertEqual(mf.getEntryCount(), 2);
      Assert.assertEqual(mf.getCommitCount(), 3);

      // Clear data
      mf.clearData();

      // Should be back to first-run state
      Assert.assertTrue(mf.isFirstRun());
      Assert.assertEqual(mf.getEntryCount(), 0);
      Assert.assertEqual(mf.getCommitCount(), 1);

      mf.close();
    });

    runner.test('should allow new commits after clear', async () => {
      const mf = new MemoryFileSimulator();
      await mf.init();
      const initialHash = mf.metadata.commitHash;

      await mf.addEntry('Before clear');
      mf.clearData();
      
      // Add new entry after clear
      const newHash = await mf.addEntry('After clear');

      Assert.assertNotEqual(newHash, initialHash);
      Assert.assertEqual(mf.getCommitCount(), 2);
      Assert.assertEqual(mf.getEntryCount(), 1);

      mf.close();
    });
  });

  runner.describe('Commit Cycle - FUX Detection', () => {
    runner.test('isFirstRun should be true only with single commit', async () => {
      const mf = new MemoryFileSimulator();
      await mf.init();

      Assert.assertTrue(mf.isFirstRun());

      await mf.addEntry('First entry');
      Assert.assertFalse(mf.isFirstRun());

      await mf.addEntry('Second entry');
      Assert.assertFalse(mf.isFirstRun());

      mf.close();
    });

    runner.test('isFirstRun should persist through save/load', async () => {
      // New file - first run
      const mf1 = new MemoryFileSimulator();
      await mf1.init();
      Assert.assertTrue(mf1.isFirstRun());
      await mf1.addEntry('Entry');
      Assert.assertFalse(mf1.isFirstRun());
      const state = mf1.exportState();
      mf1.close();

      // Reload - should NOT be first run
      const mf2 = new MemoryFileSimulator();
      mf2.sqlJS = await initSqlJs({ locateFile: f => `lib/${f}` });
      await mf2.importState(state);
      Assert.assertFalse(mf2.isFirstRun());

      mf2.close();
    });
  });
}

// Export for use in test runner
if (typeof window !== 'undefined') {
  window.registerCommitCycleTests = registerCommitCycleTests;
}
