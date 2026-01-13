# Trust System

Verifiable integrity for HTML-SQLite files using content-addressed filenames and visual trust badges.

## Quick Start

### 1. Include the Trust Manager

```html
<head>
  <link rel="stylesheet" href="lib/trust-badge.css">
  <script src="lib/trust-manager.js"></script>
</head>
```

### 2. Initialize on Page Load

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const trust = new TrustManager();
  // Badge appears automatically
});
```

### 3. Generate Content-Addressed Filenames

```javascript
async function saveWithVerification() {
  const htmlContent = buildYourHTML();
  const trust = new TrustManager();
  const filename = await trust.generateCommitFilename('myapp', htmlContent);
  // Result: "myapp.a1b2c3d4.html"
  downloadFile(htmlContent, filename);
}
```

## How It Works

### Content-Addressed Filenames

The filename contains a SHA-256 hash of the file's content:

```
contract.a1b2c3d4.html
         ^^^^^^^^
         Hash of file content
```

When the file opens, it recalculates the hash and compares it to the filename. If they match, the file is verified. If not, it's been tampered with.

### Hash Generation

```javascript
async function generateContentHash(htmlContent) {
  const normalized = normalizeHTML(htmlContent);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 8);
}
```

### Verification

```javascript
async function verifyFileIntegrity() {
  const filename = getFilename();
  const expectedHash = extractHashFromFilename(filename);
  
  if (!expectedHash) {
    return { status: 'UNVERIFIED', reason: 'No hash in filename' };
  }
  
  const htmlContent = document.documentElement.outerHTML;
  const actualHash = await generateContentHash(htmlContent);
  
  if (actualHash === expectedHash) {
    return { status: 'VERIFIED', hash: actualHash };
  } else {
    return { status: 'TAMPERED', expected: expectedHash, actual: actualHash };
  }
}
```

## Trust Badge

### Badge States

| State | Color | Icon | Meaning |
|-------|-------|------|---------|
| VERIFIED | Green | checkmark | Content hash matches filename |
| SIGNED | Blue | shield | Cryptographically signed + verified |
| TIMESTAMPED | Purple | clock | Blockchain timestamp verified |
| UNVERIFIED | Yellow | warning | Cannot verify (wrong filename, no hash) |
| TAMPERED | Red | X | Content doesn't match expected hash |

### Badge Structure

```html
<div id="trust-badge" class="trust-badge trust-verified" data-position="top-right">
  <div class="trust-badge-header">
    <span class="trust-icon">✓</span>
    <span class="trust-status">VERIFIED</span>
    <button class="trust-expand" aria-label="Expand details">ⓘ</button>
  </div>
  <div class="trust-details" hidden>
    <div class="trust-detail-item">
      <strong>Status:</strong> File integrity confirmed
    </div>
    <div class="trust-detail-item">
      <strong>SHA-256:</strong>
      <code class="trust-hash">a1b2c3d4</code>
    </div>
    <button class="trust-learn-more">Learn about file verification</button>
  </div>
</div>
```

## API Reference

### TrustManager Constructor

```javascript
const trust = new TrustManager(config);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoVerify` | boolean | `true` | Automatically verify on page load |
| `showBadge` | boolean | `true` | Show trust badge |
| `badgePosition` | string | `'top-right'` | Position: `'top-right'`, `'top-left'`, `'bottom-right'`, `'bottom-left'` |
| `educationMode` | boolean | `true` | Show "Learn more" button |
| `hashLength` | number | `8` | Characters from hash in filename |
| `excludeSelectors` | array | `['#trust-badge']` | Elements to exclude from hash |
| `onVerificationComplete` | function | `null` | Callback when verification completes |

### Methods

#### verify()

Manually trigger verification.

```javascript
const result = await trust.verify();
// result.status: 'VERIFIED', 'UNVERIFIED', or 'TAMPERED'
```

#### generateCommitFilename(basename, htmlContent)

Generate content-addressed filename.

```javascript
const filename = await trust.generateCommitFilename('contract', htmlContent);
// Returns: "contract.a1b2c3d4.html"
```

#### generateContentHash(htmlContent)

Get SHA-256 hash of content.

```javascript
const hash = await trust.generateContentHash(htmlContent);
// Returns full SHA-256 hash
```

#### exportVerificationProof()

Export verification details for records.

```javascript
const proof = trust.exportVerificationProof();
```

## Integration Patterns

### Notes App

```javascript
const trust = new TrustManager();

async function saveNotes() {
  const htmlContent = buildHTML();
  const filename = await trust.generateCommitFilename('notes', htmlContent);
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### High-Security App (Contracts)

```javascript
const trust = new TrustManager({
  educationMode: true,
  onVerificationComplete: (result) => {
    if (result.status === 'TAMPERED') {
      document.body.innerHTML = `
        <div style="text-align: center; padding: 50px;">
          <h1>Security Warning</h1>
          <p>This file has been modified and cannot be trusted.</p>
        </div>
      `;
    }
  }
});
```

### Version Control Pattern

```javascript
async function commitChanges(message) {
  const metadata = {
    message,
    timestamp: new Date().toISOString(),
    parentHash: getCurrentHash()
  };
  
  const htmlContent = buildHTMLWithMetadata(metadata);
  const filename = await trust.generateCommitFilename('app', htmlContent);
  const hash = trust.extractHashFromFilename(filename);
  
  db.run(
    'INSERT INTO commits (hash, parent, message, timestamp) VALUES (?, ?, ?, ?)',
    [hash, metadata.parentHash, message, metadata.timestamp]
  );
  
  await saveFile(htmlContent, filename);
}
```

## Best Practices

### Always Use Content-Addressed Filenames

```javascript
// Good
const filename = await trust.generateCommitFilename('contract', html);

// Bad
const filename = 'contract.html';
```

### Exclude Dynamic Elements

```javascript
const trust = new TrustManager({
  excludeSelectors: [
    '#trust-badge',
    '.last-viewed-timestamp',
    '.session-counter'
  ]
});
```

### Handle Verification Results

```javascript
const trust = new TrustManager({
  onVerificationComplete: (result) => {
    switch (result.status) {
      case 'VERIFIED':
        console.log('File verified');
        break;
      case 'UNVERIFIED':
        console.warn('Cannot verify - no hash in filename');
        break;
      case 'TAMPERED':
        alert('WARNING: This file has been tampered with!');
        break;
    }
  }
});
```

### Add Filename Meta Tag

```html
<head>
  <meta name="filename" content="contract.a1b2c3d4.html">
</head>
```

## Testing Your Integration

### Test 1: Valid File

1. Save a file with content-addressed filename
2. Open it
3. Should show VERIFIED badge

### Test 2: Tampered File

1. Save a file with content-addressed filename
2. Edit content in text editor
3. Open it
4. Should show TAMPERED badge

### Test 3: No Hash in Filename

1. Save a file without hash in filename
2. Open it
3. Should show UNVERIFIED badge

## Troubleshooting

### Badge Not Showing

1. Is `trust-badge.css` loaded?
2. Is `TrustManager` initialized?
3. Check browser console for errors

### Hash Mismatch on Valid File

Dynamic content being hashed. Exclude it:

```javascript
const trust = new TrustManager({
  excludeSelectors: ['#trust-badge', '.dynamic-timestamp']
});
```

### Filename Not Detected

Add meta tag:

```html
<meta name="filename" content="yourfile.a1b2c3d4.html">
```

## Advanced Features

### Multi-Level Verification

For maximum trust, combine methods:

```javascript
// Level 1: Content-addressed filename (always)
const filename = await trust.generateCommitFilename('doc', html);

// Level 2: Digital signature (optional)
const signature = await signWithPrivateKey(html, privateKey);

// Level 3: Blockchain timestamp (optional)
const blockchainProof = await submitToOpenTimestamps(hash);
```

### Custom Badge Styling

```css
.trust-badge.trust-verified {
  background: linear-gradient(135deg, #your-brand 0%, #darker 100%);
}
```

### Programmatic Badge Control

```javascript
const trust = new TrustManager({ showBadge: false });

if (userWantsVerification) {
  trust.renderBadge();
}
```

## Command Line Verification

```bash
# Generate hash
sha256sum myfile.a1b2c3d4.html

# First 8 characters should match filename

# Batch verification
for file in *.html; do
  hash=$(echo "$file" | sed -n 's/.*\.\([a-f0-9]\{8\}\)\.html$/\1/p')
  if [ -z "$hash" ]; then
    echo "? $file - No hash"
    continue
  fi
  actual=$(sha256sum "$file" | cut -c1-8)
  if [ "$hash" = "$actual" ]; then
    echo "V $file"
  else
    echo "X $file - TAMPERED"
  fi
done
```

## Security Model

### What This Detects

- Content changes (any modification breaks the hash)
- Accidental corruption
- Malicious edits

### What This Doesn't Prevent

- Attackers modifying both content and filename
- Users ignoring warnings

### Strengthening Options

- Digital signatures prove creator identity
- Blockchain timestamps provide immutable proof
- Multiple copies enable cross-verification

## Migration

### Adding Trust to Existing App

1. Include trust manager and CSS
2. Initialize in your existing init code
3. Update save function to use content-addressed filenames

```javascript
// Before
saveFile(html, 'myapp.html');

// After
const filename = await trust.generateCommitFilename('myapp', html);
saveFile(html, filename);
```

## FAQ

**Does this prevent tampering?**
No, it detects tampering. Anyone can modify the file, but the badge will show it.

**Can an attacker modify content and filename?**
Yes. Mitigations: digital signatures, blockchain timestamps, or comparing multiple copies.

**Do I need a backend?**
No. Everything works client-side.

**Browser requirements?**
Modern browsers with `crypto.subtle` API (Chrome 60+, Firefox 57+, Safari 11+).
