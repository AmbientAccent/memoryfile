/**
 * MemoryFile Core Library
 * Create self-persistent HTML files with embedded SQLite databases
 * Your files remember everything.
 */

class MemoryFile {
  constructor(options = {}) {
    this.db = null;
    this.sqlJS = null;
    this.options = {
      embedId: options.embedId || 'embedded-db',
      autoSave: options.autoSave || false,
      compression: options.compression || false,
      encrypted: options.encrypted !== false, // Enabled by default
      ...options
    };
    this.currentPassword = null; // Store for re-encryption
    this.encryptionMetadata = null; // Store metadata for display
  }

  /**
   * Initialize SQLite WASM
   */
  async initSQL(config = {}) {
    if (this.sqlJS) return this.sqlJS;
    
    try {
      // Check if initSqlJs is available globally
      if (typeof initSqlJs === 'undefined') {
        throw new Error('SQLite WASM not loaded. Include sql-wasm.js first.');
      }
      
      this.sqlJS = await initSqlJs({
        locateFile: file => config.locateFile ? config.locateFile(file) : `./lib/${file}`
      });
      
      return this.sqlJS;
    } catch (error) {
      throw new Error(`Failed to initialize SQLite: ${error.message}`);
    }
  }

  /**
   * Load database from embedded script tag
   * @param {string} password - Password for encrypted databases
   */
  async loadEmbeddedDatabase(password = null) {
    if (!this.sqlJS) {
      await this.initSQL();
    }

    const dbScript = document.getElementById(this.options.embedId);
    if (!dbScript) {
      throw new Error(`No embedded database found with id: ${this.options.embedId}`);
    }

    const base64Data = dbScript.textContent.trim();
    
    if (!base64Data || base64Data.length === 0) {
      this.db = new this.sqlJS.Database();
      
      if (this.options.encrypted && password) {
        this.currentPassword = password;
      }
      
      return this.db;
    }

    try {
      let binaryData = this.base64ToUint8Array(base64Data);
      
      if (this.options.encrypted && this.isEncryptedData(binaryData)) {
        if (!password) {
          throw new Error('Password required: This database is encrypted');
        }
        
        binaryData = await this.decryptData(binaryData, password);
        this.currentPassword = password;
      }
      
      // Decompress if needed
      const finalData = this.options.compression 
        ? await this.decompress(binaryData)
        : binaryData;
      
      this.db = new this.sqlJS.Database(finalData);
      return this.db;
    } catch (error) {
      throw new Error(`Failed to load database: ${error.message}`);
    }
  }

  /**
   * Create a new empty database
   */
  async createDatabase(schema = null) {
    if (!this.sqlJS) {
      await this.initSQL();
    }

    this.db = new this.sqlJS.Database();

    if (schema) {
      // Execute schema SQL
      this.db.run(schema);
    }

    return this.db;
  }

  /**
   * Execute SQL query
   * Returns array of row objects: [{col1: val1, col2: val2}, ...]
   */
  exec(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized. Call loadEmbeddedDatabase() or createDatabase() first.');
    }

    try {
      if (params.length > 0) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const result = [];
        while (stmt.step()) {
          result.push(stmt.getAsObject());
        }
        stmt.free();
        return result;
      } else {
        // Normalize format: convert db.exec() result to array of objects
        const rawResult = this.db.exec(sql);
        if (!rawResult || rawResult.length === 0) {
          return [];
        }
        
        const { columns, values } = rawResult[0];
        return values.map(row => {
          const obj = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
      }
    } catch (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  /**
   * Run SQL statement (for INSERT, UPDATE, DELETE)
   */
  run(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      this.db.run(sql, params);
      
      if (this.options.autoSave) {
        this.saveToFile().catch(err => console.error('Auto-save failed:', err));
      }
    } catch (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  /**
   * Prepare a statement for multiple executions
   */
  prepare(sql) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return this.db.prepare(sql);
  }

  /**
   * Export database to binary array
   */
  exportDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db.export();
  }

  /**
   * Save database back to the HTML file
   * @param {string} filename - Filename to save as
   * @param {string} password - Password for encryption (uses current if not specified)
   * @param {boolean} changePassword - Whether this is a password change
   */
  async saveToFile(filename = 'app.html', password = null, changePassword = false) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Export database
      let exportedDb = this.db.export();
      
      // Compress if enabled
      if (this.options.compression) {
        exportedDb = await this.compress(exportedDb);
      }
      
      let finalData = exportedDb;
      const encryptPassword = password || this.currentPassword;
      
      if (this.options.encrypted) {
        if (!encryptPassword) {
          throw new Error('Password required: Encryption is enabled but no password provided');
        }
        
        finalData = await this.encryptData(exportedDb, encryptPassword);
      }
      
      const base64Db = this.uint8ArrayToBase64(finalData);
      const htmlContent = this.rebuildHTML(base64Db);
      
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'HTML Files',
              accept: { 'text/html': ['.html'] }
            }]
          });
          
          const writable = await handle.createWritable();
          await writable.write(htmlContent);
          await writable.close();
          
          if (changePassword && password) {
            this.currentPassword = password;
          }
          
          return { 
            success: true, 
            method: 'file-system-access',
            encrypted: this.options.encrypted,
            passwordChanged: changePassword && !!password
          };
        } catch (err) {
          if (err.name === 'AbortError') {
            return { success: false, cancelled: true };
          }
          throw err;
        }
      } else {
        this.fallbackDownload(htmlContent, filename);
        
        if (changePassword && password) {
          this.currentPassword = password;
        }
        
        return { 
          success: true, 
          method: 'download',
          encrypted: this.options.encrypted,
          passwordChanged: changePassword && !!password
        };
      }
    } catch (error) {
      throw new Error(`Save failed: ${error.message}`);
    }
  }

  /**
   * Rebuild the HTML file with updated database
   */
  rebuildHTML(base64Db) {
    let htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    
    // Replace the embedded database
    const regex = new RegExp(
      `(<script[^>]*id="${this.options.embedId}"[^>]*>)([\\s\\S]*?)(<\\/script>)`,
      'i'
    );
    
    htmlContent = htmlContent.replace(regex, `$1\n${base64Db}\n$3`);
    
    return htmlContent;
  }

  /**
   * Fallback download for browsers without File System Access API
   */
  fallbackDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  base64ToUint8Array(base64) {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      throw new Error('Invalid base64 data');
    }
  }

  /**
   * Convert Uint8Array to base64 string
   */
  uint8ArrayToBase64(uint8Array) {
    let binaryString = '';
    const chunkSize = 0x8000; // Process in chunks to avoid call stack size exceeded
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binaryString);
  }

  /**
   * Compress data using gzip (requires pako library)
   */
  async compress(data) {
    if (typeof pako === 'undefined') {
      console.warn('Compression enabled but pako library not loaded. Skipping compression.');
      return data;
    }
    
    return pako.gzip(data);
  }

  /**
   * Decompress data using gzip (requires pako library)
   */
  async decompress(data) {
    if (typeof pako === 'undefined') {
      throw new Error('Decompression failed: pako library not loaded');
    }
    
    return pako.ungzip(data);
  }

  /**
   * Check if data appears to be encrypted
   * Validates minimum length, version byte, and excludes SQLite files
   */
  isEncryptedData(data) {
    if (!data || data.length < 29) {
      return false;
    }
    
    if (data[0] !== 1) {
      return false;
    }
    
    // SQLite databases start with "SQLite format 3\0" signature
    // If present, data is definitely not encrypted
    if (data.length >= 16 && 
        data[0] === 0x53 && data[1] === 0x51 && data[2] === 0x4C) {
      return false;
    }
    
    return true;
  }

  /**
   * Derive encryption key from password using PBKDF2
   * Requires Web Crypto API (HTTPS or modern browser)
   */
  async deriveKey(password, salt) {
    if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
      throw new Error('Web Crypto API not available. Encryption requires HTTPS or a modern browser.');
    }
    
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data with AES-256-GCM
   * @param {Uint8Array} data - Data to encrypt
   * @param {string} password - Password for key derivation
   * @returns {Promise<Uint8Array>} Encrypted data with metadata
   */
  async encryptData(data, password) {
    if (!data || !(data instanceof Uint8Array)) {
      throw new Error('Data must be a Uint8Array');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }
    
    // Generate salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from password
    const key = await this.deriveKey(password, salt);
    
    // Encrypt data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Create metadata
    const metadata = {
      version: 1,
      algorithm: 'AES-GCM-256',
      kdf: 'PBKDF2',
      iterations: 100000,
      timestamp: new Date().toISOString()
    };
    
    // Store metadata for later display
    this.encryptionMetadata = metadata;
    
    // Format: version(1 byte)|salt(16 bytes)|iv(12 bytes)|encryptedData
    const result = new Uint8Array(1 + 16 + 12 + encrypted.byteLength);
    result[0] = metadata.version;
    result.set(salt, 1);
    result.set(iv, 17);
    result.set(new Uint8Array(encrypted), 29);
    
    return result;
  }

  /**
   * Decrypt data with AES-256-GCM
   * @param {Uint8Array} encryptedData - Encrypted data with format: version|salt|iv|ciphertext
   * @param {string} password - Password for key derivation
   * @returns {Promise<Uint8Array>} Decrypted data
   */
  async decryptData(encryptedData, password) {
    if (!encryptedData || !(encryptedData instanceof Uint8Array)) {
      throw new Error('Encrypted data must be a Uint8Array');
    }
    if (encryptedData.length < 29) {
      throw new Error('Invalid encrypted data: insufficient length (minimum 29 bytes required)');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }
    
    const version = encryptedData[0];
    if (version !== 1) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }
    
    const salt = encryptedData.slice(1, 17);
    const iv = encryptedData.slice(17, 29);
    const ciphertext = encryptedData.slice(29);
    
    const key = await this.deriveKey(password, salt);
    
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
      );
      
      this.encryptionMetadata = {
        version: version,
        algorithm: 'AES-GCM-256',
        kdf: 'PBKDF2',
        iterations: 100000
      };
      
      return new Uint8Array(decrypted);
    } catch (error) {
      throw new Error('Decryption failed: incorrect password or corrupted data');
    }
  }

  /**
   * Get database size in bytes
   */
  getDatabaseSize() {
    if (!this.db) {
      return 0;
    }
    
    const exported = this.db.export();
    return exported.length;
  }

  /**
   * Get database size as base64 (including overhead)
   */
  getBase64Size() {
    const dbSize = this.getDatabaseSize();
    return Math.ceil(dbSize * 4 / 3); // Base64 adds ~33% overhead
  }

  /**
   * Get all tables in the database
   */
  getTables() {
    if (!this.db) {
      return [];
    }

    const result = this.db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => row[0]);
  }

  /**
   * Get table schema
   */
  getTableSchema(tableName) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const result = this.db.exec(`PRAGMA table_info(${tableName})`);
    
    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => ({
      cid: row[0],
      name: row[1],
      type: row[2],
      notNull: row[3] === 1,
      defaultValue: row[4],
      primaryKey: row[5] === 1
    }));
  }

  /**
   * Get database version
   */
  getVersion() {
    if (!this.db) {
      return 0;
    }

    const result = this.db.exec('PRAGMA user_version');
    return result[0]?.values[0][0] || 0;
  }

  /**
   * Set database version
   */
  setVersion(version) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.run(`PRAGMA user_version = ${parseInt(version)}`);
  }

  /**
   * Close database and free resources
   * Clears sensitive data from memory (best effort - JavaScript cannot guarantee memory wipe)
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    this.currentPassword = null;
    this.encryptionMetadata = null;
  }

  /**
   * Check if browser supports File System Access API
   */
  static supportsFileSystemAccess() {
    return 'showSaveFilePicker' in window;
  }

  /**
   * Check if browser supports OPFS
   */
  static async supportsOPFS() {
    try {
      const root = await navigator.storage.getDirectory();
      return !!root;
    } catch {
      return false;
    }
  }

  /**
   * Get browser compatibility info
   */
  static async getBrowserSupport() {
    return {
      fileSystemAccess: this.supportsFileSystemAccess(),
      opfs: await this.supportsOPFS(),
      webAssembly: typeof WebAssembly !== 'undefined',
      localStorage: typeof localStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      webCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
    };
  }

  /**
   * Check if encryption is enabled
   */
  isEncrypted() {
    return this.options.encrypted === true;
  }

  /**
   * Get encryption metadata
   */
  getEncryptionMetadata() {
    return this.encryptionMetadata;
  }

  /**
   * Change password (will take effect on next save)
   * @param {string} newPassword - New password to use for encryption
   */
  changePassword(newPassword) {
    if (!this.options.encrypted) {
      throw new Error('Cannot change password: encryption is not enabled');
    }
    
    if (typeof newPassword !== 'string') {
      throw new Error('New password must be a string');
    }
    
    if (newPassword.length === 0) {
      throw new Error('New password cannot be empty');
    }
    
    this.currentPassword = newPassword;
  }
}

// Export for use in tests and applications
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoryFile;
}

// Keep legacy name for backwards compatibility (internal use only)
if (typeof window !== 'undefined') {
  window.HTMLSQLiteFusion = MemoryFile; // Internal alias
}
