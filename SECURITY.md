# Security

MemoryFile takes security seriously. This document outlines security considerations, known limitations, and best practices for developers and users.

## Reporting Security Issues

If you discover a security vulnerability, please email **security@memoryfile.org** or open a private security advisory on GitHub. Do not open public issues for security vulnerabilities.

We will respond within 48 hours and work with you to understand and address the issue.

## Security Model

### Architecture Overview

MemoryFile creates self-contained HTML files with embedded SQLite databases that run entirely in the browser. Understanding the security model requires understanding what this architecture protects against and what it doesn't.

This architecture provides SQL injection protection (via parameterized queries), file tampering detection (via content-addressed filenames), and data integrity verification (via SHA-256 hashing).

However, it does not provide data at rest encryption by default, protection against malicious file content, protection against supply chain attacks (depends on SQLite WASM integrity), or XSS protection if developers mishandle user input.

### Trust Model

MemoryFile uses a "trust but verify" model with three mechanisms:

Content-addressed filenames include a hash of the file content in the filename (e.g., `notes.a1b2c3d4.html`). Visual trust badges display verification status prominently. Files check their own integrity on load.

Important limitation: Files verify themselves, which means a sophisticated attacker who modifies both the content and verification code could bypass checks. The content-addressed filename makes such tampering obvious to users who check the filename.

## Known Security Considerations

### 1. Content Security Policy (CSP)

SQLite WASM requires `unsafe-eval` in Content Security Policy:

```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' 'unsafe-inline' 'unsafe-eval';">
```

WebAssembly compilation and instantiation (`WebAssembly.instantiate()`) is treated by browsers as dynamic code execution, similar to `eval()`. Without `unsafe-eval`, browsers block WASM instantiation with:

```
CompileError: WebAssembly.instantiate(): Refused to compile or instantiate 
WebAssembly module because 'unsafe-eval' is not an allowed source of script
```

This weakens XSS protections. If any XSS vulnerability exists in your application, `unsafe-eval` makes exploitation easier by allowing attackers to execute arbitrary code using `eval()`, `Function()`, or similar mechanisms.

Carefully validate and sanitize all user input. Use `textContent` instead of `innerHTML` when displaying user data. Follow secure coding practices in the "Best Practices" section below. Consider this an acceptable trade-off only if you implement strict input validation throughout your application.

### 2. Encryption at Rest (Enabled by Default)

MemoryFile implements AES-256-GCM authenticated encryption with PBKDF2 key derivation. Encryption is **enabled by default** to protect sensitive data.

Encryption uses AES-256-GCM with PBKDF2 key derivation (SHA-256, 100,000 iterations). Each encryption generates a random 16-byte salt and 12-byte IV. Users provide a password when opening and saving files.

Example:

```javascript
// Encryption enabled by default
const mf = new MemoryFile({ encrypted: true }); // default

// Load with password
await mf.loadEmbeddedDatabase('your-secure-password');

// Save with same password
await mf.saveToFile('filename.html', 'your-secure-password');

// Change password on save
await mf.saveToFile('filename.html', 'new-password', true);

// Disable encryption (not recommended for sensitive data)
const mf = new MemoryFile({ encrypted: false });
```

Security properties:
- 100,000 PBKDF2 iterations resist brute-force attacks
- GCM authentication tag detects tampering
- Password never stored in file, only used for key derivation
- Changing password re-encrypts with new cryptographic material

Important notes:
- No password recovery mechanism - users must remember passwords
- Encryption protects data at rest, not in browser memory during use
- For regulated data (HIPAA, SOX), ensure passwords meet requirements

### 3. Supply Chain Security

MemoryFile files must be self-contained with all runtime dependencies bundled internally. SQLite WASM files are included in the `/lib/` directory (`sql-wasm.js` and `sql-wasm.wasm`).

Applications must load SQLite WASM from bundled files:

```html
<script src="lib/sql-wasm.js"></script>
```

```javascript
const sqlModule = await initSqlJs({
  locateFile: file => `lib/${file}`
});
```

Never load runtime dependencies from external sources. Once downloaded, MemoryFile applications must work completely offline without external network requests. This ensures the file remains self-contained and eliminates supply chain attack vectors.

Note: Hosting the complete HTML file on a CDN for distribution is fine - the requirement is that the file itself contains everything needed to run.

### 4. Hash Collision Risk

Default hash length is 8 characters (32 bits) from SHA-256. Birthday paradox means approximately 65,000 files create a 50% chance of collision. An attacker could craft a malicious file with the same 8-character hash prefix.

Increase hash length for high-security applications:

```javascript
const trust = new TrustManager({ hashLength: 16 }); // 64 bits
```

For critical applications, use full 64-character SHA-256 hash. Document hash length choice in your application.

### 5. Cross-Site Scripting (XSS)

If user input is not properly sanitized, stored XSS attacks are possible. Malicious content stored in the database could execute when rendered.

Always escape user input when displaying:

```javascript
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

Use `textContent` instead of `innerHTML` when possible. Validate input format and length. Implement Content Security Policy.

### 6. File System Access API

Applications request file write permissions from users. Over-permissioned applications could access more files than needed.

Request minimal necessary permissions. Clearly explain why permissions are needed. Allow users to deny permissions and use download fallback. Document permission scope in your application.

## Best Practices for Developers

### Input Validation

Always validate user input before storing:

```javascript
function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  // Trim and limit length
  input = input.trim().slice(0, maxLength);
  
  // Remove potentially dangerous characters if needed
  // (be careful not to break legitimate use cases)
  
  return input;
}

// Use with parameterized queries
db.run('INSERT INTO notes (title) VALUES (?)', [sanitizeInput(userInput)]);
```

### Output Encoding

Always encode output when displaying user content:

```javascript
// Safe: Uses textContent
element.textContent = userInput;

// Unsafe: Uses innerHTML
element.innerHTML = userInput; // DON'T DO THIS

// If you must use innerHTML, escape first
element.innerHTML = escapeHtml(userInput);
```

### Secure Database Queries

Always use parameterized queries:

```javascript
// Good: Parameterized query
db.run('SELECT * FROM users WHERE id = ?', [userId]);

// Bad: String concatenation
db.run(`SELECT * FROM users WHERE id = ${userId}`); // DON'T DO THIS
```

### Content-Addressed Filenames

Always use content-addressed filenames for files that need verification:

```javascript
const trust = new TrustManager({ hashLength: 16 }); // At least 16 chars
const filename = await trust.generateCommitFilename('myapp', htmlContent);
```

### HTTPS Only

Always serve MemoryFile applications over HTTPS in production:

- File System Access API requires secure context
- Prevents MITM attacks
- Protects user data in transit

### Dependency Management

- Bundle all runtime dependencies internally (SQLite WASM, etc.)
- Verify integrity of bundled `sql-wasm.js` and `sql-wasm.wasm` files
- Keep dependencies updated from official SQLite sources
- Monitor security advisories for SQLite
- Ensure files work completely offline after initial download

## Best Practices for Users

### Verify File Integrity

1. Check for the trust badge (green checkmark VERIFIED)
2. Verify the filename contains a hash (e.g., `notes.a1b2c3d4.html`)
3. If the badge shows TAMPERED, do not trust the file

### Download from Trusted Sources

- Only open MemoryFile files from sources you trust
- Verify the source before opening
- Check file hashes if provided by the source

### Be Cautious with Permissions

- Understand why an application needs file access
- Deny permissions if you're unsure
- Use download fallback if you don't trust the application

### Keep Backups

- MemoryFile files are self-contained, making backups easy
- Keep multiple versions for important data
- Store backups in secure locations

## Security Features

### Implemented Protections

Parameterized queries prevent SQL injection. Content-addressed filenames detect tampering. SHA-256 hashing provides cryptographically secure integrity verification. Visual trust badges make verification status obvious. HTML escaping utilities help prevent XSS. No server component eliminates server-side attack vectors.

### Future Enhancements

- Digital signatures for creator verification
- Blockchain timestamping for provenance
- Browser extension for automatic verification
- Hardware security key integration (WebAuthn)
- Multi-factor authentication support

## Vulnerability Disclosure

### Scope

Security issues in scope: SQL injection vulnerabilities, XSS vulnerabilities in core library, authentication/authorization bypasses, cryptographic weaknesses, supply chain vulnerabilities.

Out of scope: Issues in example applications (for demonstration only), issues requiring physical access to user's device, social engineering attacks, denial of service (client-side only).

### Response Timeline

- Critical vulnerabilities: Patch within 7 days
- High severity: Patch within 30 days
- Medium severity: Patch within 90 days
- Low severity: Addressed in next release

## Security Checklist for Developers

Before deploying a MemoryFile application:

- Bundle all runtime dependencies internally (SQLite WASM must be embedded or bundled)
- Implement input validation for all user inputs
- Use output encoding when displaying user content
- Use parameterized queries for all database operations
- Implement Content Security Policy (accept unsafe-eval limitation)
- Use HTTPS for all production deployments
- Set hash length to at least 16 characters for content addressing
- Test with trust verification enabled
- Document security considerations for your users
- Implement error handling that doesn't leak sensitive information
- **Enable encryption for sensitive data (enabled by default)**
- **Enforce strong password requirements for encrypted files**
- **Provide clear password recovery warnings to users**
- **Test encryption/decryption workflows thoroughly**
- Test in multiple browsers
- Review code for innerHTML usage
- Validate SQLite file format on load
- Implement proper permission scoping
- Verify Web Crypto API support before deployment

## Additional Resources

- [OWASP XSS Prevention Cheat Sheet](https://cheats.sheetsecurity.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [SQLite Security](https://sqlite.org/security.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [File System Access API Security](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API#security_considerations)

## License

This security documentation is provided under the same MIT License as MemoryFile. See LICENSE file for details.

Disclaimer: MemoryFile is provided "as is" without warranty of any kind. Users and developers are responsible for implementing appropriate security measures for their specific use cases.

---

Last updated: 2026-01-13  
Version: 1.0.0
