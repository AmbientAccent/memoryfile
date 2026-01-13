# MemoryFile Quick Start

Get started in 30 seconds.

## Try It Now

Double-click any inline example - they work immediately, no setup required:

```bash
open examples/01-basic-demo-inline.html
open examples/04-trust-demo-inline.html
open examples/05-encryption-demo-inline.html
```

Try adding data, saving (Ctrl+S), and reopening the file. Your data persists.

## What Just Happened?

The HTML file contains everything: UI, JavaScript, SQLite WASM library, and your database. When you save, JavaScript rebuilds the entire file with your updated data.

No server. No backend. No cloud. Just a file.

## Explore More Examples

- `01-basic-demo-inline.html` - Simple notes app
- `02-commit-demo.html` - Git-like version control  
- `03-notes-as-commits.html` - Notes with history
- `04-trust-demo-inline.html` - Integrity verification (notice the VERIFIED badge)
- `05-encryption-demo-inline.html` - Password-protected data

## Build Your Own

```html
<!DOCTYPE html>
<html>
<head>
  <script src="lib/sql-wasm-inline.js"></script>
  <script src="lib/html-sqlite-core.js"></script>
</head>
<body>
  <script>
    const mf = new MemoryFile({ encrypted: true });
    await mf.createDatabase('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)');
    mf.run('INSERT INTO notes (text) VALUES (?)', ['Hello world']);
    await mf.saveToFile('my-app.html', 'password');
  </script>
</body>
</html>
```

## Learn More

- [Architecture](ARCHITECTURE.md) - Technical details
- [Trust System](TRUST_ARCHITECTURE.md) - Integrity verification
- [Limits](LIMITS.md) - System boundaries

## For Contributors

If you're modifying the library itself, you'll need to run the test suite. See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup.
