#!/bin/bash
# Verify embedded WASM examples work
# Tests that all examples can be opened directly without server

set -e

echo "Verifying inline WASM implementation"
echo "===================================="
echo ""

# Check inline JS exists
if [ ! -f "lib/sql-wasm-inline.js" ]; then
  echo "Error: lib/sql-wasm-inline.js not found"
  echo "Run: node tools/build-inline-wasm.js"
  exit 1
fi
echo "lib/sql-wasm-inline.js exists"

# Check examples exist
INLINE_EXAMPLES=(
  "examples/01-basic-demo.html"
  "examples/04-trust-demo.html"
  "examples/05-encryption-demo.html"
)

echo ""
echo "Checking examples..."
for example in "${INLINE_EXAMPLES[@]}"; do
  if [ ! -f "$example" ]; then
    echo "Error: $example not found"
    exit 1
  fi
  
  # Verify it uses inline WASM
  if ! grep -q "sql-wasm-inline.js" "$example"; then
    echo "Error: $example doesn't use sql-wasm-inline.js"
    exit 1
  fi
  
  echo "OK: $example"
done

echo ""
echo "File sizes:"
echo "  sql-wasm.wasm:        $(du -h lib/sql-wasm.wasm | cut -f1)"
echo "  sql-wasm.js:          $(du -h lib/sql-wasm.js | cut -f1)"
echo "  sql-wasm-inline.js:   $(du -h lib/sql-wasm-inline.js | cut -f1)"
echo "  Overhead per file:    ~800KB"

echo ""
echo "Opening examples for manual verification..."
echo "These should open directly without requiring a server"
echo ""

for example in "${INLINE_EXAMPLES[@]}"; do
  echo "Opening: $example"
  open "$example"
  sleep 1
done

echo ""
echo "Verification complete"
echo ""
echo "Expected behavior:"
echo "  - Files open directly (file:// protocol)"
echo "  - SQLite WASM loads without CORS errors"
echo "  - All database operations work"
echo "  - No HTTP server needed"
echo ""
echo "If you see errors in browser console, the inline approach failed."
echo "Otherwise, the implementation is working correctly!"
