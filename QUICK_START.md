# MemoryFile Quick Start

Get started with MemoryFile in 30 seconds.

## What is MemoryFile?

HTML files that remember everything. Create single-file applications with embedded SQLite databases that save themselves. No server needed.

Key features:
- Self-contained HTML files with embedded databases
- Full SQLite support via WebAssembly
- Save changes back to the file
- Trust and integrity verification
- No backend or server required

## Getting Started

Two ways to run MemoryFile depending on which files you're using:

**Inline files** (suffix `-inline.html`): Just double-click or use `open` command. No server needed.

**Standard files** (test-runner.html, most examples): Need HTTP server due to WASM loading restrictions.

### Step 1: Validate Installation

Test runners and most examples require a local server:

```bash
# Start server (needed for WASM loading)
python3 -m http.server 3000

# In another terminal or browser
open http://localhost:3000/test-runner.html
```

Click "Run All Tests" and watch 120+ tests pass.

Why the server? The `sql-wasm.js` library fetches `sql-wasm.wasm` separately, which browsers block via `file://` protocol. Inline versions embed WASM as base64 to avoid this limitation.

### Step 2: Try an Example

**Option A: No server needed (inline version)**

```bash
open examples/01-basic-demo-inline.html
```

**Option B: With server (standard version, smaller file)**

```bash
# Server should already be running from Step 1
open http://localhost:3000/examples/01-basic-demo.html
```

Try:
- Adding data
- Running queries
- Saving the file
- Opening the saved file to see data persisted

Both versions work identically. Inline versions are 800KB larger but work with `file://` protocol.

### Step 3: Explore Trust Features

See integrity verification in action:

```bash
open examples/04-trust-demo.html
```

Notice the green "VERIFIED" badge showing the file is authentic.

## Next Steps

### Learn More

- **Architecture:** Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details
- **Testing:** See [docs/TESTING.md](docs/TESTING.md) for comprehensive test documentation
- **Trust System:** Check [docs/TRUST_ARCHITECTURE.md](docs/TRUST_ARCHITECTURE.md) for integrity verification
- **Limits:** Explore [docs/LIMITS.md](docs/LIMITS.md) for system boundaries

### Build Your Own App

Create a new HTML file and include the core library:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
  <script src="lib/html-sqlite-core.js"></script>
</head>
<body>
  <script>
    const mf = new MemoryFile();
    // Your app code here
  </script>
</body>
</html>
```

See [README.md](README.md) for complete API reference.

### Explore Examples

- `examples/01-basic-demo.html` - Simple notes app
- `examples/02-commit-demo.html` - Git-like version control
- `examples/03-notes-as-commits.html` - Notes with commits
- `examples/04-trust-demo.html` - Trust verification
- `examples/limits-demo.html` - System limits testing

### Run Tests

- `test-runner.html` - Core functionality tests (120+ tests)
- `trust-test-runner.html` - Trust system tests
- `limits-runner.html` - System limits discovery

## Troubleshooting

### Examples Don't Load?
- Make sure you're using a modern browser (Chrome or Edge recommended)
- Check browser console for errors
- Try double-clicking the file or using `open filename.html`

### Tests Fail?
- Use Chrome or Edge for best compatibility
- Check browser console for errors
- Some tests may be slower on first run while WASM initializes

### Save Doesn't Work?
- Chrome/Edge: Grant file system permissions when prompted
- Firefox/Safari: Uses download instead (this is normal)
- Check browser console for errors

### File Won't Open?
- Make sure file has `.html` extension
- Try right-click > Open With > Chrome/Edge
- On Windows: Set default program for `.html` files to your browser

## Need Help?

- **Documentation:** Check [docs/](docs/) directory
- **Examples:** See [examples/](examples/) directory
- **Contributing:** Read [CONTRIBUTING.md](CONTRIBUTING.md)
- **Issues:** Open an issue on GitHub

## What's Next?

1. You've validated the installation
2. You've seen examples working
3. You've explored trust features
4. **Now:** Build your own app!

Start building: Create a new HTML file and include `lib/html-sqlite-core.js`
