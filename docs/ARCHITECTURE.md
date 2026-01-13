# Architecture Deep Dive

## Overview

This document provides a detailed technical explanation of how MemoryFile works.

**MemoryFile** creates HTML files that embed SQLite databases and can save themselves back to disk.

## Core Mechanism

### 1. Embedding SQLite Database in HTML

The SQLite database file is embedded as base64-encoded text within a `<script>` tag:

```html
<script id="embedded-db" type="application/x-sqlite3">
  U1FMaXRlIGZvcm1hdCAzABAAAQEAQCAgAAAABAAAAA... (base64 encoded binary)
</script>
```

**Why base64?**
- HTML is text-based, SQLite databases are binary
- Base64 is the standard way to embed binary data in text
- Trade-off: 33% size increase, but maintains single-file integrity

### 2. Loading the Database

On page load, the following sequence occurs:

```javascript
// 1. Extract base64 data from script tag
const dbScript = document.getElementById('embedded-db');
const base64Data = dbScript.textContent.trim();

// 2. Decode base64 to Uint8Array
const binaryData = base64ToUint8Array(base64Data);

// 3. Initialize SQLite WASM with the binary data
const SQL = await initSqlJs({
  locateFile: file => `./lib/${file}`
});
const db = new SQL.Database(binaryData);

// 4. Database is now ready for queries
const result = db.exec("SELECT * FROM users");
```

### 3. Working with the Database

Normal SQLite operations work as expected:

```javascript
// INSERT
db.run("INSERT INTO users (name, email) VALUES (?, ?)", 
       ['John Doe', 'john@example.com']);

// SELECT
const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
stmt.bind([userId]);
while (stmt.step()) {
  const row = stmt.getAsObject();
  console.log(row);
}
stmt.free();

// UPDATE
db.run("UPDATE users SET email = ? WHERE id = ?", 
       ['newemail@example.com', userId]);

// DELETE
db.run("DELETE FROM users WHERE id = ?", [userId]);
```

### 4. Saving Changes Back to File

This is the most complex part - the file must reconstruct itself:

```javascript
async function saveToFile() {
  // 1. Export the current database to binary
  const exportedDb = db.export(); // Uint8Array
  
  // 2. Encode to base64
  const base64Db = uint8ArrayToBase64(exportedDb);
  
  // 3. Get the entire current HTML
  let htmlContent = '<!DOCTYPE html>\n' + 
                    document.documentElement.outerHTML;
  
  // 4. Replace the old database with the new one
  htmlContent = htmlContent.replace(
    /(<script id="embedded-db"[^>]*>)([\s\S]*?)(<\/script>)/,
    `$1\n${base64Db}\n$3`
  );
  
  // 5. Write to file using File System Access API
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'myapp.html',
      types: [{
        description: 'HTML Files',
        accept: {'text/html': ['.html']}
      }]
    });
    
    const writable = await handle.createWritable();
    await writable.write(htmlContent);
    await writable.close();
    
    console.log('File saved successfully!');
  } catch (err) {
    // User cancelled or error occurred
    if (err.name !== 'AbortError') {
      console.error('Save failed:', err);
      fallbackDownload(htmlContent, 'myapp.html');
    }
  }
}
```

### 5. Fallback for Unsupported Browsers

For browsers without File System Access API (Firefox, Safari):

```javascript
function fallbackDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

## Performance Optimization

### 1. Lazy Loading

Don't load the entire database on page load if not needed:

```javascript
let db = null;

async function getDatabase() {
  if (!db) {
    const base64Data = document.getElementById('embedded-db')
                              .textContent.trim();
    const binaryData = base64ToUint8Array(base64Data);
    db = new SQL.Database(binaryData);
  }
  return db;
}
```

### 2. Compression

Compress the database before encoding:

```javascript
// Using pako (zlib) library
const compressed = pako.gzip(exportedDb);
const base64Db = uint8ArrayToBase64(compressed);

// On load:
const compressed = base64ToUint8Array(base64Data);
const decompressed = pako.ungzip(compressed);
db = new SQL.Database(decompressed);
```

This can reduce file size by 50-70%!

### 3. Incremental Updates

For advanced use, track which parts of the database changed:

```javascript
// Store original database hash
const originalHash = await hashDatabase(db);

// On save, compare
const currentHash = await hashDatabase(db);
if (originalHash === currentHash) {
  console.log('No changes, skip save');
  return;
}
```

### 4. OPFS for Working Storage

Use Origin Private File System for much better performance:

```javascript
const SQL = await initSqlJs({
  locateFile: file => `./lib/${file}`
});

// Create database in OPFS
const db = new SQL.Database('myapp.db', {
  filename: true, // Enable file-backed mode
  flags: 'c'      // Create if doesn't exist
});

// Export to self-contained HTML only when needed
async function exportToHTML() {
  const exportedDb = db.export();
  // ... rest of save logic
}
```

## Security Considerations

### 1. Content Security Policy

Self-modifying code can trigger CSP violations:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval';">
```

**Note:** `unsafe-eval` is required for some SQLite WASM implementations.

### 2. Data Validation

Always validate data before inserting:

```javascript
function sanitizeInput(input) {
  // Remove potentially dangerous characters
  return input.replace(/[<>'"]/g, '');
}

// Use parameterized queries (SQLite handles escaping)
db.run("INSERT INTO users (name) VALUES (?)", 
       [sanitizeInput(userName)]);
```

### 3. Encryption

For sensitive data, encrypt the database:

```javascript
// Using Web Crypto API
async function encryptDatabase(data, password) {
  const key = await deriveKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return { encrypted, iv };
}
```

## Memory Management

### 1. Close Databases When Done

```javascript
window.addEventListener('beforeunload', () => {
  if (db) {
    db.close();
  }
});
```

### 2. Free Prepared Statements

```javascript
const stmt = db.prepare("SELECT * FROM users");
// ... use statement
stmt.free(); // Important!
```

### 3. Monitor Memory Usage

```javascript
if (performance.memory) {
  console.log('Used:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
  console.log('Total:', performance.memory.totalJSHeapSize / 1024 / 1024, 'MB');
}
```

## Data Migration

### Versioning Your Schema

```javascript
const CURRENT_VERSION = 2;

function migrateDatabase(db) {
  const versionResult = db.exec("PRAGMA user_version");
  const currentVersion = versionResult[0]?.values[0][0] || 0;
  
  if (currentVersion < 1) {
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
    db.run("PRAGMA user_version = 1");
  }
  
  if (currentVersion < 2) {
    db.run("ALTER TABLE users ADD COLUMN email TEXT");
    db.run("PRAGMA user_version = 2");
  }
  
  // Add more migrations as needed
}
```

## Error Handling

```javascript
async function safeDbOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    console.error('Database error:', error);
    
    // Try to recover
    if (error.message.includes('corrupt')) {
      if (confirm('Database appears corrupt. Reset to empty?')) {
        await initializeNewDatabase();
      }
    }
    
    throw error;
  }
}
```

## Testing

### Unit Tests

```javascript
// Test database operations
function testBasicOperations() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  db.run("CREATE TABLE test (id INTEGER, value TEXT)");
  db.run("INSERT INTO test VALUES (1, 'hello')");
  
  const result = db.exec("SELECT * FROM test");
  console.assert(result[0].values[0][0] === 1);
  console.assert(result[0].values[0][1] === 'hello');
  
  db.close();
}
```

### Integration Tests

```javascript
// Test save/load cycle
async function testSaveLoad() {
  // Create database with data
  const db = createTestDatabase();
  
  // Save to HTML
  const htmlContent = await generateHTML(db);
  
  // Parse HTML and extract database
  const extractedDb = extractDatabaseFromHTML(htmlContent);
  
  // Verify data integrity
  const result = extractedDb.exec("SELECT * FROM test");
  console.assert(result.length > 0, 'Data should persist');
}
```

## Advanced Patterns

### 1. Transactions

```javascript
function performBulkInsert(records) {
  db.run("BEGIN TRANSACTION");
  try {
    for (const record of records) {
      db.run("INSERT INTO users (name, email) VALUES (?, ?)",
             [record.name, record.email]);
    }
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}
```

### 2. Virtual Tables

```javascript
// Full-text search
db.run(`
  CREATE VIRTUAL TABLE notes_fts 
  USING fts5(title, content)
`);

db.run("INSERT INTO notes_fts VALUES (?, ?)", [title, content]);

// Search
const results = db.exec(
  "SELECT * FROM notes_fts WHERE notes_fts MATCH ?",
  ['search term']
);
```

### 3. Custom Functions

```javascript
// Add custom JavaScript function to SQLite
db.create_function("REVERSE", (str) => {
  return str.split('').reverse().join('');
});

// Use in queries
const result = db.exec("SELECT REVERSE(name) FROM users");
```

## Debugging

### Enable Verbose Logging

```javascript
const SQL = await initSqlJs({
  debug: true // Log all SQL statements
});
```

### Inspect Database Structure

```javascript
function inspectDatabase(db) {
  const tables = db.exec(`
    SELECT name FROM sqlite_master 
    WHERE type='table'
  `);
  
  for (const table of tables[0].values) {
    const tableName = table[0];
    console.log(`Table: ${tableName}`);
    
    const schema = db.exec(`PRAGMA table_info(${tableName})`);
    console.log('Columns:', schema);
  }
}
```

---

This architecture enables truly portable, self-contained web applications with the full power of SQLite.
