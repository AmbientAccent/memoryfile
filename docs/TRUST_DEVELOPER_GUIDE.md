# Trust System - Developer Guide

## Quick Start (5 Minutes)

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
  // That's it! Badge appears automatically if verification passes/fails
});
```

### 3. Generate Content-Addressed Filenames

```javascript
async function saveWithVerification() {
  const htmlContent = buildYourHTML(); // Your HTML building logic
  const trust = new TrustManager();
  const filename = await trust.generateCommitFilename('myapp', htmlContent);
  // Result: "myapp.a1b2c3d4.html"
  
  downloadFile(htmlContent, filename);
}
```

**That's it!** Your app now has verifiable integrity.

---

## Why This Matters

### The Problem
- Users can't tell if HTML files have been tampered with
- No built-in way to verify file authenticity
- Trust issues when sharing files via email, USB, etc.

### The Solution

Content-addressed filenames use hash in filename as proof of integrity. Visual trust indicators show green badge for verified, red for tampered. Built-in modal explains verification to users. All verification happens client-side with zero backend required.

### The User Experience

Users see: Open an HTML file, see a green VERIFIED badge in the corner, click to see hash and learn about verification, trust the file because the hash matches.

If someone tampers: User opens modified file, sees red TAMPERED badge, gets clear warning not to trust the file, can see expected vs actual hash.

---

## API Reference

### TrustManager Constructor

```javascript
const trust = new TrustManager(config);
```

Config Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoVerify` | boolean | `true` | Automatically verify on page load |
| `showBadge` | boolean | `true` | Show trust badge |
| `badgePosition` | string | `'top-right'` | Badge position: `'top-right'`, `'top-left'`, `'bottom-right'`, `'bottom-left'` |
| `educationMode` | boolean | `true` | Show "Learn more" button in badge |
| `hashLength` | number | `8` | Characters to use from hash in filename |
| `excludeSelectors` | array | `['#trust-badge']` | Elements to exclude from hash calculation |
| `onVerificationComplete` | function | `null` | Callback when verification completes |

Example with all options:

```javascript
const trust = new TrustManager({
  autoVerify: true,
  showBadge: true,
  badgePosition: 'top-left',
  educationMode: true,
  hashLength: 16,
  excludeSelectors: ['#trust-badge', '.dynamic-timestamp'],
  onVerificationComplete: (result) => {
    console.log('Status:', result.status);
    if (result.status === 'TAMPERED') {
      // Handle tampered file
      showWarning('This file has been modified!');
    }
  }
});
```

### Methods

#### `verify()`
Manually trigger verification (useful if autoVerify is false).

```javascript
const result = await trust.verify();
console.log(result.status); // 'VERIFIED', 'UNVERIFIED', or 'TAMPERED'
```

Result object:

```javascript
{
  status: 'VERIFIED',      // or 'UNVERIFIED', 'TAMPERED'
  hash: 'a1b2c3d4',        // Short hash from filename
  fullHash: 'a1b2c3d4...', // Full SHA-256 hash
  filename: 'app.a1b2c3d4.html'
}
```

#### `generateCommitFilename(basename, htmlContent)`
Generate content-addressed filename.

```javascript
const filename = await trust.generateCommitFilename('contract', htmlContent);
// Returns: "contract.a1b2c3d4.html"
```

#### `generateContentHash(htmlContent)`
Get SHA-256 hash of HTML content.

```javascript
const hash = await trust.generateContentHash(htmlContent);
// Returns: "a1b2c3d4e5f6789a..." (full SHA-256)
```

#### `exportVerificationProof()`
Export verification details for record-keeping.

```javascript
const proof = trust.exportVerificationProof();
// Returns:
{
  timestamp: "2026-01-13T15:30:00Z",
  filename: "contract.a1b2c3d4.html",
  result: { status: 'VERIFIED', hash: '...' },
  userAgent: "Mozilla/5.0..."
}
```

---

## Integration Patterns

### Pattern 1: Notes App

```javascript
// Initialize trust manager
const trust = new TrustManager();

async function saveNotes() {
  // Build HTML with current notes
  const htmlContent = buildHTML();
  
  // Generate content-addressed filename
  const filename = await trust.generateCommitFilename('notes', htmlContent);
  
  // Save to file
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Pattern 2: Contract App (High Trust Required)

```javascript
const trust = new TrustManager({
  educationMode: true,
  onVerificationComplete: (result) => {
    if (result.status === 'TAMPERED') {
      // Block interaction for tampered contracts
      document.body.innerHTML = `
        <div style="text-align: center; padding: 50px;">
          <h1>Security Warning</h1>
          <p>This contract has been modified and cannot be trusted.</p>
          <p>Expected hash: ${result.expected}</p>
          <p>Actual hash: ${result.actual}</p>
        </div>
      `;
    } else if (result.status === 'VERIFIED') {
      // Show verified indicator in contract header
      addVerifiedBadgeToHeader(result.hash);
    }
  }
});
```

### Pattern 3: Multi-Version App (Like Git)

```javascript
const trust = new TrustManager();

async function commitChanges(message) {
  const timestamp = new Date().toISOString();
  
  // Build commit metadata
  const metadata = {
    message,
    timestamp,
    parentHash: getCurrentHash()
  };
  
  // Build HTML with metadata
  const htmlContent = buildHTMLWithMetadata(metadata);
  
  // Generate content-addressed filename
  const filename = await trust.generateCommitFilename('app', htmlContent);
  
  // Extract hash for metadata
  const hash = trust.extractHashFromFilename(filename);
  
  // Store in commit history table
  db.run(
    'INSERT INTO commits (hash, parent, message, timestamp) VALUES (?, ?, ?, ?)',
    [hash, metadata.parentHash, message, timestamp]
  );
  
  // Save file
  await saveFile(htmlContent, filename);
}
```

---

## Best Practices

### 1. Always Use Content-Addressed Filenames

Good:
```javascript
const filename = await trust.generateCommitFilename('contract', html);
// contract.a1b2c3d4.html
```

Bad:
```javascript
const filename = 'contract.html'; // No hash!
```

### 2. Exclude Dynamic Elements from Hash

If your app has dynamic timestamps or counters, exclude them:

```javascript
const trust = new TrustManager({
  excludeSelectors: [
    '#trust-badge',
    '.last-viewed-timestamp',
    '.session-counter'
  ]
});
```

### 3. Educate Users

Always enable education mode for user-facing apps:

```javascript
const trust = new TrustManager({
  educationMode: true // Shows "Learn more" button
});
```

### 4. Handle Verification Results

Always provide feedback based on verification:

```javascript
const trust = new TrustManager({
  onVerificationComplete: (result) => {
    switch (result.status) {
      case 'VERIFIED':
        console.log('✓ File verified');
        break;
      case 'UNVERIFIED':
        console.warn('⚠ Cannot verify - no hash in filename');
        break;
      case 'TAMPERED':
        console.error('✗ TAMPERED - DO NOT TRUST');
        alert('WARNING: This file has been tampered with!');
        break;
    }
  }
});
```

### 5. Add Filename Meta Tag

Help the trust manager identify the filename:

```html
<head>
  <meta name="filename" content="contract.a1b2c3d4.html">
</head>
```

---

## Advanced Features

### Multi-Level Verification

For maximum trust, combine multiple verification methods:

```javascript
// Level 1: Content-addressed filename (always)
const filename = await trust.generateCommitFilename('doc', html);

// Level 2: Digital signature (optional)
const signature = await signWithPrivateKey(html, privateKey);

// Level 3: Blockchain timestamp (optional)
const blockchainProof = await submitToOpenTimestamps(hash);

// Embed all verification data
const metadata = {
  contentHash: hash,
  signature: signature,
  blockchain: blockchainProof
};
```

### Custom Badge Styling

Override CSS for custom branding:

```css
/* Your custom styles */
.trust-badge.trust-verified {
  background: linear-gradient(135deg, #your-brand-color 0%, #darker-shade 100%);
}
```

### Programmatic Badge Control

```javascript
const trust = new TrustManager({
  showBadge: false // Don't show automatically
});

// Show badge only under certain conditions
if (userWantsToSeeVerification) {
  trust.renderBadge();
}
```

---

## Testing Your Integration

### Test Case 1: Valid File
1. Save a file with content-addressed filename
2. Open it
3. Should show ✓ VERIFIED badge

### Test Case 2: Tampered File
1. Save a file with content-addressed filename
2. Edit content in text editor (change any text)
3. Open it
4. Should show ✗ TAMPERED badge

### Test Case 3: Non-Content-Addressed File
1. Save a file without hash in filename
2. Open it
3. Should show ⚠ UNVERIFIED badge

### Test Case 4: Verification Callback
```javascript
const trust = new TrustManager({
  onVerificationComplete: (result) => {
    console.assert(
      ['VERIFIED', 'UNVERIFIED', 'TAMPERED'].includes(result.status),
      'Valid status'
    );
  }
});
```

---

## Troubleshooting

### Badge Not Showing

Check:
1. Is `trust-badge.css` loaded?
2. Is `TrustManager` initialized?
3. Check browser console for errors

```javascript
// Debug mode
const trust = new TrustManager({
  onVerificationComplete: (result) => {
    console.log('Verification result:', result);
  }
});
```

### Hash Mismatch on Valid File

Possible causes:
1. Dynamic content being hashed (exclude it)
2. Whitespace differences
3. Browser modifying HTML (e.g., adding attributes)

Solution:
```javascript
const trust = new TrustManager({
  excludeSelectors: [
    '#trust-badge',
    '.dynamic-timestamp',
    '[data-session-id]' // Any dynamic attributes
  ]
});
```

### Filename Not Detected

Add meta tag:
```html
<meta name="filename" content="yourfile.a1b2c3d4.html">
```

Or set title:
```html
<title>yourfile.a1b2c3d4.html</title>
```

---

## Real-World Examples

### Example 1: Invoice App

```javascript
// invoice-app.js
const trust = new TrustManager({
  badgePosition: 'bottom-right',
  onVerificationComplete: (result) => {
    // Add verification status to printable invoice
    document.getElementById('invoice-status').innerHTML = 
      result.status === 'VERIFIED' 
        ? '✓ This invoice is verified and unmodified'
        : '⚠ Cannot verify invoice integrity';
  }
});

async function generateInvoice(invoiceData) {
  const html = buildInvoiceHTML(invoiceData);
  const invoiceNumber = invoiceData.number;
  const filename = await trust.generateCommitFilename(
    `invoice-${invoiceNumber}`,
    html
  );
  await saveFile(html, filename);
}
```

### Example 2: Legal Document App

```javascript
// legal-doc.js
const trust = new TrustManager({
  educationMode: true,
  onVerificationComplete: (result) => {
    if (result.status !== 'VERIFIED') {
      // Show warning banner
      showWarningBanner(
        'This document cannot be verified. Do not sign or rely on this document.'
      );
      // Disable signature buttons
      document.querySelectorAll('.signature-btn').forEach(btn => {
        btn.disabled = true;
      });
    }
  }
});
```

### Example 3: Medical Records App

```javascript
// medical-records.js
const trust = new TrustManager({
  badgePosition: 'top-right',
  hashLength: 16, // Longer hash for medical records
  onVerificationComplete: (result) => {
    // Log verification for audit trail
    logAuditEvent({
      action: 'FILE_OPENED',
      verificationStatus: result.status,
      hash: result.hash,
      timestamp: new Date().toISOString(),
      userId: getCurrentUserId()
    });
    
    // Block access to tampered records
    if (result.status === 'TAMPERED') {
      window.location.href = '/security-warning';
    }
  }
});
```

---

## Command Line Tools

### Verify File Integrity

```bash
# Generate hash of file
sha256sum myfile.a1b2c3d4.html

# Check if first 8 characters match filename
# Should start with: a1b2c3d4
```

### Batch Verification

```bash
#!/bin/bash
# verify-all.sh

for file in *.html; do
  # Extract hash from filename
  hash=$(echo "$file" | sed -n 's/.*\.\([a-f0-9]\{8\}\)\.html$/\1/p')
  
  if [ -z "$hash" ]; then
    echo " $file - No hash in filename"
    continue
  fi
  
  # Calculate actual hash
  actual=$(sha256sum "$file" | cut -c1-8)
  
  if [ "$hash" = "$actual" ]; then
    echo "✓ $file - Verified"
  else
    echo "✗ $file - TAMPERED (expected: $hash, actual: $actual)"
  fi
done
```

---

## Migration Guide

### Adding Trust to Existing App

Step 1: Add trust manager to your HTML template

```html
<link rel="stylesheet" href="lib/trust-badge.css">
<script src="lib/trust-manager.js"></script>
```

Step 2: Initialize in your existing initialization code

```javascript
// Your existing init function
async function init() {
  // ... existing initialization ...
  
  // Add trust manager
  const trust = new TrustManager();
  
  // ... rest of your code ...
}
```

Step 3: Update save function to use content-addressed filenames

```javascript
// Before
async function save() {
  const html = buildHTML();
  saveFile(html, 'myapp.html'); // Static filename
}

// After
async function save() {
  const html = buildHTML();
  const trust = new TrustManager();
  const filename = await trust.generateCommitFilename('myapp', html);
  saveFile(html, filename); // Content-addressed filename
}
```

**Done!** Your app now has verifiable integrity.

---

## FAQ

### Q: Does this prevent tampering?
A: No, it detects tampering. Anyone can modify the file, but the badge will show it's been tampered with.

### Q: Can an attacker modify both the content and update the filename?
A: Yes, but:
1. Users learn to expect specific filenames
2. Multiple copies act as verification (if hashes differ, someone modified one)
3. Digital signatures (optional) prevent this attack
4. Blockchain timestamps (optional) create immutable record

### Q: What if users don't look at the badge?
A: That's why education mode is important. The badge catches their attention and teaches them to check it.

### Q: How secure is SHA-256?
A: Very. It's cryptographically secure and collision-resistant. Finding two files with the same SHA-256 hash is computationally infeasible.

### Q: Do I need a backend server?
A: No. Everything works client-side in the browser.

### Q: What about older browsers?
A: Requires modern browsers with `crypto.subtle` API (Chrome 60+, Firefox 57+, Safari 11+).

---

## Support & Community

- GitHub Issues: Report bugs on the repository
- Discussions: Ask questions on the repository
- Examples: Check `/examples/04-trust-demo.html`

---

## What's Next?

1. Content-addressed filenames (implemented)
2. Digital signatures (in progress)
3. Blockchain timestamping (planned)
4. Browser extension (planned)
5. Mobile verification app (planned)

---

Trust is your app's killer feature. Make verification visible, expected, and user-friendly.
