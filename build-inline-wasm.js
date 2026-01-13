#!/usr/bin/env node
/**
 * Build Script: Create inline WASM version
 * 
 * Converts sql-wasm.wasm to base64 and embeds it directly in sql-wasm.js
 * This allows files to work with file:// protocol (no HTTP server needed)
 * 
 * Trade-off: +800KB per file, but achieves true "no server needed" portability
 */

const fs = require('fs');
const path = require('path');

const WASM_FILE = path.join(__dirname, 'lib', 'sql-wasm.wasm');
const JS_FILE = path.join(__dirname, 'lib', 'sql-wasm.js');
const OUTPUT_FILE = path.join(__dirname, 'lib', 'sql-wasm-inline.js');

console.log('🔨 Building inline WASM version...\n');

// Read WASM file
console.log(`📖 Reading WASM file: ${WASM_FILE}`);
const wasmBuffer = fs.readFileSync(WASM_FILE);
const wasmSize = wasmBuffer.length;
console.log(`   Size: ${(wasmSize / 1024).toFixed(2)} KB`);

// Convert to base64
console.log('\n🔄 Converting to base64...');
const wasmBase64 = wasmBuffer.toString('base64');
const base64Size = wasmBase64.length;
console.log(`   Base64 size: ${(base64Size / 1024).toFixed(2)} KB`);
console.log(`   Overhead: ${((base64Size / wasmSize - 1) * 100).toFixed(1)}%`);

// Read JS file
console.log(`\n📖 Reading JS file: ${JS_FILE}`);
const jsContent = fs.readFileSync(JS_FILE, 'utf8');

// Create data URI
const dataURI = `data:application/octet-stream;base64,${wasmBase64}`;

// Replace the WASM filename with data URI
// The pattern we're looking for: M="sql-wasm.wasm"
console.log('\n🔧 Patching JS file...');
const patchedJS = jsContent.replace(
  /M="sql-wasm\.wasm"/g,
  `M="${dataURI}"`
);

if (patchedJS === jsContent) {
  console.error('❌ ERROR: Could not find pattern to replace');
  console.error('   Looking for: M="sql-wasm.wasm"');
  process.exit(1);
}

// Write output file
console.log(`\n💾 Writing output: ${OUTPUT_FILE}`);
fs.writeFileSync(OUTPUT_FILE, patchedJS, 'utf8');

const outputSize = patchedJS.length;
console.log(`   Output size: ${(outputSize / 1024).toFixed(2)} KB`);

// Summary
console.log('\n✅ Build complete!\n');
console.log('Summary:');
console.log(`  Original WASM: ${(wasmSize / 1024).toFixed(2)} KB`);
console.log(`  Inline JS:     ${(outputSize / 1024).toFixed(2)} KB`);
console.log(`  Overhead:      +${((outputSize - jsContent.length) / 1024).toFixed(2)} KB per file`);
console.log('\nUsage:');
console.log('  Replace: <script src="lib/sql-wasm.js"></script>');
console.log('  With:    <script src="lib/sql-wasm-inline.js"></script>');
console.log('\nBenefit: Works with file:// protocol (no HTTP server needed!)');
