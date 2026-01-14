/**
 * Integration Tests for HTML-SQLite Fusion
 * Tests full workflows and interactions between components
 */

async function registerIntegrationTests(runner) {
  const { Assert, MockDatabase, TestDataGenerator } = window;

  // ==========================================
  // Complete Workflow Tests
  // ==========================================

  runner.describe("Complete Workflow", () => {
    runner.test("should complete full CRUD cycle", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      // CREATE
      fusion.run(
        "CREATE TABLE todos (id INTEGER PRIMARY KEY, task TEXT, done INTEGER)"
      );

      // INSERT
      fusion.run("INSERT INTO todos (task, done) VALUES (?, ?)", [
        "Buy milk",
        0,
      ]);
      fusion.run("INSERT INTO todos (task, done) VALUES (?, ?)", [
        "Walk dog",
        0,
      ]);

      // READ
      let result = fusion.exec("SELECT * FROM todos");
      Assert.assertEqual(result.length, 2);

      // UPDATE
      fusion.run("UPDATE todos SET done = 1 WHERE id = 1");
      result = fusion.exec("SELECT done FROM todos WHERE id = 1");
      Assert.assertEqual(result[0].done, 1);

      // DELETE
      fusion.run("DELETE FROM todos WHERE id = 1");
      result = fusion.exec("SELECT COUNT(*) as count FROM todos");
      Assert.assertEqual(result[0].count, 1);

      fusion.close();
    });

    runner.test(
      "should handle database creation with initial data",
      async () => {
        const fusion = new HTMLSQLiteFusion();
        const schema = MockDatabase.createTestSchema();

        await fusion.createDatabase(schema);
        MockDatabase.insertTestData(fusion);

        // Verify structure
        const tables = fusion.getTables();
        Assert.assertContains(tables, "users");
        Assert.assertContains(tables, "posts");

        // Verify data
        const users = fusion.exec("SELECT COUNT(*) as count FROM users");
        Assert.assertEqual(users[0].count, 3);

        const posts = fusion.exec("SELECT COUNT(*) as count FROM posts");
        Assert.assertEqual(posts[0].count, 3);

        fusion.close();
      }
    );

    runner.test("should handle complex joins", async () => {
      const fusion = new HTMLSQLiteFusion();
      const schema = MockDatabase.createTestSchema();

      await fusion.createDatabase(schema);
      MockDatabase.insertTestData(fusion);

      const result = fusion.exec(`
        SELECT u.name, COUNT(p.id) as post_count
        FROM users u
        LEFT JOIN posts p ON u.id = p.user_id
        GROUP BY u.id
        ORDER BY post_count DESC
      `);

      Assert.assertEqual(result.length, 3);
      Assert.assertEqual(result[0].name, "Alice");
      Assert.assertEqual(result[0].post_count, 2);

      fusion.close();
    });
  });

  // ==========================================
  // Save and Load Cycle Tests
  // ==========================================

  runner.describe("Save and Load Cycle", () => {
    runner.test(
      "should preserve data through export/import cycle",
      async () => {
        const fusion1 = new HTMLSQLiteFusion();
        await fusion1.createDatabase();

        fusion1.run("CREATE TABLE test (id INTEGER, value TEXT)");
        fusion1.run('INSERT INTO test VALUES (1, "Test Data")');
        fusion1.run('INSERT INTO test VALUES (2, "More Data")');

        // Export
        const exported = fusion1.exportDatabase();
        fusion1.close();

        // Import into new instance
        const fusion2 = new HTMLSQLiteFusion();
        await fusion2.initSQL();
        fusion2.db = new fusion2.sqlJS.Database(exported);

        // Verify data
        const result = fusion2.exec("SELECT * FROM test ORDER BY id");
        Assert.assertEqual(result.length, 2);
        Assert.assertEqual(result[0].id, 1);
        Assert.assertEqual(result[0].value, "Test Data");
        Assert.assertEqual(result[1].id, 2);
        Assert.assertEqual(result[1].value, "More Data");

        fusion2.close();
      }
    );

    runner.test("should handle base64 encoding in save cycle", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE data (content TEXT)");
      fusion.run("INSERT INTO data VALUES (?)", ["Important information"]);

      // Simulate save
      const exported = fusion.exportDatabase();
      const base64 = fusion.uint8ArrayToBase64(exported);

      // Simulate load
      const decoded = fusion.base64ToUint8Array(base64);

      await fusion.initSQL();
      fusion.db = new fusion.sqlJS.Database(decoded);

      const result = fusion.exec("SELECT * FROM data");
      Assert.assertEqual(result[0].content, "Important information");

      fusion.close();
    });

    runner.test("should rebuild HTML correctly", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE test (data TEXT)");
      fusion.run("INSERT INTO test VALUES (?)", ["test"]);

      const exported = fusion.exportDatabase();
      const base64 = fusion.uint8ArrayToBase64(exported);

      const html = fusion.rebuildHTML(base64);

      // Verify HTML structure
      Assert.assertContains(html, "<!DOCTYPE html>");
      Assert.assertContains(html, "<script");
      Assert.assertContains(html, "embedded-db");
      Assert.assertContains(html, base64);

      fusion.close();
    });
  });

  // ==========================================
  // Multi-Table Operations Tests
  // ==========================================

  runner.describe("Multi-Table Operations", () => {
    runner.test("should handle cascading deletes", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("PRAGMA foreign_keys = ON");
      fusion.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
      fusion.run(`CREATE TABLE posts (
        id INTEGER PRIMARY KEY, 
        user_id INTEGER,
        title TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      fusion.run('INSERT INTO users VALUES (1, "Alice")');
      fusion.run('INSERT INTO posts VALUES (1, 1, "Post 1")');
      fusion.run('INSERT INTO posts VALUES (2, 1, "Post 2")');

      // Delete user should cascade to posts
      fusion.run("DELETE FROM users WHERE id = 1");

      const posts = fusion.exec("SELECT COUNT(*) as count FROM posts");
      Assert.assertEqual(posts[0].count, 0);

      fusion.close();
    });

    runner.test("should maintain referential integrity", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("PRAGMA foreign_keys = ON");
      fusion.run("CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT)");
      fusion.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY, 
        category_id INTEGER NOT NULL,
        name TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`);

      fusion.run('INSERT INTO categories VALUES (1, "Electronics")');
      fusion.run('INSERT INTO products VALUES (1, 1, "Laptop")');

      // Should not be able to delete category with products
      Assert.assertThrows(() => {
        fusion.run("DELETE FROM categories WHERE id = 1");
      });

      fusion.close();
    });

    runner.test("should handle complex multi-table transactions", async () => {
      const fusion = new HTMLSQLiteFusion();
      const schema = MockDatabase.createTestSchema();
      await fusion.createDatabase(schema);

      fusion.run("BEGIN TRANSACTION");

      // Insert user
      fusion.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "David",
        "david@example.com",
      ]);

      // Get the inserted user ID
      const userResult = fusion.exec("SELECT last_insert_rowid() as id");
      const userId = userResult[0].id;

      // Insert posts for that user
      fusion.run(
        "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
        [userId, "First Post", "Content here"]
      );
      fusion.run(
        "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
        [userId, "Second Post", "More content"]
      );

      fusion.run("COMMIT");

      // Verify
      const posts = fusion.exec(
        "SELECT COUNT(*) as count FROM posts WHERE user_id = ?",
        [userId]
      );
      Assert.assertEqual(posts[0].count, 2);

      fusion.close();
    });
  });

  // ==========================================
  // Data Migration Tests
  // ==========================================

  runner.describe("Data Migration", () => {
    runner.test("should migrate database schema v1 to v2", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      // V1 schema
      fusion.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
      fusion.run('INSERT INTO users VALUES (1, "Alice")');
      fusion.setVersion(1);

      // Check version
      Assert.assertEqual(fusion.getVersion(), 1);

      // Migrate to V2 - add email column
      const currentVersion = fusion.getVersion();
      if (currentVersion < 2) {
        fusion.run("ALTER TABLE users ADD COLUMN email TEXT");
        fusion.setVersion(2);
      }

      // Verify migration
      Assert.assertEqual(fusion.getVersion(), 2);
      const schema = fusion.getTableSchema("users");
      const hasEmail = schema.some((col) => col.name === "email");
      Assert.assertTrue(hasEmail);

      // Verify data preserved
      const result = fusion.exec("SELECT name FROM users WHERE id = 1");
      Assert.assertEqual(result[0].name, "Alice");

      fusion.close();
    });

    runner.test("should handle multiple migration steps", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      // Initial schema (v0)
      fusion.run("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)");

      // Migrate to v1
      if (fusion.getVersion() < 1) {
        fusion.run("ALTER TABLE products ADD COLUMN price REAL");
        fusion.setVersion(1);
      }

      // Migrate to v2
      if (fusion.getVersion() < 2) {
        fusion.run("ALTER TABLE products ADD COLUMN description TEXT");
        fusion.setVersion(2);
      }

      // Migrate to v3
      if (fusion.getVersion() < 3) {
        fusion.run("CREATE INDEX idx_products_name ON products(name)");
        fusion.setVersion(3);
      }

      Assert.assertEqual(fusion.getVersion(), 3);

      const schema = fusion.getTableSchema("products");
      Assert.assertEqual(schema.length, 4); // id, name, price, description

      fusion.close();
    });
  });

  // ==========================================
  // Performance Tests (Light)
  // ==========================================

  runner.describe("Performance", () => {
    runner.test("should handle bulk inserts efficiently", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE test_data (id INTEGER, value TEXT)");

      const start = performance.now();

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test_data VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const duration = performance.now() - start;

      // Should complete in reasonable time (less than 1 second)
      Assert.assertLessThan(duration, 1000);

      const count = fusion.exec("SELECT COUNT(*) as count FROM test_data");
      Assert.assertEqual(count[0].count, 1000);

      fusion.close();
    });

    runner.test("should query indexed data efficiently", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)");
      fusion.run("CREATE INDEX idx_email ON users(email)");

      // Insert 1000 records
      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO users VALUES (?, ?)", [
          i,
          `user${i}@example.com`,
        ]);
      }
      fusion.run("COMMIT");

      // Query should be fast with index
      const start = performance.now();
      const result = fusion.exec("SELECT * FROM users WHERE email = ?", [
        "user500@example.com",
      ]);
      const duration = performance.now() - start;

      Assert.assertEqual(result.length, 1);
      Assert.assertLessThan(duration, 50); // Should be very fast with index

      fusion.close();
    });
  });

  // ==========================================
  // Real-World Scenario Tests
  // ==========================================

  runner.describe("Real-World Scenarios", () => {
    runner.test("Todo App: Complete workflow", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      // Setup
      fusion.run(`
        CREATE TABLE todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          completed INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add todos
      fusion.run("INSERT INTO todos (title) VALUES (?)", ["Buy groceries"]);
      fusion.run("INSERT INTO todos (title) VALUES (?)", ["Finish report"]);
      fusion.run("INSERT INTO todos (title) VALUES (?)", ["Call dentist"]);

      // Mark one as complete
      fusion.run("UPDATE todos SET completed = 1 WHERE id = 1");

      // Get active todos
      const active = fusion.exec("SELECT * FROM todos WHERE completed = 0");
      Assert.assertEqual(active.length, 2);

      // Get completed todos
      const completed = fusion.exec("SELECT * FROM todos WHERE completed = 1");
      Assert.assertEqual(completed.length, 1);

      // Delete a todo
      fusion.run("DELETE FROM todos WHERE id = 2");

      // Final count
      const total = fusion.exec("SELECT COUNT(*) as count FROM todos");
      Assert.assertEqual(total[0].count, 2);

      fusion.close();
    });

    runner.test("Note Taking: Full-text search", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      // FTS5 is not available in standard SQLite WASM builds
      // Use LIKE-based search as fallback
      fusion.run(`CREATE TABLE notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT
      )`);

      // Add notes
      fusion.run("INSERT INTO notes (title, content) VALUES (?, ?)", [
        "Shopping List",
        "Buy milk, eggs, bread",
      ]);
      fusion.run("INSERT INTO notes (title, content) VALUES (?, ?)", [
        "Meeting Notes",
        "Discuss project timeline and milestones",
      ]);
      fusion.run("INSERT INTO notes (title, content) VALUES (?, ?)", [
        "Recipe",
        "Chocolate chip cookies with milk",
      ]);

      // Search for "milk" using LIKE
      const results = fusion.exec(`
        SELECT * FROM notes WHERE title LIKE '%milk%' OR content LIKE '%milk%'
      `);

      Assert.assertEqual(results.length, 2);

      fusion.close();
    });

    runner.test("Contact Manager: Complex queries", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run(`
        CREATE TABLE contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          category TEXT,
          favorite INTEGER DEFAULT 0
        )
      `);

      // Add contacts
      const contacts = [
        ["Alice Johnson", "alice@example.com", "555-0001", "Work", 1],
        ["Bob Smith", "bob@example.com", "555-0002", "Personal", 0],
        ["Charlie Brown", "charlie@example.com", "555-0003", "Work", 1],
        ["Diana Prince", "diana@example.com", "555-0004", "Personal", 0],
      ];

      fusion.run("BEGIN TRANSACTION");
      for (const contact of contacts) {
        fusion.run(
          "INSERT INTO contacts (name, email, phone, category, favorite) VALUES (?, ?, ?, ?, ?)",
          contact
        );
      }
      fusion.run("COMMIT");

      // Get favorites
      const favorites = fusion.exec(
        "SELECT COUNT(*) as count FROM contacts WHERE favorite = 1"
      );
      Assert.assertEqual(favorites[0].count, 2);

      // Get work contacts
      const work = fusion.exec(
        "SELECT * FROM contacts WHERE category = ? ORDER BY name",
        ["Work"]
      );
      Assert.assertEqual(work.length, 2);

      // Search by name
      const search = fusion.exec("SELECT * FROM contacts WHERE name LIKE ?", [
        "%Brown%",
      ]);
      Assert.assertEqual(search.length, 1);
      Assert.assertEqual(search[0].name, "Charlie Brown");

      fusion.close();
    });
  });

  // ==========================================
  // Edge Cases Tests
  // ==========================================

  runner.describe("Edge Cases", () => {
    runner.test("should handle empty database", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      const tables = fusion.getTables();
      Assert.assertEqual(tables.length, 0);

      // Note: sql.js in-memory databases may return 0 bytes until modified
      // Creating a table ensures the database has content
      fusion.run("CREATE TABLE _init (id INTEGER)");
      fusion.run("DROP TABLE _init");

      const size = fusion.getDatabaseSize();
      Assert.assertGreaterThan(size, 0); // DB has data after modification

      fusion.close();
    });

    runner.test("should handle special characters in data", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE test (data TEXT)");

      const specialChars =
        "Hello \"World\" 'Single' <tags> & symbols 日本語 emoji 🎉";
      fusion.run("INSERT INTO test VALUES (?)", [specialChars]);

      const result = fusion.exec("SELECT * FROM test");
      Assert.assertEqual(result[0].data, specialChars);

      fusion.close();
    });

    runner.test("should handle null values", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE test (id INTEGER, name TEXT, value TEXT)");
      fusion.run('INSERT INTO test VALUES (1, "Alice", NULL)');
      fusion.run('INSERT INTO test VALUES (2, NULL, "value")');

      const result = fusion.exec("SELECT * FROM test ORDER BY id");
      Assert.assertEqual(result[0].value, null);
      Assert.assertEqual(result[1].name, null);

      fusion.close();
    });

    runner.test("should handle very long text", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE test (content TEXT)");

      const longText = "a".repeat(10000);
      fusion.run("INSERT INTO test VALUES (?)", [longText]);

      const result = fusion.exec("SELECT length(content) as len FROM test");
      Assert.assertEqual(result[0].len, 10000);

      fusion.close();
    });

    runner.test("should handle table with no data", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run("CREATE TABLE empty_table (id INTEGER, value TEXT)");

      const result = fusion.exec("SELECT * FROM empty_table");
      Assert.assertEqual(result.length, 0);

      fusion.close();
    });
  });
}

// Export for use in test runner
if (typeof module !== "undefined" && module.exports) {
  module.exports = { registerIntegrationTests };
}
