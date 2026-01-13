# Trust & Integrity Architecture

## Vision

Make **verifiable integrity** a primary, visible feature that users learn to trust and demand. Every HTML-SQLite file should display its trust status prominently, making tampering obvious and verification simple.

## Core Principles

1. Transparency Over Obscurity: Show verification status clearly
2. Content-Addressed by Default: Filename = hash of content
3. Visual Trust Language: Color-coded badges users recognize
4. One-Click Verification: Make checking integrity effortless
5. Educational: Teach users why it matters

---

## Trust Badge System

### Visual Components

```
┌─────────────────────────────────────────┐
│  ✓ VERIFIED                             │
│  File integrity confirmed               │
│  SHA-256: a1b2c3d4e5f6...              │
│  Click to learn more                    │
└─────────────────────────────────────────┘
   ↑ Green badge - file is authentic

┌─────────────────────────────────────────┐
│  ⚠ UNVERIFIED                           │
│  Cannot confirm file integrity          │
│  Reason: Filename doesn't match hash    │
│  This file may have been modified       │
└─────────────────────────────────────────┘
   ↑ Yellow badge - warning

┌─────────────────────────────────────────┐
│  ✗ TAMPERED                             │
│  File has been modified                 │
│  Expected: a1b2c3d4...                  │
│  Actual: z9y8x7w6...                    │
│  DO NOT TRUST THIS FILE                 │
└─────────────────────────────────────────┘
   ↑ Red badge - file is corrupted/tampered
```

### Badge States

| State | Color | Icon | Meaning |
|-------|-------|------|---------|
| VERIFIED | Green | ✓ | Content hash matches filename |
| SIGNED | Blue | | Cryptographically signed + verified |
| TIMESTAMPED | Purple | ⏰ | Blockchain timestamp verified |
| UNVERIFIED | Yellow | ⚠ | Cannot verify (wrong filename, no hash) |
| TAMPERED | Red | ✗ | Content doesn't match expected hash |
| CHECKING | Gray | ⟳ | Verification in progress |

---

## Content-Addressed Filenames (Primary Method)

### Format

```
{basename}.{hash}.html
```

Examples:
```
contract.a1b2c3d4.html
notes.7f3e8d92.html
invoice-2024.f4b9c2e1.html
```

### Hash Generation

```javascript
async function generateContentHash(htmlContent) {
  // Remove volatile elements before hashing
  const normalized = normalizeHTML(htmlContent);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.slice(0, 8); // First 8 chars (32 bits)
}

function normalizeHTML(html) {
  // Remove elements that shouldn't affect content hash:
  // - Current verification badge (dynamic)
  // - Timestamp displays (if they auto-update)
  // - Script execution state
  
  let normalized = html;
  
  // Remove trust badge element (it's added dynamically)
  normalized = normalized.replace(
    /<div id="trust-badge"[^>]*>[\s\S]*?<\/div>/,
    ''
  );
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}
```

### Verification

```javascript
async function verifyFileIntegrity() {
  const filename = getFilename(); // from window.location or file handle
  const expectedHash = extractHashFromFilename(filename);
  
  if (!expectedHash) {
    return { status: 'UNVERIFIED', reason: 'No hash in filename' };
  }
  
  const htmlContent = document.documentElement.outerHTML;
  const actualHash = await generateContentHash(htmlContent);
  
  if (actualHash === expectedHash) {
    return { status: 'VERIFIED', hash: actualHash };
  } else {
    return { 
      status: 'TAMPERED', 
      expected: expectedHash, 
      actual: actualHash 
    };
  }
}

function extractHashFromFilename(filename) {
  // Match: basename.{hash}.html
  const match = filename.match(/\.([a-f0-9]{8,64})\.html$/i);
  return match ? match[1] : null;
}

function getFilename() {
  // Try multiple methods to get filename
  if (window.location.protocol === 'file:') {
    // Local file - extract from URL
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1);
  } else {
    // Served over HTTP - use document title or meta tag
    return document.querySelector('meta[name="filename"]')?.content || 
           document.title;
  }
}
```

---

## Framework API for Developers

### Core Class: `TrustManager`

```javascript
class TrustManager {
  constructor(config = {}) {
    this.config = {
      hashLength: config.hashLength || 8, // chars in filename
      autoVerify: config.autoVerify !== false,
      showBadge: config.showBadge !== false,
      badgePosition: config.badgePosition || 'top-right',
      educationMode: config.educationMode !== false,
      onVerificationComplete: config.onVerificationComplete || null,
      ...config
    };
    
    this.verificationResult = null;
    
    if (this.config.autoVerify) {
      this.verify();
    }
  }
  
  async verify() {
    this.verificationResult = await verifyFileIntegrity();
    
    if (this.config.showBadge) {
      this.renderBadge();
    }
    
    if (this.config.onVerificationComplete) {
      this.config.onVerificationComplete(this.verificationResult);
    }
    
    return this.verificationResult;
  }
  
  renderBadge() {
    const badge = this.createBadgeElement(this.verificationResult);
    document.body.appendChild(badge);
  }
  
  createBadgeElement(result) {
    // Returns a styled trust badge element
    // See implementation below
  }
  
  async generateCommitFilename(basename, htmlContent) {
    const hash = await generateContentHash(htmlContent);
    return `${basename}.${hash}.html`;
  }
  
  exportVerificationProof() {
    return {
      timestamp: new Date().toISOString(),
      filename: getFilename(),
      ...this.verificationResult
    };
  }
}
```

### Usage for App Developers

```javascript
// Minimal setup
const trust = new TrustManager();

// Custom configuration
const trust = new TrustManager({
  hashLength: 16,
  badgePosition: 'bottom-left',
  educationMode: true,
  onVerificationComplete: (result) => {
    console.log('Verification:', result.status);
    if (result.status === 'TAMPERED') {
      alert('WARNING: This file has been tampered with!');
    }
  }
});

// Manual verification
const result = await trust.verify();
if (result.status === 'VERIFIED') {
  console.log('✓ File is authentic');
}

// Generate filename for commit
const newFilename = await trust.generateCommitFilename(
  'contract',
  htmlContent
);
// Result: "contract.a1b2c3d4.html"
```

---

## Trust Badge Component

### HTML Structure

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
      <code class="trust-hash" title="a1b2c3d4e5f6789a">a1b2c3d4</code>
      <button class="trust-copy" data-copy="a1b2c3d4e5f6789a">📋</button>
    </div>
    <div class="trust-detail-item">
      <strong>Method:</strong> Content-addressed filename
    </div>
    <button class="trust-learn-more">Learn about file verification →</button>
  </div>
</div>
```

### CSS Styles

```css
/* Trust Badge Base Styles */
.trust-badge {
  position: fixed;
  z-index: 9999;
  max-width: 320px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  font-family: system-ui, sans-serif;
  font-size: 14px;
  transition: all 0.3s ease;
}

/* Position variants */
.trust-badge[data-position="top-right"] {
  top: 16px;
  right: 16px;
}

.trust-badge[data-position="top-left"] {
  top: 16px;
  left: 16px;
}

.trust-badge[data-position="bottom-right"] {
  bottom: 16px;
  right: 16px;
}

.trust-badge[data-position="bottom-left"] {
  bottom: 16px;
  left: 16px;
}

/* Status-specific colors */
.trust-verified {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.trust-signed {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.trust-timestamped {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.trust-unverified {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.trust-tampered {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

/* Badge Header */
.trust-badge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
}

.trust-icon {
  font-size: 20px;
  font-weight: bold;
}

.trust-status {
  font-weight: 700;
  flex: 1;
  letter-spacing: 0.5px;
}

.trust-expand {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: inherit;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.trust-expand:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Badge Details (expandable) */
.trust-details {
  padding: 0 16px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin-top: 8px;
  animation: slideDown 0.2s ease;
}

.trust-detail-item {
  margin: 12px 0;
  line-height: 1.4;
}

.trust-hash {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  cursor: pointer;
}

.trust-copy {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  opacity: 0.8;
}

.trust-copy:hover {
  opacity: 1;
}

.trust-learn-more {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: inherit;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  font-weight: 600;
  margin-top: 8px;
  transition: background 0.2s;
}

.trust-learn-more:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Animations */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Compact mode (collapsed) */
.trust-badge:not(.expanded) {
  cursor: pointer;
}

.trust-badge:not(.expanded):hover {
  transform: scale(1.05);
}
```

---

## User Education Modal

When user clicks "Learn more", show educational content:

```html
<div class="trust-education-modal">
  <div class="trust-education-content">
    <h2>Why File Verification Matters</h2>
    
    <div class="trust-education-section">
      <h3>What is a content-addressed file?</h3>
      <p>
        The filename includes a unique "fingerprint" (hash) of the file's content.
        If anyone modifies the file, the fingerprint changes, making tampering obvious.
      </p>
      <div class="trust-education-example">
        <code>contract.a1b2c3d4.html</code>
        <span class="trust-education-arrow">→</span>
        <code class="trust-education-hash">a1b2c3d4</code> = fingerprint
      </div>
    </div>
    
    <div class="trust-education-section">
      <h3>How to verify a file:</h3>
      <ol>
        <li>Look for the <span class="trust-badge-mini trust-verified">✓ VERIFIED</span> badge</li>
        <li>Check that the filename matches the format: <code>name.{hash}.html</code></li>
        <li>If the badge is <span class="trust-badge-mini trust-tampered">✗ TAMPERED</span>, don't trust the file</li>
      </ol>
    </div>
    
    <div class="trust-education-section">
      <h3>What each status means:</h3>
      <ul>
        <li><span class="trust-badge-mini trust-verified">✓ VERIFIED</span> - File is authentic and unmodified</li>
        <li><span class="trust-badge-mini trust-signed">SIGNED</span> - Cryptographically signed by creator</li>
        <li><span class="trust-badge-mini trust-timestamped">⏰ TIMESTAMPED</span> - Recorded on blockchain</li>
        <li><span class="trust-badge-mini trust-unverified">⚠ UNVERIFIED</span> - Cannot confirm integrity</li>
        <li><span class="trust-badge-mini trust-tampered">✗ TAMPERED</span> - File has been modified</li>
      </ul>
    </div>
    
    <div class="trust-education-section">
      <h3>Manual Verification</h3>
      <p>You can verify any file yourself:</p>
      <ol>
        <li>Use a SHA-256 hash calculator tool</li>
        <li>Hash the entire file</li>
        <li>Compare the first 8 characters with the filename</li>
        <li>If they match, the file is authentic</li>
      </ol>
      <a href="https://emn178.github.io/online-tools/sha256_checksum.html" target="_blank">
        Try an online SHA-256 calculator →
      </a>
    </div>
    
    <button class="trust-education-close">Got it!</button>
  </div>
</div>
```

---

## Implementation Guide for Developers

### Step 1: Include Trust Manager

```html
<script src="lib/trust-manager.js"></script>
<link rel="stylesheet" href="lib/trust-badge.css">
```

### Step 2: Initialize on Page Load

```javascript
// Auto-initialize with defaults
document.addEventListener('DOMContentLoaded', () => {
  const trust = new TrustManager({
    autoVerify: true,
    showBadge: true,
    badgePosition: 'top-right',
    educationMode: true
  });
});
```

### Step 3: Generate Content-Addressed Commits

```javascript
async function commitChanges(message) {
  const exported = db.export();
  const base64Db = uint8ArrayToBase64(exported);
  
  // Build new commit metadata
  const newCommitHash = await generateCommitHash({ ... });
  const metadata = {
    commitHash: newCommitHash,
    parentHash: currentMetadata.commitHash,
    commitMessage: message,
    commitDate: new Date().toISOString(),
    // ... other metadata
  };
  
  // Build HTML with new data
  let htmlContent = buildHTML(db, metadata);
  
  // Generate content-addressed filename
  const trust = new TrustManager();
  const filename = await trust.generateCommitFilename(
    metadata.basename,
    htmlContent
  );
  
  // Save with content-addressed filename
  await saveFile(htmlContent, filename);
}
```

---

## Multi-Level Trust System

For maximum security, support multiple verification methods:

```javascript
{
  "verification": {
    // Level 1: Content-addressed (always present)
    "contentHash": "a1b2c3d4e5f6789a",
    "hashAlgorithm": "SHA-256",
    "hashLength": 8,
    
    // Level 2: Digital signature (optional)
    "signature": {
      "algorithm": "RSASSA-PKCS1-v1_5",
      "signature": "base64-encoded-signature",
      "publicKeyURL": "https://example.com/publickey.pem",
      "keyFingerprint": "SHA256:abc123..."
    },
    
    // Level 3: Blockchain timestamp (optional)
    "blockchain": {
      "service": "OpenTimestamps",
      "hash": "full-sha256-hash",
      "proof": "base64-encoded-proof",
      "verifyURL": "https://opentimestamps.org/..."
    },
    
    // Level 4: Social verification (optional)
    "social": {
      "mirrors": [
        "https://example.com/files/contract.a1b2c3d4.html",
        "ipfs://Qm...",
        "ar://..."
      ]
    }
  }
}
```

Badge shows highest level of verification available:
- ⏰ TIMESTAMPED (blockchain) > SIGNED > ✓ VERIFIED (hash only)

---

## Command Line Verification Tool

Provide a simple CLI tool for power users:

```bash
# Verify file integrity
$ html-sqlite verify contract.a1b2c3d4.html
✓ VERIFIED - File integrity confirmed
  Expected: a1b2c3d4
  Actual:   a1b2c3d4
  Method:   Content-addressed filename

# Generate hash for file
$ html-sqlite hash contract.html
  SHA-256: a1b2c3d4e5f6789a1b2c3d4e5f6789a1b2c3d4e5f6789a
  Short (8 chars): a1b2c3d4
  Suggested filename: contract.a1b2c3d4.html

# Verify with signature
$ html-sqlite verify --signature contract.a1b2c3d4.html
✓ VERIFIED - Content hash matches
SIGNED - Signature valid
  Signer: John Doe (john@example.com)
  Key fingerprint: SHA256:abc123...
  Signed: 2026-01-13 15:30:00 UTC
```

---

## Browser Extension (Future)

A browser extension that:
- Automatically verifies all HTML-SQLite files
- Shows trust indicator in browser chrome
- Warns before opening tampered files
- Provides one-click verification
- Maintains whitelist of trusted public keys

---

## Summary: Trust as a Feature

What users see:
- Green badge = file is safe
- Yellow badge = be cautious
- Red badge = don't trust

What developers get:
- Simple API: `new TrustManager()`
- Automatic verification on load
- Content-addressed filenames by default
- Optional advanced features (signatures, blockchain)

What this solves:
- Makes integrity verification visible and expected
- Trains users to demand verified files
- Makes tampering obvious
- Provides cryptographic proof when needed
- Creates a trust ecosystem

We turn the "weakness" (self-validation limits) into a strength by making verification transparent, expected, and user-friendly.
