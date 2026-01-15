/**
 * TrustManager - Integrity verification and trust badge system
 * for HTML-SQLite Fusion files
 */

class TrustManager {
  constructor(config = {}) {
    this.config = {
      hashLength: config.hashLength || 6,
      autoVerify: config.autoVerify !== false,
      showBadge: config.showBadge !== false,
      badgePosition: config.badgePosition || "top-right",
      educationMode: config.educationMode !== false,
      onVerificationComplete: config.onVerificationComplete || null,
      excludeSelectors: config.excludeSelectors || [
        "#trust-badge",
        ".trust-modal",
      ],
      showEncryption: config.showEncryption !== false,
      ...config,
    };

    this.verificationResult = null;
    this.badgeElement = null;
    this.encryptionStatus = null;

    if (this.config.autoVerify) {
      // Run verification after page loads
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.verify());
      } else {
        this.verify();
      }
    }
  }

  /**
   * Set encryption status (called by MemoryFile)
   */
  setEncryptionStatus(encrypted, metadata = null) {
    this.encryptionStatus = {
      encrypted: encrypted,
      metadata: metadata,
    };

    // Update badge if already rendered
    if (this.badgeElement && this.config.showBadge) {
      this.renderBadge();
    }
  }

  /**
   * Verify file integrity by comparing content hash to filename
   */
  async verify() {
    try {
      const filename = this.getFilename();
      const expectedHash = this.extractHashFromFilename(filename);

      if (!expectedHash) {
        this.verificationResult = {
          status: "UNVERIFIED",
          reason: "No hash found in filename",
          filename: filename,
        };
      } else {
        const htmlContent = this.getHTMLContent();
        const actualHash = await this.generateContentHash(htmlContent);

        if (actualHash.startsWith(expectedHash)) {
          this.verificationResult = {
            status: "VERIFIED",
            hash: expectedHash,
            fullHash: actualHash,
            filename: filename,
          };
        } else {
          this.verificationResult = {
            status: "TAMPERED",
            expected: expectedHash,
            actual: actualHash.slice(0, expectedHash.length),
            fullExpected: expectedHash,
            fullActual: actualHash,
            filename: filename,
          };
        }
      }

      if (this.config.showBadge) {
        this.renderBadge();
      }

      if (this.config.onVerificationComplete) {
        this.config.onVerificationComplete(this.verificationResult);
      }

      return this.verificationResult;
    } catch (error) {
      console.error("Trust verification error:", error);
      this.verificationResult = {
        status: "UNVERIFIED",
        reason: "Verification error: " + error.message,
      };
      return this.verificationResult;
    }
  }

  /**
   * Generate SHA-256 hash of HTML content (excluding dynamic elements)
   */
  async generateContentHash(htmlContent) {
    // Normalize content before hashing
    const normalized = this.normalizeHTML(htmlContent);

    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hashHex;
  }

  /**
   * Normalize HTML by removing dynamic elements before hashing
   */
  normalizeHTML(html) {
    let normalized = html;

    // Remove trust badge (it's added dynamically)
    for (const selector of this.config.excludeSelectors) {
      const regex = new RegExp(
        `<[^>]*id="${selector.replace("#", "")}"[^>]*>[\\s\\S]*?</[^>]+>`,
        "gi"
      );
      normalized = normalized.replace(regex, "");
    }

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  }

  /**
   * Get current filename from various sources
   */
  getFilename() {
    // Try meta tag first (most reliable)
    const metaFilename = document.querySelector('meta[name="filename"]');
    if (metaFilename) {
      return metaFilename.content;
    }

    // Try window.location for file:// protocol
    if (window.location.protocol === "file:") {
      const path = window.location.pathname;
      return decodeURIComponent(path.substring(path.lastIndexOf("/") + 1));
    }

    // Try document.title as fallback
    if (document.title && document.title.endsWith(".html")) {
      return document.title;
    }

    // Return URL-based name
    return window.location.pathname.split("/").pop() || "unknown.html";
  }

  /**
   * Extract hash from content-addressed filename
   */
  extractHashFromFilename(filename) {
    // Match: basename.{hash}.html where hash is 6-64 hex chars
    const match = filename.match(/\.([a-f0-9]{6,64})\.html$/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Get HTML content for hashing
   */
  getHTMLContent() {
    return document.documentElement.outerHTML;
  }

  /**
   * Render trust badge
   */
  renderBadge() {
    // Remove existing badge if present
    const existing = document.getElementById("trust-badge");
    if (existing) {
      existing.remove();
    }

    this.badgeElement = this.createBadgeElement(this.verificationResult);
    document.body.appendChild(this.badgeElement);

    // Add event listeners
    this.attachBadgeListeners();
  }

  /**
   * Create badge DOM element
   */
  createBadgeElement(result) {
    const badge = document.createElement("div");
    badge.id = "trust-badge";
    badge.className = `trust-badge trust-${result.status.toLowerCase()}`;
    badge.setAttribute("data-position", this.config.badgePosition);

    const { icon, statusText, details } = this.getBadgeContent(result);

    badge.innerHTML = `
      <div class="trust-badge-header">
        <span class="trust-icon">${icon}</span>
        <span class="trust-status">${statusText}</span>
        <button class="trust-expand" aria-label="Expand details" title="Show details">ⓘ</button>
      </div>
      <div class="trust-details" hidden>
        ${details}
      </div>
    `;

    return badge;
  }

  /**
   * Get badge content based on verification result
   */
  getBadgeContent(result) {
    const encryptionDetails =
      this.config.showEncryption && this.encryptionStatus
        ? this.getEncryptionDetails()
        : "";

    const statusMap = {
      VERIFIED: {
        icon: "✓",
        statusText: "VERIFIED",
        getDetails: (r) => `
          <div class="trust-detail-item">
            <strong>Status:</strong> File integrity confirmed
          </div>
          ${encryptionDetails}
          <div class="trust-detail-item">
            <strong>Hash:</strong><br>
            <code class="trust-hash" title="${r.fullHash || r.hash}">${
          r.hash
        }</code>
            <button class="trust-copy" data-copy="${
              r.fullHash || r.hash
            }" title="Copy full hash">📋</button>
          </div>
          <div class="trust-detail-item">
            <strong>Filename:</strong><br>
            <small>${this.escapeHtml(r.filename)}</small>
          </div>
          ${
            this.config.educationMode
              ? '<button class="trust-learn-more">Learn about verification →</button>'
              : ""
          }
        `,
      },
      SIGNED: {
        icon: "🔒",
        statusText: "SIGNED",
        getDetails: (r) => `
          <div class="trust-detail-item">
            <strong>Status:</strong> Cryptographically signed
          </div>
          <div class="trust-detail-item">
            <strong>Signature:</strong> Valid ✓
          </div>
          ${
            this.config.educationMode
              ? '<button class="trust-learn-more">Learn about signatures →</button>'
              : ""
          }
        `,
      },
      TIMESTAMPED: {
        icon: "⏰",
        statusText: "TIMESTAMPED",
        getDetails: (r) => `
          <div class="trust-detail-item">
            <strong>Status:</strong> Blockchain timestamp verified
          </div>
          ${
            this.config.educationMode
              ? '<button class="trust-learn-more">Learn about timestamping →</button>'
              : ""
          }
        `,
      },
      UNVERIFIED: {
        icon: "⚠",
        statusText: "UNVERIFIED",
        getDetails: (r) => `
          <div class="trust-detail-item">
            <strong>Status:</strong> Cannot confirm file integrity
          </div>
          <div class="trust-detail-item">
            <strong>Reason:</strong> ${r.reason}
          </div>
          <div class="trust-detail-item">
            <small>This file may be legitimate, but we cannot verify it automatically. Content-addressed filenames enable verification.</small>
          </div>
          ${
            this.config.educationMode
              ? '<button class="trust-learn-more">Learn about verification →</button>'
              : ""
          }
        `,
      },
      TAMPERED: {
        icon: "✗",
        statusText: "TAMPERED",
        getDetails: (r) => `
          <div class="trust-detail-item">
            <strong>⚠️ WARNING:</strong> File has been modified
          </div>
          <div class="trust-detail-item">
            <strong>Expected:</strong> <code>${r.expected}</code><br>
            <strong>Actual:</strong> <code>${r.actual}</code>
          </div>
          <div class="trust-detail-item">
            <strong style="color: #fee;">DO NOT TRUST THIS FILE</strong><br>
            <small>The content has been changed since it was created. This file may contain malicious modifications.</small>
          </div>
          ${
            this.config.educationMode
              ? '<button class="trust-learn-more">Why does this matter? →</button>'
              : ""
          }
        `,
      },
    };

    const config = statusMap[result.status] || statusMap["UNVERIFIED"];
    return {
      icon: config.icon,
      statusText: config.statusText,
      details: config.getDetails(result),
    };
  }

  /**
   * Attach event listeners to badge
   */
  attachBadgeListeners() {
    const badge = this.badgeElement;
    if (!badge) return;

    // Toggle expansion
    const header = badge.querySelector(".trust-badge-header");
    const expandBtn = badge.querySelector(".trust-expand");
    const details = badge.querySelector(".trust-details");

    const toggleExpand = () => {
      const isExpanded = !details.hidden;
      details.hidden = isExpanded;
      badge.classList.toggle("expanded", !isExpanded);
      expandBtn.textContent = isExpanded ? "ⓘ" : "✕";
    };

    header.addEventListener("click", toggleExpand);

    // Copy hash
    const copyBtn = badge.querySelector(".trust-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = copyBtn.getAttribute("data-copy");
        navigator.clipboard.writeText(text).then(() => {
          const original = copyBtn.textContent;
          copyBtn.textContent = "✓";
          setTimeout(() => {
            copyBtn.textContent = original;
          }, 1000);
        });
      });
    }

    // Learn more
    const learnBtn = badge.querySelector(".trust-learn-more");
    if (learnBtn) {
      learnBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showEducationModal();
      });
    }
  }

  /**
   * Show education modal
   */
  showEducationModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById("trust-education-modal");
    if (!modal) {
      modal = this.createEducationModal();
      document.body.appendChild(modal);
    }

    modal.style.display = "flex";

    // Close on overlay click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });

    // Close button
    const closeBtn = modal.querySelector(".trust-education-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }
  }

  /**
   * Create education modal
   */
  createEducationModal() {
    const modal = document.createElement("div");
    modal.id = "trust-education-modal";
    modal.className = "trust-modal";
    modal.innerHTML = `
      <div class="trust-modal-content">
        <h2>🔒 Why File Verification Matters</h2>
        
        <div class="trust-education-section">
          <h3>What is a content-addressed file?</h3>
          <p>
            The filename includes a unique "fingerprint" (hash) of the file's content.
            If anyone modifies the file, the fingerprint changes, making tampering obvious.
          </p>
          <div class="trust-education-example">
            <code>contract.a1b2c3.html</code>
            <span class="trust-education-arrow">→</span>
            <code class="trust-education-hash">a1b2c3</code> = fingerprint
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
            <li><span class="trust-badge-mini trust-unverified">⚠ UNVERIFIED</span> - Cannot confirm integrity (not necessarily bad)</li>
            <li><span class="trust-badge-mini trust-tampered">✗ TAMPERED</span> - File has been modified (dangerous!)</li>
          </ul>
        </div>
        
        <button class="trust-education-close">Got it!</button>
      </div>
    `;
    return modal;
  }

  /**
   * Generate content-addressed filename for commit
   */
  async generateCommitFilename(basename, htmlContent) {
    const hash = await this.generateContentHash(htmlContent);
    const shortHash = hash.slice(0, this.config.hashLength);
    return `${basename}.${shortHash}.html`;
  }

  /**
   * Export verification proof
   */
  exportVerificationProof() {
    return {
      timestamp: new Date().toISOString(),
      filename: this.getFilename(),
      result: this.verificationResult,
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Get encryption details for badge
   */
  getEncryptionDetails() {
    if (!this.encryptionStatus) {
      return "";
    }

    if (this.encryptionStatus.encrypted) {
      const metadata = this.encryptionStatus.metadata;
      return `
        <div class="trust-detail-item trust-encryption-status">
          <strong>🔒 Encryption:</strong> Enabled
          ${
            metadata
              ? `
            <div style="margin-top: 8px; font-size: 12px; color: #7f8c8d;">
              <div>Algorithm: ${metadata.algorithm}</div>
              <div>Key Derivation: ${
                metadata.kdf
              } (${metadata.iterations.toLocaleString()} iterations)</div>
            </div>
          `
              : ""
          }
        </div>
      `;
    } else {
      return `
        <div class="trust-detail-item trust-encryption-warning" style="background: #fff3cd; padding: 8px; border-radius: 4px; margin: 8px 0;">
          <strong style="color: #856404;">⚠️ Encryption: Disabled</strong>
          <div style="font-size: 12px; color: #856404; margin-top: 4px;">
            This file is not encrypted. Data is readable by anyone with file access.
          </div>
        </div>
      `;
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export for both module and global usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = TrustManager;
}
if (typeof window !== "undefined") {
  window.TrustManager = TrustManager;
}
