#!/bin/bash
# Verify Inline WASM Examples Work
# Tests that all inline examples can be opened directly without server

set -e

echo "🧪 Verifying Inline WASM Implementation"
echo "========================================"
echo ""

# Check inline JS exists
if [ ! -f "lib/sql-wasm-inline.js" ]; then
  echo "❌ lib/sql-wasm-inline.js not found!"
  echo "   Run: node build-inline-wasm.js"
  exit 1
fi
echo "✅ lib/sql-wasm-inline.js exists"

# Check inline examples exist
INLINE_EXAMPLES=(
  "examples/01-basic-demo-inline.html"
  "examples/04-trust-demo-inline.html"
  "examples/05-encryption-demo-inline.html"
)

echo ""
echo "📋 Checking inline examples..."
for example in "${INLINE_EXAMPLES[@]}"; do
  if [ ! -f "$example" ]; then
    echo "❌ $example not found"
    exit 1
  fi
  
  # Verify it uses inline WASM
  if ! grep -q "sql-wasm-inline.js" "$example"; then
    echo "❌ $example doesn't use sql-wasm-inline.js"
    exit 1
  fi
  
  echo "✅ $example"
done

echo ""
echo "📊 File sizes:"
echo "  sql-wasm.wasm:        $(du -h lib/sql-wasm.wasm | cut -f1)"
echo "  sql-wasm.js:          $(du -h lib/sql-wasm.js | cut -f1)"
echo "  sql-wasm-inline.js:   $(du -h lib/sql-wasm-inline.js | cut -f1)"
echo "  Overhead per file:    ~800KB"

echo ""
echo "🎯 Opening inline examples for manual verification..."
echo "   (These should open directly without requiring a server)"
echo ""

for example in "${INLINE_EXAMPLES[@]}"; do
  echo "Opening: $example"
  open "$example"
  sleep 1
done

echo ""
echo "✅ Verification complete!"
echo ""
echo "Expected behavior:"
echo "  - Files open directly (file:// protocol)"
echo "  - SQLite WASM loads without CORS errors"
echo "  - All database operations work"
echo "  - No HTTP server needed"
echo ""
echo "If you see errors in browser console, the inline approach failed."
echo "Otherwise, the implementation is working correctly!"
