/**
 * Performance Benchmark Suite for HTML-SQLite Fusion
 * Measures performance of various operations
 */

async function registerPerformanceTests(runner) {
  const { Assert, PerformanceTest, TestDataGenerator } = window;

  // ==========================================
  // Database Initialization Benchmarks
  // ==========================================

  runner.describe("Initialization Performance", () => {
    runner.test("benchmark: create empty database", async () => {
      const result = await PerformanceTest.measure(
        "Create empty database",
        async () => {
          const fusion = new HTMLSQLiteFusion();
          await fusion.createDatabase();
          fusion.close();
        },
        10 // 10 iterations
      );

      console.log(PerformanceTest.formatResults(result));
      Assert.assertLessThan(result.average, 100); // Should be fast
    });

    runner.test("benchmark: create database with schema", async () => {
      const schema = `
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
        CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, content TEXT);
        CREATE INDEX idx_posts_user ON posts(user_id);
      `;

      const result = await PerformanceTest.measure(
        "Create database with schema",
        async () => {
          const fusion = new HTMLSQLiteFusion();
          await fusion.createDatabase(schema);
          fusion.close();
        },
        10
      );

      console.log(PerformanceTest.formatResults(result));
      Assert.assertLessThan(result.average, 150);
    });
  });

  // ==========================================
  // Insert Performance Benchmarks
  // ==========================================

  runner.describe("Insert Performance", () => {
    runner.test("benchmark: single inserts (100 rows)", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, name TEXT, email TEXT)");

      const result = await PerformanceTest.measure(
        "Insert 100 rows individually",
        () => {
          for (let i = 0; i < 100; i++) {
            fusion.run("INSERT INTO test VALUES (?, ?, ?)", [
              i,
              TestDataGenerator.randomString(),
              TestDataGenerator.randomEmail(),
            ]);
          }
        },
        5
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });

    runner.test("benchmark: transaction inserts (1000 rows)", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, name TEXT, email TEXT)");

      const result = await PerformanceTest.measure(
        "Insert 1000 rows in transaction",
        () => {
          fusion.run("BEGIN TRANSACTION");
          for (let i = 0; i < 1000; i++) {
            fusion.run("INSERT INTO test VALUES (?, ?, ?)", [
              i,
              TestDataGenerator.randomString(),
              TestDataGenerator.randomEmail(),
            ]);
          }
          fusion.run("COMMIT");
        },
        3
      );

      console.log(PerformanceTest.formatResults(result));
      Assert.assertLessThan(result.average, 500); // Should complete in 500ms
      fusion.close();
    });

    runner.test(
      "benchmark: bulk insert (10000 rows)",
      async () => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        fusion.run("CREATE TABLE test (id INTEGER, name TEXT)");

        const result = await PerformanceTest.measure(
          "Insert 10000 rows",
          () => {
            fusion.run("BEGIN TRANSACTION");
            for (let i = 0; i < 10000; i++) {
              fusion.run("INSERT INTO test VALUES (?, ?)", [i, `name${i}`]);
            }
            fusion.run("COMMIT");
          },
          1
        );

        console.log(PerformanceTest.formatResults(result));
        Assert.assertLessThan(result.average, 2000); // Should complete in 2 seconds
        fusion.close();
      },
      { timeout: 10000 }
    );
  });

  // ==========================================
  // Query Performance Benchmarks
  // ==========================================

  runner.describe("Query Performance", () => {
    runner.test("benchmark: simple SELECT on 1000 rows", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, value TEXT)");

      // Insert test data
      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "SELECT all rows (1000)",
        () => {
          fusion.exec("SELECT * FROM test");
        },
        10
      );

      console.log(PerformanceTest.formatResults(result));
      Assert.assertLessThan(result.average, 100);
      fusion.close();
    });

    runner.test(
      "benchmark: indexed vs non-indexed search",
      async () => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        fusion.run("CREATE TABLE test (id INTEGER, email TEXT)");

        // Insert test data
        fusion.run("BEGIN TRANSACTION");
        for (let i = 0; i < 5000; i++) {
          fusion.run("INSERT INTO test VALUES (?, ?)", [
            i,
            `user${i}@example.com`,
          ]);
        }
        fusion.run("COMMIT");

        // Test without index
        const withoutIndex = await PerformanceTest.measure(
          "Search without index",
          () => {
            fusion.exec("SELECT * FROM test WHERE email = ?", [
              "user2500@example.com",
            ]);
          },
          10
        );

        // Create index
        fusion.run("CREATE INDEX idx_email ON test(email)");

        // Test with index
        const withIndex = await PerformanceTest.measure(
          "Search with index",
          () => {
            fusion.exec("SELECT * FROM test WHERE email = ?", [
              "user2500@example.com",
            ]);
          },
          10
        );

        console.log(
          "Without Index:",
          PerformanceTest.formatResults(withoutIndex)
        );
        console.log("With Index:", PerformanceTest.formatResults(withIndex));

        // Index should be faster
        Assert.assertLessThan(withIndex.average, withoutIndex.average);

        fusion.close();
      },
      { timeout: 15000 }
    );

    runner.test(
      "benchmark: complex JOIN query",
      async () => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();

        fusion.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
        fusion.run(
          "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT)"
        );
        fusion.run(
          "CREATE TABLE comments (id INTEGER PRIMARY KEY, post_id INTEGER, content TEXT)"
        );

        // Insert test data
        fusion.run("BEGIN TRANSACTION");
        for (let i = 1; i <= 100; i++) {
          fusion.run("INSERT INTO users VALUES (?, ?)", [i, `User${i}`]);
          for (let j = 1; j <= 5; j++) {
            const postId = (i - 1) * 5 + j;
            fusion.run("INSERT INTO posts VALUES (?, ?, ?)", [
              postId,
              i,
              `Post${postId}`,
            ]);
            for (let k = 1; k <= 3; k++) {
              const commentId = (postId - 1) * 3 + k;
              fusion.run("INSERT INTO comments VALUES (?, ?, ?)", [
                commentId,
                postId,
                `Comment${commentId}`,
              ]);
            }
          }
        }
        fusion.run("COMMIT");

        const result = await PerformanceTest.measure(
          "Complex 3-table JOIN",
          () => {
            fusion.exec(`
            SELECT u.name, p.title, COUNT(c.id) as comment_count
            FROM users u
            JOIN posts p ON u.id = p.user_id
            LEFT JOIN comments c ON p.id = c.post_id
            GROUP BY u.id, p.id
            LIMIT 20
          `);
          },
          5
        );

        console.log(PerformanceTest.formatResults(result));
        fusion.close();
      },
      { timeout: 15000 }
    );
  });

  // ==========================================
  // Update Performance Benchmarks
  // ==========================================

  runner.describe("Update Performance", () => {
    runner.test("benchmark: single row updates", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "Update single row",
        () => {
          const randomId = Math.floor(Math.random() * 1000);
          fusion.run("UPDATE test SET value = ? WHERE id = ?", [
            "updated",
            randomId,
          ]);
        },
        100
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });

    runner.test("benchmark: bulk update", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, value TEXT, category TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?, ?)", [
          i,
          `value${i}`,
          i % 2 === 0 ? "even" : "odd",
        ]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "Update 500 rows",
        () => {
          fusion.run("UPDATE test SET value = ? WHERE category = ?", [
            "updated",
            "even",
          ]);
        },
        10
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });
  });

  // ==========================================
  // Delete Performance Benchmarks
  // ==========================================

  runner.describe("Delete Performance", () => {
    runner.test("benchmark: single row deletes", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "Delete single row",
        () => {
          const randomId = Math.floor(Math.random() * 1000);
          fusion.run("DELETE FROM test WHERE id = ?", [randomId]);
        },
        100
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });

    runner.test("benchmark: bulk delete", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, category TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [
          i,
          i % 2 === 0 ? "even" : "odd",
        ]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "Delete 500 rows",
        () => {
          fusion.run("DELETE FROM test WHERE category = ?", ["even"]);
        },
        5
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });
  });

  // ==========================================
  // Export/Import Performance Benchmarks
  // ==========================================

  runner.describe("Export/Import Performance", () => {
    runner.test("benchmark: export small database", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, value TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 100; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "Export database (100 rows)",
        () => {
          fusion.exportDatabase();
        },
        10
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });

    runner.test(
      "benchmark: export medium database",
      async () => {
        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        fusion.run("CREATE TABLE test (id INTEGER, value TEXT)");

        fusion.run("BEGIN TRANSACTION");
        for (let i = 0; i < 5000; i++) {
          fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
        }
        fusion.run("COMMIT");

        const result = await PerformanceTest.measure(
          "Export database (5000 rows)",
          () => {
            fusion.exportDatabase();
          },
          5
        );

        console.log(PerformanceTest.formatResults(result));
        fusion.close();
      },
      { timeout: 10000 }
    );

    runner.test("benchmark: base64 encoding", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, value TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const exported = fusion.exportDatabase();

      const result = await PerformanceTest.measure(
        "Base64 encode",
        () => {
          fusion.uint8ArrayToBase64(exported);
        },
        10
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });

    runner.test("benchmark: base64 decoding", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, value TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const exported = fusion.exportDatabase();
      const base64 = fusion.uint8ArrayToBase64(exported);

      const result = await PerformanceTest.measure(
        "Base64 decode",
        () => {
          fusion.base64ToUint8Array(base64);
        },
        10
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });

    runner.test("benchmark: full save cycle", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();
      fusion.run("CREATE TABLE test (id INTEGER, value TEXT)");

      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 1000; i++) {
        fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "Full save cycle (export + encode + rebuild)",
        () => {
          const exported = fusion.exportDatabase();
          const base64 = fusion.uint8ArrayToBase64(exported);
          fusion.rebuildHTML(base64);
        },
        5
      );

      console.log(PerformanceTest.formatResults(result));
      fusion.close();
    });
  });

  // ==========================================
  // Memory Usage Tests
  // ==========================================

  runner.describe("Memory Performance", () => {
    runner.test(
      "benchmark: memory usage with large dataset",
      async () => {
        if (!performance.memory) {
          console.log("⚠️ Memory API not available in this browser");
          return;
        }

        const initialMemory = performance.memory.usedJSHeapSize;

        const fusion = new HTMLSQLiteFusion();
        await fusion.createDatabase();
        fusion.run("CREATE TABLE test (id INTEGER, data TEXT)");

        fusion.run("BEGIN TRANSACTION");
        for (let i = 0; i < 10000; i++) {
          fusion.run("INSERT INTO test VALUES (?, ?)", [
            i,
            TestDataGenerator.randomString(100),
          ]);
        }
        fusion.run("COMMIT");

        const afterInsertMemory = performance.memory.usedJSHeapSize;
        const memoryUsed = (afterInsertMemory - initialMemory) / 1024 / 1024;

        console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);
        console.log(
          `Database size: ${(fusion.getDatabaseSize() / 1024 / 1024).toFixed(
            2
          )} MB`
        );

        fusion.close();

        // Give GC a chance to run
        await new Promise((resolve) => setTimeout(resolve, 100));

        const afterCloseMemory = performance.memory.usedJSHeapSize;
        const memoryFreed =
          (afterInsertMemory - afterCloseMemory) / 1024 / 1024;

        console.log(`Memory freed after close: ${memoryFreed.toFixed(2)} MB`);
      },
      { timeout: 15000 }
    );
  });

  // ==========================================
  // Scalability Tests
  // ==========================================

  runner.describe("Scalability", () => {
    runner.test(
      "benchmark: performance with increasing data size",
      async () => {
        const sizes = [100, 500, 1000, 5000];
        const results = [];

        for (const size of sizes) {
          const fusion = new HTMLSQLiteFusion();
          await fusion.createDatabase();
          fusion.run("CREATE TABLE test (id INTEGER, value TEXT)");

          const result = await PerformanceTest.measure(
            `Insert ${size} rows`,
            () => {
              fusion.run("BEGIN TRANSACTION");
              for (let i = 0; i < size; i++) {
                fusion.run("INSERT INTO test VALUES (?, ?)", [i, `value${i}`]);
              }
              fusion.run("COMMIT");
            },
            1
          );

          results.push({ size, time: result.average });
          console.log(`${size} rows: ${result.average.toFixed(2)}ms`);

          fusion.close();
        }

        // Check that performance scales reasonably (not exponential)
        for (let i = 1; i < results.length; i++) {
          const ratio = results[i].time / results[i - 1].time;
          const sizeRatio = results[i].size / results[i - 1].size;

          console.log(
            `Size increased ${sizeRatio}x, time increased ${ratio.toFixed(2)}x`
          );

          // Time should not increase more than 10x when size increases
          Assert.assertLessThan(ratio, 10);
        }
      },
      { timeout: 20000 }
    );
  });

  // ==========================================
  // Real-World Performance Tests
  // ==========================================

  runner.describe("Real-World Performance", () => {
    runner.test("benchmark: todo app operations", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      fusion.run(`
        CREATE TABLE todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          completed INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await PerformanceTest.measure(
        "Todo app workflow (add 10, mark 5 complete, delete 2)",
        () => {
          fusion.run("BEGIN TRANSACTION");

          // Add 10 todos
          for (let i = 0; i < 10; i++) {
            fusion.run("INSERT INTO todos (title) VALUES (?)", [`Task ${i}`]);
          }

          // Mark 5 as complete
          for (let i = 1; i <= 5; i++) {
            fusion.run("UPDATE todos SET completed = 1 WHERE id = ?", [i]);
          }

          // Delete 2
          fusion.run("DELETE FROM todos WHERE id IN (1, 2)");

          fusion.run("COMMIT");

          // Query active todos
          fusion.exec("SELECT * FROM todos WHERE completed = 0");
        },
        10
      );

      console.log(PerformanceTest.formatResults(result));
      Assert.assertLessThan(result.average, 50);

      fusion.close();
    });

    runner.test("benchmark: note search performance", async () => {
      const fusion = new HTMLSQLiteFusion();
      await fusion.createDatabase();

      // FTS5 not available in standard SQLite WASM, use regular table with LIKE
      fusion.run("CREATE TABLE notes (title TEXT, content TEXT)");
      fusion.run("CREATE INDEX idx_notes_title ON notes(title)");

      // Insert 100 notes
      fusion.run("BEGIN TRANSACTION");
      for (let i = 0; i < 100; i++) {
        fusion.run("INSERT INTO notes VALUES (?, ?)", [
          `Note ${i}`,
          TestDataGenerator.randomString(200),
        ]);
      }
      fusion.run("COMMIT");

      const result = await PerformanceTest.measure(
        "LIKE search in 100 notes",
        () => {
          fusion.exec("SELECT * FROM notes WHERE title LIKE ?", ["Note%"]);
        },
        20
      );

      console.log(PerformanceTest.formatResults(result));
      Assert.assertLessThan(result.average, 50);

      fusion.close();
    });
  });
}

// Export for use in test runner
if (typeof module !== "undefined" && module.exports) {
  module.exports = { registerPerformanceTests };
}
