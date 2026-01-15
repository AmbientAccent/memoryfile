# Inline WASM Implementation

## Problem

Browser CORS policy blocks loading `.wasm` files via `file://` protocol. The standard implementation requires running a local HTTP server, contradicting the "no server needed" claim. Self-contained files cannot have external dependencies.

## Solution

Embed WASM as base64 data URI directly in the JavaScript file. The sql-wasm.js library already supports this:

```javascript
function Za(){return M.startsWith("data:application/octet-stream;base64,")}
```

When WASM is provided as a data URI, the library loads it inline instead of fetching from a separate file.

## Implementation

### Build Script

```bash
node tools/build-inline-wasm.js
```

This creates `lib/sql-wasm-inline.js` with embedded WASM.

### Usage

Standard version (requires server):
```html
<script src="lib/sql-wasm.js"></script>
```

Embedded version (works with file://):
```html
<script src="lib/sql-wasm-inline.js"></script>
```

Everything else stays the same.

## Trade-offs

| Approach | File Size | Protocol Support | Use Case |
|----------|-----------|------------------|----------|
| Standard | Base + 50KB | http:// only | Development, web hosting |
| Inline | Base + 850KB | file:// + http:// | Portability, offline docs |

Standard (sql-wasm.js):
- Smaller files (50KB overhead)
- WASM cached across files
- Requires HTTP server
- Cannot use file:// protocol

Inline (sql-wasm-inline.js):
- Works with file:// protocol
- No server needed
- Self-contained portability
- Larger files (800KB overhead per file)
- WASM embedded in every file

## When to Use Each

Use standard version for:
- Local development with HTTP server
- Web hosting deployments
- Multiple files sharing WASM cache
- Size-constrained environments

Use inline version for:
- Email attachments (contracts, invoices)
- Offline distribution (medical records, legal docs)
- USB drive deployment
- Environments without server access
- Trust and verification workflows

## Verification

Run the verification script:

```bash
./tools/verify-inline.sh
```

This tests:
- Protocol support (file://)
- All CRUD operations
- Export and import functions
- Server-free operation

## Building

Rebuild inline version after updating sql-wasm.wasm:

```bash
node tools/build-inline-wasm.js
```

Output: `lib/sql-wasm-inline.js` (850KB)

## True Single-File Distribution

The inline version still requires keeping the `lib/` folder alongside your HTML files. For TRUE single-file distribution where you share just ONE .html file:

```bash
node tools/bundle-inline.js examples/01-basic-demo.html
```

This creates a `-bundled.html` file with ALL JavaScript embedded directly in the HTML. The bundled file:
- Works without any folder structure
- Can be shared as a single file (email, USB, etc.)
- Opens directly from any location with file:// protocol
- Is approximately 860KB larger than the original

## Technical Note

The inline approach resolves the file:// protocol limitation by embedding WASM directly as base64. This increases file size by 800KB but enables true portability without HTTP server dependencies.

For development with the folder structure maintained, use the examples that load `sql-wasm-inline.js`.
For single-file distribution, use the `-bundled.html` versions created by `bundle-inline.js`.
