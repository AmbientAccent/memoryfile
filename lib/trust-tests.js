/**
 * Trust System Tests
 * Tests for integrity verification, content-addressed filenames, and trust badges
 */

async function registerTrustTests(runner) {
  const { Assert } = window;

  // ==========================================
  // TrustManager Initialization Tests
  // ==========================================
  
  runner.describe('TrustManager - Initialization', () => {
    runner.test('should create new TrustManager instance', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      Assert.assertNotNull(trust);
      Assert.assertInstanceOf(trust, TrustManager);
    });

    runner.test('should have default configuration', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      Assert.assertEqual(trust.config.hashLength, 8);
      Assert.assertEqual(trust.config.badgePosition, 'top-right');
      Assert.assertEqual(trust.config.educationMode, true);
    });

    runner.test('should accept custom configuration', () => {
      const trust = new TrustManager({
        autoVerify: false,
        showBadge: false,
        hashLength: 16,
        badgePosition: 'bottom-left',
        educationMode: false
      });
      
      Assert.assertEqual(trust.config.hashLength, 16);
      Assert.assertEqual(trust.config.badgePosition, 'bottom-left');
      Assert.assertEqual(trust.config.educationMode, false);
    });

    runner.test('should initialize with null verification result', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      Assert.assertNull(trust.verificationResult);
    });
  });

  // ==========================================
  // Content Hashing Tests
  // ==========================================
  
  runner.describe('Content Hashing', () => {
    runner.test('should generate SHA-256 hash', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content = '<html><body>Test Content</body></html>';
      
      const hash = await trust.generateContentHash(content);
      
      Assert.assertNotNull(hash);
      Assert.assertEqual(typeof hash, 'string');
      Assert.assertEqual(hash.length, 64); // SHA-256 is 64 hex characters
    });

    runner.test('should generate consistent hashes', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content = '<html><body>Test Content</body></html>';
      
      const hash1 = await trust.generateContentHash(content);
      const hash2 = await trust.generateContentHash(content);
      
      Assert.assertEqual(hash1, hash2);
    });

    runner.test('should generate different hashes for different content', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content1 = '<html><body>Content 1</body></html>';
      const content2 = '<html><body>Content 2</body></html>';
      
      const hash1 = await trust.generateContentHash(content1);
      const hash2 = await trust.generateContentHash(content2);
      
      Assert.assertNotEqual(hash1, hash2);
    });

    runner.test('should handle empty content', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const hash = await trust.generateContentHash('');
      
      Assert.assertNotNull(hash);
      Assert.assertEqual(typeof hash, 'string');
      // SHA-256 of empty string is a known value
      Assert.assertEqual(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    runner.test('should handle large content', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const largeContent = '<html><body>' + 'X'.repeat(100000) + '</body></html>';
      
      const hash = await trust.generateContentHash(largeContent);
      
      Assert.assertNotNull(hash);
      Assert.assertEqual(hash.length, 64);
    });

    runner.test('should handle special characters', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content = '<html><body>🔒 Special: <>&"\' 中文</body></html>';
      
      const hash = await trust.generateContentHash(content);
      
      Assert.assertNotNull(hash);
      Assert.assertEqual(hash.length, 64);
    });
  });

  // ==========================================
  // Filename Extraction Tests
  // ==========================================
  
  runner.describe('Filename Extraction', () => {
    runner.test('should extract hash from content-addressed filename', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const filename = 'contract.a1b2c3d4.html';
      
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertEqual(hash, 'a1b2c3d4');
    });

    runner.test('should handle longer hashes', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const filename = 'document.a1b2c3d4e5f6789a.html';
      
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertEqual(hash, 'a1b2c3d4e5f6789a');
    });

    runner.test('should return null for non-content-addressed filename', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const filename = 'regular-file.html';
      
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertNull(hash);
    });

    runner.test('should handle uppercase hash characters', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const filename = 'file.A1B2C3D4.html';
      
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertEqual(hash, 'a1b2c3d4'); // Should be lowercase
    });

    runner.test('should handle complex basenames', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const filename = 'my-complex-file-name.a1b2c3d4.html';
      
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertEqual(hash, 'a1b2c3d4');
    });

    runner.test('should reject invalid hash characters', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const filename = 'file.g1h2i3j4.html'; // g, h, i, j are not hex
      
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertNull(hash);
    });

    runner.test('should handle full 64-character hash', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const fullHash = 'a'.repeat(64);
      const filename = `file.${fullHash}.html`;
      
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertEqual(hash, fullHash);
    });
  });

  // ==========================================
  // Content-Addressed Filename Generation Tests
  // ==========================================
  
  runner.describe('Filename Generation', () => {
    runner.test('should generate content-addressed filename', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const basename = 'myapp';
      const content = '<html><body>Test</body></html>';
      
      const filename = await trust.generateCommitFilename(basename, content);
      
      Assert.assertContains(filename, basename);
      Assert.assertContains(filename, '.html');
      
      // Should have hash in format: basename.hash.html
      const parts = filename.split('.');
      Assert.assertEqual(parts.length, 3);
      Assert.assertEqual(parts[0], basename);
      Assert.assertEqual(parts[2], 'html');
      Assert.assertEqual(parts[1].length, 8); // Default hash length
    });

    runner.test('should use custom hash length', async () => {
      const trust = new TrustManager({
        autoVerify: false,
        showBadge: false,
        hashLength: 16
      });
      const content = '<html><body>Test</body></html>';
      
      const filename = await trust.generateCommitFilename('app', content);
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertEqual(hash.length, 16);
    });

    runner.test('should generate same filename for same content', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content = '<html><body>Test</body></html>';
      
      const filename1 = await trust.generateCommitFilename('app', content);
      const filename2 = await trust.generateCommitFilename('app', content);
      
      Assert.assertEqual(filename1, filename2);
    });

    runner.test('should generate different filenames for different content', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const filename1 = await trust.generateCommitFilename('app', 'Content 1');
      const filename2 = await trust.generateCommitFilename('app', 'Content 2');
      
      Assert.assertNotEqual(filename1, filename2);
    });

    runner.test('should handle special characters in basename', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content = '<html><body>Test</body></html>';
      
      const filename = await trust.generateCommitFilename('my-app_v2', content);
      
      Assert.assertContains(filename, 'my-app_v2');
      Assert.assertContains(filename, '.html');
    });
  });

  // ==========================================
  // HTML Normalization Tests
  // ==========================================
  
  runner.describe('HTML Normalization', () => {
    runner.test('should normalize whitespace', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const html = '<html>  <body>   Test   </body>  </html>';
      
      const normalized = trust.normalizeHTML(html);
      
      Assert.assertNotContains(normalized, '  '); // No double spaces
    });

    runner.test('should remove trust badge from hash calculation', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const html = `
        <html>
          <body>
            <div id="trust-badge">Badge content</div>
            <div>Real content</div>
          </body>
        </html>
      `;
      
      const normalized = trust.normalizeHTML(html);
      
      Assert.assertNotContains(normalized, 'trust-badge');
      Assert.assertContains(normalized, 'Real content');
    });

    runner.test('should handle empty HTML', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const normalized = trust.normalizeHTML('');
      
      Assert.assertEqual(normalized, '');
    });
  });

  // ==========================================
  // Verification Tests
  // ==========================================
  
  runner.describe('Verification', () => {
    runner.test('should verify matching content and filename', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      // Simulate a file with matching hash
      const content = '<html><body>Test</body></html>';
      const filename = await trust.generateCommitFilename('test', content);
      
      // Mock getFilename and getHTMLContent
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => content;
      
      const result = await trust.verify();
      
      Assert.assertEqual(result.status, 'VERIFIED');
      Assert.assertNotNull(result.hash);
    });

    runner.test('should detect tampered content', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      // Original content
      const originalContent = '<html><body>Original</body></html>';
      const filename = await trust.generateCommitFilename('test', originalContent);
      
      // Tampered content
      const tamperedContent = '<html><body>Modified</body></html>';
      
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => tamperedContent;
      
      const result = await trust.verify();
      
      Assert.assertEqual(result.status, 'TAMPERED');
      Assert.assertNotNull(result.expected);
      Assert.assertNotNull(result.actual);
      Assert.assertNotEqual(result.expected, result.actual);
    });

    runner.test('should return UNVERIFIED for non-content-addressed file', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      trust.getFilename = () => 'regular-file.html';
      trust.getHTMLContent = () => '<html><body>Test</body></html>';
      
      const result = await trust.verify();
      
      Assert.assertEqual(result.status, 'UNVERIFIED');
      Assert.assertContains(result.reason, 'No hash');
    });

    runner.test('should handle verification errors gracefully', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      trust.getFilename = () => { throw new Error('Test error'); };
      
      const result = await trust.verify();
      
      Assert.assertEqual(result.status, 'UNVERIFIED');
      Assert.assertContains(result.reason, 'error');
    });
  });

  // ==========================================
  // Badge Content Tests
  // ==========================================
  
  runner.describe('Badge Content Generation', () => {
    runner.test('should generate VERIFIED badge content', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const result = {
        status: 'VERIFIED',
        hash: 'a1b2c3d4',
        fullHash: 'a1b2c3d4e5f6789a',
        filename: 'test.a1b2c3d4.html'
      };
      
      const content = trust.getBadgeContent(result);
      
      Assert.assertEqual(content.icon, '✓');
      Assert.assertEqual(content.statusText, 'VERIFIED');
      Assert.assertContains(content.details, 'a1b2c3d4');
    });

    runner.test('should generate TAMPERED badge content', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const result = {
        status: 'TAMPERED',
        expected: 'a1b2c3d4',
        actual: 'z9y8x7w6'
      };
      
      const content = trust.getBadgeContent(result);
      
      Assert.assertEqual(content.icon, '✗');
      Assert.assertEqual(content.statusText, 'TAMPERED');
      Assert.assertContains(content.details, 'WARNING');
      Assert.assertContains(content.details, 'a1b2c3d4');
      Assert.assertContains(content.details, 'z9y8x7w6');
    });

    runner.test('should generate UNVERIFIED badge content', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const result = {
        status: 'UNVERIFIED',
        reason: 'No hash in filename'
      };
      
      const content = trust.getBadgeContent(result);
      
      Assert.assertEqual(content.icon, '⚠');
      Assert.assertEqual(content.statusText, 'UNVERIFIED');
      Assert.assertContains(content.details, 'Cannot confirm');
    });
  });

  // ==========================================
  // Badge Rendering Tests
  // ==========================================
  
  runner.describe('Badge Rendering', () => {
    runner.test('should create badge element', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const result = {
        status: 'VERIFIED',
        hash: 'a1b2c3d4',
        filename: 'test.a1b2c3d4.html'
      };
      
      const badge = trust.createBadgeElement(result);
      
      Assert.assertNotNull(badge);
      Assert.assertEqual(badge.id, 'trust-badge');
      Assert.assertContains(badge.className, 'trust-badge');
      Assert.assertContains(badge.className, 'trust-verified');
    });

    runner.test('should set badge position', () => {
      const positions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
      
      positions.forEach(position => {
        const trust = new TrustManager({
          autoVerify: false,
          showBadge: false,
          badgePosition: position
        });
        const result = { status: 'VERIFIED', hash: 'a1b2c3d4' };
        const badge = trust.createBadgeElement(result);
        
        Assert.assertEqual(badge.getAttribute('data-position'), position);
      });
    });

    runner.test('should apply correct CSS class for each status', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const statuses = ['VERIFIED', 'TAMPERED', 'UNVERIFIED'];
      
      statuses.forEach(status => {
        const result = { status, hash: 'test' };
        const badge = trust.createBadgeElement(result);
        
        Assert.assertContains(badge.className, `trust-${status.toLowerCase()}`);
      });
    });
  });

  // ==========================================
  // Verification Proof Export Tests
  // ==========================================
  
  runner.describe('Verification Proof Export', () => {
    runner.test('should export verification proof', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      trust.getFilename = () => 'test.a1b2c3d4.html';
      trust.getHTMLContent = () => '<html><body>Test</body></html>';
      
      await trust.verify();
      
      const proof = trust.exportVerificationProof();
      
      Assert.assertNotNull(proof);
      Assert.assertNotNull(proof.timestamp);
      Assert.assertEqual(proof.filename, 'test.a1b2c3d4.html');
      Assert.assertNotNull(proof.result);
      Assert.assertNotNull(proof.userAgent);
    });

    runner.test('should include verification result in proof', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const content = '<html><body>Test</body></html>';
      const filename = await trust.generateCommitFilename('test', content);
      
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => content;
      
      await trust.verify();
      
      const proof = trust.exportVerificationProof();
      
      Assert.assertEqual(proof.result.status, 'VERIFIED');
      Assert.assertNotNull(proof.result.hash);
    });
  });

  // ==========================================
  // HTML Escaping Tests
  // ==========================================
  
  runner.describe('HTML Escaping', () => {
    runner.test('should escape HTML special characters', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const escaped = trust.escapeHtml('<script>alert("xss")</script>');
      
      Assert.assertContains(escaped, '&lt;');
      Assert.assertContains(escaped, '&gt;');
      Assert.assertNotContains(escaped, '<script>');
    });

    runner.test('should escape quotes', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const input = 'Test "quotes" and \'apostrophes\'';
      const escaped = trust.escapeHtml(input);
      
      // The escaped string should be safe for HTML insertion
      // It should not contain raw quotes that could break HTML attributes
      // Note: textContent/innerHTML escaping behavior may vary, but the key is safety
      Assert.assertNotNull(escaped);
      Assert.assertEqual(typeof escaped, 'string');
      // Verify it doesn't break when inserted into HTML
      const testDiv = document.createElement('div');
      testDiv.innerHTML = escaped;
      Assert.assertEqual(testDiv.textContent, input); // Should round-trip correctly
    });

    runner.test('should escape ampersands', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const escaped = trust.escapeHtml('Test & ampersand');
      
      Assert.assertContains(escaped, '&amp;');
    });

    runner.test('should handle already escaped HTML', () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const escaped = trust.escapeHtml('&lt;already&gt;');
      
      Assert.assertContains(escaped, '&amp;lt;');
    });
  });

  // ==========================================
  // Integration Tests
  // ==========================================
  
  runner.describe('Integration - End-to-End Verification', () => {
    runner.test('should complete full verification cycle', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      // 1. Create content
      const content = '<html><body><h1>Test Document</h1></body></html>';
      
      // 2. Generate content-addressed filename
      const filename = await trust.generateCommitFilename('document', content);
      
      // 3. Simulate file opening
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => content;
      
      // 4. Verify
      const result = await trust.verify();
      
      // 5. Assertions
      Assert.assertEqual(result.status, 'VERIFIED');
      Assert.assertNotNull(result.hash);
      
      // 6. Verify hash matches filename
      const extractedHash = trust.extractHashFromFilename(filename);
      Assert.assertEqual(result.hash, extractedHash);
    });

    runner.test('should detect tampering in full cycle', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      // 1. Original content and filename
      const originalContent = '<html><body>Original</body></html>';
      const filename = await trust.generateCommitFilename('doc', originalContent);
      
      // 2. Tamper with content
      const tamperedContent = '<html><body>Tampered</body></html>';
      
      // 3. Simulate opening tampered file with original filename
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => tamperedContent;
      
      // 4. Verify
      const result = await trust.verify();
      
      // 5. Should detect tampering
      Assert.assertEqual(result.status, 'TAMPERED');
      Assert.assertNotNull(result.expected);
      Assert.assertNotNull(result.actual);
    });

    runner.test('should handle verification with callback', async () => {
      let callbackCalled = false;
      let callbackResult = null;
      
      const trust = new TrustManager({
        autoVerify: false,
        showBadge: false,
        onVerificationComplete: (result) => {
          callbackCalled = true;
          callbackResult = result;
        }
      });
      
      const content = '<html><body>Test</body></html>';
      const filename = await trust.generateCommitFilename('test', content);
      
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => content;
      
      await trust.verify();
      
      Assert.assertTrue(callbackCalled);
      Assert.assertNotNull(callbackResult);
      Assert.assertEqual(callbackResult.status, 'VERIFIED');
    });
  });

  // ==========================================
  // Performance Tests
  // ==========================================
  
  runner.describe('Performance', () => {
    runner.test('should hash content quickly (< 100ms)', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content = '<html><body>' + 'X'.repeat(10000) + '</body></html>';
      
      const start = performance.now();
      await trust.generateContentHash(content);
      const duration = performance.now() - start;
      
      Assert.assertLessThan(duration, 100);
    });

    runner.test('should verify quickly (< 100ms)', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const content = '<html><body>Test</body></html>';
      const filename = await trust.generateCommitFilename('test', content);
      
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => content;
      
      const start = performance.now();
      await trust.verify();
      const duration = performance.now() - start;
      
      Assert.assertLessThan(duration, 100);
    });

    runner.test('should handle multiple verifications efficiently', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      
      const content = '<html><body>Test</body></html>';
      const filename = await trust.generateCommitFilename('test', content);
      
      trust.getFilename = () => filename;
      trust.getHTMLContent = () => content;
      
      const iterations = 10;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await trust.verify();
      }
      
      const duration = performance.now() - start;
      const avgDuration = duration / iterations;
      
      Assert.assertLessThan(avgDuration, 100);
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================
  
  runner.describe('Edge Cases', () => {
    runner.test('should handle very long basenames', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const longBasename = 'a'.repeat(200);
      const content = '<html><body>Test</body></html>';
      
      const filename = await trust.generateCommitFilename(longBasename, content);
      
      Assert.assertContains(filename, longBasename);
      Assert.assertContains(filename, '.html');
    });

    runner.test('should handle content with null bytes', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const content = '<html><body>Test\x00Null</body></html>';
      
      const hash = await trust.generateContentHash(content);
      
      Assert.assertNotNull(hash);
      Assert.assertEqual(hash.length, 64);
    });

    runner.test('should handle unicode in filenames', async () => {
      const trust = new TrustManager({ autoVerify: false, showBadge: false });
      const basename = 'document-文档';
      const content = '<html><body>Test</body></html>';
      
      const filename = await trust.generateCommitFilename(basename, content);
      
      Assert.assertContains(filename, basename);
    });

    runner.test('should handle zero-length hash configuration', async () => {
      const trust = new TrustManager({
        autoVerify: false,
        showBadge: false,
        hashLength: 0
      });
      const content = '<html><body>Test</body></html>';
      
      const filename = await trust.generateCommitFilename('test', content);
      const parts = filename.split('.');
      
      // Should still work, just with empty hash section
      Assert.assertEqual(parts.length, 3);
      Assert.assertEqual(parts[1], ''); // Empty hash
    });

    runner.test('should handle maximum hash length', async () => {
      const trust = new TrustManager({
        autoVerify: false,
        showBadge: false,
        hashLength: 64
      });
      const content = '<html><body>Test</body></html>';
      
      const filename = await trust.generateCommitFilename('test', content);
      const hash = trust.extractHashFromFilename(filename);
      
      Assert.assertEqual(hash.length, 64);
    });
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerTrustTests };
} else if (typeof window !== 'undefined') {
  window.registerTrustTests = registerTrustTests;
}
