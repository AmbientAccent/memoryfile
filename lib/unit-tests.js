/**
 * Unit Tests for HTML-SQLite Fusion Core Library
 */

async function registerUnitTests(runner) {
  const { Assert } = window;

  // ==========================================
  // Initialization Tests
  // ==========================================

  runner.describe("Initialization", () => {
    runner.test("should create new HTMLSQLiteFusion instance", () => {
      const fusion = new HTMLSQLiteFusion();
      Assert.assertNotNull(fusion);
      Assert.assertInstanceOf(fusion, HTMLSQLiteFusion);
    });

    runner.test("should accept custom options", () => {
      const fusion = new HTMLSQLiteFusion({
        embedId: "my-custom-db",
        autoSave: true,
        compression: true,
      });

      Assert.assertEqual(fusion.options.embedId, "my-custom-db");
      Assert.assertEqual(fusion.options.autoSave, true);
      Assert.assertEqual(fusion.options.compression, true);
    });

    runner.test("should have default options", () => {
      const fusion = new HTMLSQLiteFusion();

      Assert.assertEqual(fusion.options.embedId, "embedded-db");
      Assert.assertEqual(fusion.options.autoSave, false);
      Assert.assertEqual(fusion.options.compression, false);
    });
  });

  // ==========================================
  // Database Creation Tests
  // ==========================================

  runner.describe("Database Creation", () => {
    runner.test("should create empty database", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      Assert.assertNotNull(fusion.db);
      const tables = fusion.getTables();
      Assert.assertEqual(tables.length, 0);
    });

    runner.test("should create database with schema", async () => {
      const fusion = new HTMLSQLiteFusion();
      const schema = `
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
      `;

      await fusion.createDatabase(schema);
      const tables = fusion.getTables();

      Assert.assertEqual(tables.length, 1);
      Assert.assertEqual(tables[0], "test_table");
    });

    runner.test(
      "should throw error when executing SQL without database",
      () => {
        const fusion = new HTMLSQLiteFusion();

        Assert.assertThrows(() => {
          fusion.exec("SELECT 1");
        }, "Database not initialized");
      }
    );
  });

  // ==========================================
  // SQL Execution Tests
  // ==========================================

  runner.describe("SQL Execution", () => {
    runner.test("should execute CREATE TABLE", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
      const tables = fusion.getTables();

      Assert.assertContains(tables, "users");
    });

    runner.test("should INSERT data", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');

      const result = fusion.exec("SELECT * FROM users");
      Assert.assertEqual(result.length, 1);
      Assert.assertEqual(result[0].id, 1);
      Assert.assertEqual(result[0].name, "Alice");
    });

    runner.test("should INSERT with parameters", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");
      fusion.run("INSERT INTO users VALUES (?, ?)", [1, "Bob"]);

      const result = fusion.exec("SELECT * FROM users WHERE id = ?", [1]);
      Assert.assertEqual(result.length, 1);
      Assert.assertEqual(result[0].name, "Bob");
    });

    runner.test("should UPDATE data", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');
      fusion.run("UPDATE users SET name = ? WHERE id = ?", ["Alicia", 1]);

      const result = fusion.exec("SELECT name FROM users WHERE id = 1");
      Assert.assertEqual(result[0].name, "Alicia");
    });

    runner.test("should DELETE data", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');
      fusion.run("DELETE FROM users WHERE id = 1");

      const result = fusion.exec("SELECT * FROM users");
      Assert.assertEqual(result.length, 0);
    });

    runner.test("should handle SQL errors gracefully", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      Assert.assertThrows(() => {
        fusion.run("INVALID SQL STATEMENT");
      }, "SQL execution failed");
    });
  });

  // ==========================================
  // Prepared Statements Tests
  // ==========================================

  runner.describe("Prepared Statements", () => {
    runner.test("should prepare and execute statement", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');

      const stmt = fusion.prepare("SELECT * FROM users WHERE id = ?");
      stmt.bind([1]);

      Assert.assertTrue(stmt.step());
      const row = stmt.getAsObject();
      Assert.assertEqual(row.name, "Alice");

      stmt.free();
    });

    runner.test("should handle multiple executions", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");

      const stmt = fusion.prepare("INSERT INTO users VALUES (?, ?)");

      stmt.bind([1, "Alice"]);
      stmt.step();
      stmt.reset();

      stmt.bind([2, "Bob"]);
      stmt.step();
      stmt.reset();

      stmt.free();

      const result = fusion.exec("SELECT COUNT(*) as count FROM users");
      Assert.assertEqual(result[0].count, 2);
    });
  });

  // ==========================================
  // Database Export Tests
  // ==========================================

  runner.describe("Database Export", () => {
    runner.test("should export database to Uint8Array", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');

      const exported = fusion.exportDatabase();

      Assert.assertInstanceOf(exported, Uint8Array);
      Assert.assertGreaterThan(exported.length, 0);
    });

    runner.test("should export valid SQLite database", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');

      const exported = fusion.exportDatabase();

      // SQLite databases start with "SQLite format 3\0"
      const header = String.fromCharCode.apply(null, exported.slice(0, 15));
      Assert.assertContains(header, "SQLite format 3");
    });
  });

  // ==========================================
  // Base64 Encoding Tests
  // ==========================================

  runner.describe("Base64 Encoding", () => {
    runner.test("should encode Uint8Array to base64", () => {
      const fusion = new HTMLSQLiteFusion();
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const base64 = fusion.uint8ArrayToBase64(data);

      Assert.assertEqual(base64, "SGVsbG8=");
    });

    runner.test("should decode base64 to Uint8Array", () => {
      const fusion = new HTMLSQLiteFusion();
      const base64 = "SGVsbG8=";
      const data = fusion.base64ToUint8Array(base64);

      Assert.assertInstanceOf(data, Uint8Array);
      Assert.assertEqual(data[0], 72);
      Assert.assertEqual(data[1], 101);
      Assert.assertEqual(data[4], 111);
    });

    runner.test("should handle round-trip encoding", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (data TEXT)");
      fusion.run("INSERT INTO test VALUES (?)", ["Test Data"]);

      const exported = fusion.exportDatabase();
      const base64 = fusion.uint8ArrayToBase64(exported);
      const decoded = fusion.base64ToUint8Array(base64);

      Assert.assertEqual(exported.length, decoded.length);
      for (let i = 0; i < exported.length; i++) {
        Assert.assertEqual(exported[i], decoded[i]);
      }
    });

    runner.test("should handle large data", async () => {
      const fusion = new HTMLSQLiteFusion();
      const largeData = new Uint8Array(100000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const base64 = fusion.uint8ArrayToBase64(largeData);
      const decoded = fusion.base64ToUint8Array(base64);

      Assert.assertEqual(largeData.length, decoded.length);

      // Verify content integrity, not just length
      for (let i = 0; i < largeData.length; i += 10000) {
        Assert.assertEqual(largeData[i], decoded[i]);
      }
    });
  });

  // ==========================================
  // Database Metadata Tests
  // ==========================================

  runner.describe("Database Metadata", () => {
    runner.test("should get all tables", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE users (id INTEGER)");
      fusion.run("CREATE TABLE posts (id INTEGER)");
      fusion.run("CREATE TABLE comments (id INTEGER)");

      const tables = fusion.getTables();

      Assert.assertEqual(tables.length, 3);
      Assert.assertContains(tables, "users");
      Assert.assertContains(tables, "posts");
      Assert.assertContains(tables, "comments");
    });

    runner.test("should get table schema", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT
        )
      `);

      const schema = fusion.getTableSchema("users");

      Assert.assertEqual(schema.length, 3);
      Assert.assertEqual(schema[0].name, "id");
      Assert.assertEqual(schema[0].primaryKey, true);
      Assert.assertEqual(schema[1].name, "name");
      Assert.assertEqual(schema[1].notNull, true);
      Assert.assertEqual(schema[2].name, "email");
    });

    runner.test("should get and set database version", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      Assert.assertEqual(fusion.getVersion(), 0);

      fusion.setVersion(5);
      Assert.assertEqual(fusion.getVersion(), 5);

      fusion.setVersion(10);
      Assert.assertEqual(fusion.getVersion(), 10);
    });

    runner.test("should get database size", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");

      const size = fusion.getDatabaseSize();
      Assert.assertGreaterThan(size, 0);
    });

    runner.test("should calculate base64 size", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");

      const dbSize = fusion.getDatabaseSize();
      const base64Size = fusion.getBase64Size();

      // Base64 adds ~33% overhead
      Assert.assertGreaterThan(base64Size, dbSize);
    });
  });

  // ==========================================
  // Transaction Tests
  // ==========================================

  runner.describe("Transactions", () => {
    runner.test("should commit transaction", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");

      fusion.run("BEGIN TRANSACTION");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');
      fusion.run('INSERT INTO users VALUES (2, "Bob")');
      fusion.run("COMMIT");

      const result = fusion.exec("SELECT COUNT(*) as count FROM users");
      Assert.assertEqual(result[0].count, 2);
    });

    runner.test("should rollback transaction", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER, name TEXT)");

      fusion.run("BEGIN TRANSACTION");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');
      fusion.run('INSERT INTO users VALUES (2, "Bob")');
      fusion.run("ROLLBACK");

      const result = fusion.exec("SELECT COUNT(*) as count FROM users");
      Assert.assertEqual(result[0].count, 0);
    });

    runner.test("should handle transaction errors", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");

      fusion.run("BEGIN TRANSACTION");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');

      Assert.assertThrows(() => {
        // This should fail due to duplicate primary key
        fusion.run('INSERT INTO users VALUES (1, "Bob")');
      });

      fusion.run("ROLLBACK");
    });
  });

  // ==========================================
  // Browser Support Tests
  // ==========================================

  runner.describe("Browser Support Detection", () => {
    runner.test(
      "should detect File System Access API support as boolean",
      () => {
        const supported = HTMLSQLiteFusion.supportsFileSystemAccess();
        Assert.assertDefined(supported);
        // Verify it returns a boolean, not just any truthy/falsy value
        Assert.assertTrue(typeof supported === "boolean");
      }
    );

    runner.test("should detect OPFS support as boolean", async () => {
      const supported = await HTMLSQLiteFusion.supportsOPFS();
      Assert.assertDefined(supported);
      Assert.assertTrue(typeof supported === "boolean");
    });

    runner.test(
      "should get browser support info with correct structure",
      async () => {
        const support = await HTMLSQLiteFusion.getBrowserSupport();

        // Verify structure exists
        Assert.assertDefined(support.fileSystemAccess);
        Assert.assertDefined(support.opfs);
        Assert.assertDefined(support.webAssembly);
        Assert.assertDefined(support.localStorage);
        Assert.assertDefined(support.indexedDB);

        // Verify all values are booleans
        Assert.assertTrue(typeof support.fileSystemAccess === "boolean");
        Assert.assertTrue(typeof support.opfs === "boolean");
        Assert.assertTrue(typeof support.webAssembly === "boolean");
        Assert.assertTrue(typeof support.localStorage === "boolean");
        Assert.assertTrue(typeof support.indexedDB === "boolean");

        // WebAssembly should be true in any modern browser running these tests
        Assert.assertTrue(support.webAssembly);
      }
    );
  });

  // ==========================================
  // Error Handling Tests
  // ==========================================

  runner.describe("Error Handling", () => {
    runner.test("should handle invalid base64", () => {
      const fusion = new HTMLSQLiteFusion();

      Assert.assertThrows(() => {
        fusion.base64ToUint8Array("not-valid-base64!@#$");
      }, "Invalid base64 data");
    });

    runner.test("should handle missing embedded database", async () => {
      const fusion = new HTMLSQLiteFusion({ embedId: "non-existent" });

      await Assert.assertThrowsAsync(async () => {
        await fusion.loadEmbeddedDatabase();
      }, "No embedded database found");
    });

    runner.test(
      "should handle database operations on closed database",
      async () => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        fusion.close();

        Assert.assertNull(fusion.db);

        // Actually try to run an operation on the closed database
        Assert.assertThrows(() => {
          fusion.exec("SELECT 1");
        }, "Database not initialized");
      }
    );
  });

  // ==========================================
  // Memory Management Tests
  // ==========================================

  runner.describe("Memory Management", () => {
    runner.test("should close database", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      Assert.assertNotNull(fusion.db);

      fusion.close();

      Assert.assertNull(fusion.db);
    });

    runner.test("should handle close on null database", () => {
      const fusion = new HTMLSQLiteFusion();

      // Should not throw
      fusion.close();
      Assert.assertNull(fusion.db);
    });
  });

  // ==========================================
  // Index Tests
  // ==========================================

  runner.describe("Database Indexes", () => {
    runner.test("should create and use index", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE users (id INTEGER, email TEXT)");
      fusion.run("CREATE INDEX idx_email ON users(email)");

      // Insert test data
      for (let i = 0; i < 100; i++) {
        fusion.run("INSERT INTO users VALUES (?, ?)", [
          i,
          `user${i}@example.com`,
        ]);
      }

      // Query should use index
      const result = fusion.exec("SELECT * FROM users WHERE email = ?", [
        "user50@example.com",
      ]);
      Assert.assertEqual(result.length, 1);
      Assert.assertEqual(result[0].id, 50);
    });
  });

  // ==========================================
  // Foreign Key Tests
  // ==========================================

  runner.describe("Foreign Keys", () => {
    runner.test("should enforce foreign key constraints", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("PRAGMA foreign_keys = ON");
      fusion.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
      fusion.run(`CREATE TABLE posts (
        id INTEGER PRIMARY KEY, 
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      fusion.run('INSERT INTO users VALUES (1, "Alice")');
      fusion.run("INSERT INTO posts VALUES (1, 1)"); // Should succeed

      Assert.assertThrows(() => {
        fusion.run("INSERT INTO posts VALUES (2, 999)"); // Should fail
      });
    });
  });
}

// Export for use in test runner
if (typeof module !== "undefined" && module.exports) {
  module.exports = { registerUnitTests };
}
