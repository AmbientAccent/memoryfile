#!/usr/bin/env node
/**
 * Bundle Inline HTML Generator
 * 
 * Creates truly self-contained HTML files that work without any external dependencies.
 * Everything (SQL.js with embedded WASM) is bundled into a single HTML file.
 * 
 * Usage: node tools/bundle-inline.js examples/01-basic-demo-inline.html
 * Output: examples/01-basic-demo-bundled.html
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node tools/bundle-inline.js <input.html>');
  console.log('');
  console.log('Creates a truly self-contained HTML file with all JS embedded.');
  console.log('The output file can be shared as a single file and opened directly.');
  process.exit(1);
}

const inputFile = args[0];
const inputDir = path.dirname(inputFile);
const inputBasename = path.basename(inputFile, '.html');
const outputFile = path.join(inputDir, inputBasename.replace('-inline', '') + '-bundled.html');

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

// Read the inline WASM JS
const sqlWasmInlinePath = path.join(__dirname, '../lib/sql-wasm-inline.js');
if (!fs.existsSync(sqlWasmInlinePath)) {
  console.error('Error: lib/sql-wasm-inline.js not found. Run: node tools/build-inline-wasm.js');
  process.exit(1);
}

const sqlWasmInlineJs = fs.readFileSync(sqlWasmInlinePath, 'utf8');

// Read the HTML file
let html = fs.readFileSync(inputFile, 'utf8');

// Replace external script reference with inline script
// Pattern: <script src="../lib/sql-wasm-inline.js"></script>
const scriptPattern = /<script\s+src=["'][^"']*sql-wasm-inline\.js["'][^>]*><\/script>/gi;

if (!scriptPattern.test(html)) {
  console.error('Error: Input file does not reference sql-wasm-inline.js');
  process.exit(1);
}

// Reset regex lastIndex
scriptPattern.lastIndex = 0;

html = html.replace(scriptPattern, `<script>
// === SQL.js with embedded WASM (bundled for true portability) ===
${sqlWasmInlineJs}
</script>`);

// Also fix any locateFile references that point to ../lib/
// When bundled, we don't need locateFile at all
// The inline WASM is embedded, so locateFile is unnecessary
// Match the specific pattern used in our demos
html = html.replace(
  /initSqlJs\s*\(\s*\{\s*locateFile:\s*file\s*=>\s*`[^`]*`\s*\}\s*\)/g,
  'initSqlJs()'
);

// Write output
fs.writeFileSync(outputFile, html, 'utf8');

const inputSize = fs.statSync(inputFile).size;
const outputSize = fs.statSync(outputFile).size;

console.log(`Bundled: ${inputFile}`);
console.log(`Output:  ${outputFile}`);
console.log(`Size:    ${(outputSize / 1024).toFixed(1)}KB (was ${(inputSize / 1024).toFixed(1)}KB)`);
console.log('');
console.log('The bundled file is truly self-contained and can be:');
console.log('  - Shared as a single file (email, USB, etc.)');
console.log('  - Opened directly with file:// protocol');
console.log('  - Used without any folder structure');
