/**
 * Encryption Tests
 * Comprehensive test suite for MemoryFile encryption functionality
 */

// Test Suite Setup
function createEncryptionTestSuite() {
  const suite = {
    name: 'Encryption Tests',
    tests: [],
    categories: []
  };

  // Category: Basic Encryption
  suite.categories.push({
    name: 'Basic Encryption',
    tests: [
      {
        name: 'Encryption enabled by default',
        async run() {
          const mf = new MemoryFile();
          assert(mf.isEncrypted() === true, 'Encryption should be enabled by default');
        }
      },
      {
        name: 'Can disable encryption explicitly',
        async run() {
          const mf = new MemoryFile({ encrypted: false });
          assert(mf.isEncrypted() === false, 'Encryption should be disabled when set to false');
        }
      },
      {
        name: 'Password required for encrypted database',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase('CREATE TABLE test (id INTEGER)');
          
          // Encrypt data
          const exportedDb = mf.exportDatabase();
          const encrypted = await mf.encryptData(exportedDb, 'testpass123');
          
          assert(encrypted.length > exportedDb.length, 'Encrypted data should be larger (includes metadata)');
          assert(encrypted[0] === 1, 'First byte should be version number');
        }
      },
      {
        name: 'Encryption adds salt and IV',
        async run() {
          const mf = new MemoryFile();
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3, 4, 5]);
          const encrypted = await mf.encryptData(data, 'password');
          
          // Format: version(1) + salt(16) + iv(12) + encrypted data
          assert(encrypted.length >= 29, 'Encrypted data should include version, salt, and IV');
          assert(encrypted[0] === 1, 'Version should be 1');
        }
      },
      {
        name: 'Decryption with correct password succeeds',
        async run() {
          const mf = new MemoryFile();
          await mf.initSQL();
          await mf.createDatabase();
          
          const originalData = new Uint8Array([10, 20, 30, 40, 50]);
          const password = 'correct-password';
          
          const encrypted = await mf.encryptData(originalData, password);
          const decrypted = await mf.decryptData(encrypted, password);
          
          assert(decrypted.length === originalData.length, 'Decrypted length should match original');
          assert(arraysEqual(decrypted, originalData), 'Decrypted data should match original');
        }
      },
      {
        name: 'Decryption with wrong password fails',
        async run() {
          const mf = new MemoryFile();
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          const encrypted = await mf.encryptData(data, 'correct');
          
          try {
            await mf.decryptData(encrypted, 'wrong');
            throw new Error('Should have thrown error');
          } catch (error) {
            assert(error.message.includes('Decryption failed'), 'Should throw decryption error');
          }
        }
      }
    ]
  });

  // Category: Database Encryption
  suite.categories.push({
    name: 'Database Encryption',
    tests: [
      {
        name: 'Create and save encrypted database',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase('CREATE TABLE users (id INTEGER, name TEXT)');
          
          mf.run('INSERT INTO users VALUES (?, ?)', [1, 'Alice']);
          mf.run('INSERT INTO users VALUES (?, ?)', [2, 'Bob']);
          
          const exportedDb = mf.exportDatabase();
          const encrypted = await mf.encryptData(exportedDb, 'pass123');
          
          assert(encrypted.length > 0, 'Encrypted database should have data');
          assert(encrypted[0] === 1, 'Should have version byte');
        }
      },
      {
        name: 'Encrypt and decrypt full database cycle',
        async run() {
          const password = 'secure-password-123';
          
          // Create and encrypt
          const mf1 = new MemoryFile({ encrypted: true });
          await mf1.initSQL();
          await mf1.createDatabase('CREATE TABLE notes (id INTEGER PRIMARY KEY, content TEXT)');
          
          mf1.run('INSERT INTO notes (content) VALUES (?)', ['Secret note 1']);
          mf1.run('INSERT INTO notes (content) VALUES (?)', ['Secret note 2']);
          
          const exported = mf1.exportDatabase();
          const encrypted = await mf1.encryptData(exported, password);
          
          // Decrypt and verify
          const mf2 = new MemoryFile({ encrypted: true });
          await mf2.initSQL();
          
          const decrypted = await mf2.decryptData(encrypted, password);
          mf2.db = new mf2.sqlJS.Database(decrypted);
          
          const results = mf2.exec('SELECT * FROM notes ORDER BY id');
          assert(results.length === 2, 'Should have 2 notes');
          assert(results[0].content === 'Secret note 1', 'First note should match');
          assert(results[1].content === 'Secret note 2', 'Second note should match');
        }
      },
      {
        name: 'Encrypted data is not readable as SQLite',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase('CREATE TABLE secret (data TEXT)');
          
          mf.run('INSERT INTO secret VALUES (?)', ['Top secret information']);
          
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, 'password');
          
          // Try to load encrypted data directly as SQLite (should fail)
          try {
            new mf.sqlJS.Database(encrypted);
            throw new Error('Should not be able to load encrypted data as database');
          } catch (error) {
            assert(error.message !== 'Should not be able to load encrypted data as database', 
              'Encrypted data should not be valid SQLite');
          }
        }
      },
      {
        name: 'Encryption metadata is stored correctly',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          await mf.encryptData(data, 'password');
          
          const metadata = mf.getEncryptionMetadata();
          assert(metadata !== null, 'Metadata should exist');
          assert(metadata.version === 1, 'Version should be 1');
          assert(metadata.algorithm === 'AES-GCM-256', 'Algorithm should be AES-GCM-256');
          assert(metadata.kdf === 'PBKDF2', 'KDF should be PBKDF2');
          assert(metadata.iterations === 100000, 'Should use 100k iterations');
        }
      }
    ]
  });

  // Category: Password Management
  suite.categories.push({
    name: 'Password Management',
    tests: [
      {
        name: 'Password stored after decryption',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          const encrypted = await mf.encryptData(data, 'mypass');
          
          // Simulate loading (password gets stored)
          mf.currentPassword = 'mypass';
          
          assert(mf.currentPassword === 'mypass', 'Password should be stored');
        }
      },
      {
        name: 'Change password updates stored password',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          mf.currentPassword = 'oldpass';
          
          mf.changePassword('newpass');
          
          assert(mf.currentPassword === 'newpass', 'Password should be updated');
        }
      },
      {
        name: 'Cannot change password when encryption disabled',
        async run() {
          const mf = new MemoryFile({ encrypted: false });
          
          try {
            mf.changePassword('newpass');
            throw new Error('Should have thrown error');
          } catch (error) {
            assert(error.message.includes('encryption is not enabled'), 
              'Should prevent password change when not encrypted');
          }
        }
      },
      {
        name: 'Cannot change to empty password',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          mf.currentPassword = 'oldpass';
          
          try {
            mf.changePassword('');
            throw new Error('Should have thrown error');
          } catch (error) {
            assert(error.message.includes('cannot be empty'), 
              'Should prevent empty password');
          }
        }
      },
      {
        name: 'Different passwords produce different ciphertexts',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3, 4, 5]);
          
          const encrypted1 = await mf.encryptData(data, 'password1');
          const encrypted2 = await mf.encryptData(data, 'password2');
          
          assert(!arraysEqual(encrypted1, encrypted2), 
            'Different passwords should produce different ciphertexts');
        }
      },
      {
        name: 'Same password with different salt produces different ciphertext',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3, 4, 5]);
          const password = 'same-password';
          
          const encrypted1 = await mf.encryptData(data, password);
          const encrypted2 = await mf.encryptData(data, password);
          
          // Salt is random, so ciphertexts should differ
          assert(!arraysEqual(encrypted1, encrypted2), 
            'Random salt should produce different ciphertexts');
          
          // But both should decrypt correctly
          const decrypted1 = await mf.decryptData(encrypted1, password);
          const decrypted2 = await mf.decryptData(encrypted2, password);
          
          assert(arraysEqual(decrypted1, data), 'First decryption should work');
          assert(arraysEqual(decrypted2, data), 'Second decryption should work');
        }
      }
    ]
  });

  // Category: Security Properties
  suite.categories.push({
    name: 'Security Properties',
    tests: [
      {
        name: 'PBKDF2 with 100k iterations',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          await mf.encryptData(data, 'password');
          
          const metadata = mf.getEncryptionMetadata();
          assert(metadata.iterations === 100000, 'Should use 100,000 iterations for PBKDF2');
        }
      },
      {
        name: 'AES-256-GCM authenticated encryption',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          await mf.encryptData(data, 'password');
          
          const metadata = mf.getEncryptionMetadata();
          assert(metadata.algorithm === 'AES-GCM-256', 'Should use AES-256-GCM');
        }
      },
      {
        name: 'Tampering detection via GCM authentication',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3, 4, 5]);
          const encrypted = await mf.encryptData(data, 'password');
          
          // Tamper with the ciphertext (after metadata)
          encrypted[40] ^= 1; // Flip a bit
          
          // Decryption should fail due to authentication tag mismatch
          try {
            await mf.decryptData(encrypted, 'password');
            throw new Error('Should have detected tampering');
          } catch (error) {
            assert(error.message.includes('Decryption failed'), 
              'GCM should detect tampering');
          }
        }
      },
      {
        name: 'Salt is randomly generated',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          
          const enc1 = await mf.encryptData(data, 'pass');
          const enc2 = await mf.encryptData(data, 'pass');
          
          // Extract salts (bytes 1-16)
          const salt1 = enc1.slice(1, 17);
          const salt2 = enc2.slice(1, 17);
          
          assert(!arraysEqual(salt1, salt2), 'Salts should be randomly generated');
        }
      },
      {
        name: 'IV is randomly generated',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          
          const enc1 = await mf.encryptData(data, 'pass');
          const enc2 = await mf.encryptData(data, 'pass');
          
          // Extract IVs (bytes 17-28)
          const iv1 = enc1.slice(17, 29);
          const iv2 = enc2.slice(17, 29);
          
          assert(!arraysEqual(iv1, iv2), 'IVs should be randomly generated');
        }
      },
      {
        name: 'Encrypted data size increases appropriately',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array(100);
          const encrypted = await mf.encryptData(data, 'password');
          
          // Overhead: version(1) + salt(16) + iv(12) + GCM tag(16) = 45 bytes
          const expectedMinSize = data.length + 45;
          assert(encrypted.length >= expectedMinSize, 
            `Encrypted size should be at least ${expectedMinSize} bytes`);
        }
      }
    ]
  });

  // Category: Real-World Scenarios
  suite.categories.push({
    name: 'Real-World Scenarios',
    tests: [
      {
        name: 'Medical records scenario',
        async run() {
          const password = 'HiPAA-Compl1ant-P@ssw0rd';
          
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase(`
            CREATE TABLE patient_records (
              id INTEGER PRIMARY KEY,
              name TEXT,
              diagnosis TEXT,
              treatment TEXT
            )
          `);
          
          mf.run('INSERT INTO patient_records VALUES (?, ?, ?, ?)', 
            [1, 'John Doe', 'Condition A', 'Treatment Plan X']);
          
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, password);
          
          // Verify encryption
          const encryptedStr = new TextDecoder().decode(encrypted.slice(29));
          assert(!encryptedStr.includes('John Doe'), 'Name should not be readable');
          assert(!encryptedStr.includes('Condition A'), 'Diagnosis should not be readable');
          
          // Verify decryption
          const decrypted = await mf.decryptData(encrypted, password);
          const mf2 = new MemoryFile({ encrypted: true });
          await mf2.initSQL();
          mf2.db = new mf2.sqlJS.Database(decrypted);
          
          const results = mf2.exec('SELECT * FROM patient_records WHERE id = 1');
          assert(results[0].name === 'John Doe', 'Should decrypt sensitive data correctly');
        }
      },
      {
        name: 'Legal contract scenario',
        async run() {
          const password = 'L3gal-$ecure-2024';
          
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase(`
            CREATE TABLE contracts (
              id INTEGER PRIMARY KEY,
              parties TEXT,
              terms TEXT,
              signature_date TEXT
            )
          `);
          
          mf.run('INSERT INTO contracts VALUES (?, ?, ?, ?)', 
            [1, 'Party A and Party B', 'Confidential terms...', '2024-01-01']);
          
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, password);
          
          // Verify can only be accessed with password
          try {
            await mf.decryptData(encrypted, 'wrong-password');
            throw new Error('Should not decrypt with wrong password');
          } catch (error) {
            assert(error.message.includes('Decryption failed'), 'Should protect contract');
          }
        }
      },
      {
        name: 'Password change on annual update',
        async run() {
          const oldPassword = 'SecurePass2023!';
          const newPassword = 'SecurePass2024!';
          
          // Create encrypted database
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase('CREATE TABLE annual_data (year INTEGER, data TEXT)');
          
          mf.run('INSERT INTO annual_data VALUES (?, ?)', [2023, 'Old data']);
          
          // Encrypt with old password
          let exported = mf.exportDatabase();
          let encrypted = await mf.encryptData(exported, oldPassword);
          
          // "One year later" - change password
          const decrypted = await mf.decryptData(encrypted, oldPassword);
          mf.db = new mf.sqlJS.Database(decrypted);
          
          // Add new data
          mf.run('INSERT INTO annual_data VALUES (?, ?)', [2024, 'New data']);
          
          // Re-encrypt with new password
          exported = mf.exportDatabase();
          encrypted = await mf.encryptData(exported, newPassword);
          
          // Verify old password no longer works
          try {
            await mf.decryptData(encrypted, oldPassword);
            throw new Error('Old password should not work');
          } catch (error) {
            assert(error.message.includes('Decryption failed'), 'Old password should fail');
          }
          
          // Verify new password works
          const finalDecrypted = await mf.decryptData(encrypted, newPassword);
          const mf2 = new MemoryFile({ encrypted: true });
          await mf2.initSQL();
          mf2.db = new mf2.sqlJS.Database(finalDecrypted);
          
          const results = mf2.exec('SELECT * FROM annual_data ORDER BY year');
          assert(results.length === 2, 'Should have both years of data');
          assert(results[1].year === 2024, 'Should have new data');
        }
      },
      {
        name: 'Large database encryption (10k rows)',
        async run() {
          const password = 'LargeDB-P@ssw0rd';
          
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase(`
            CREATE TABLE large_data (
              id INTEGER PRIMARY KEY,
              data TEXT,
              timestamp INTEGER
            )
          `);
          
          // Insert 10k rows
          const stmt = mf.prepare('INSERT INTO large_data (data, timestamp) VALUES (?, ?)');
          for (let i = 0; i < 10000; i++) {
            stmt.run([`Data row ${i}`, Date.now()]);
          }
          stmt.free();
          
          // Encrypt
          const start = performance.now();
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, password);
          const encryptTime = performance.now() - start;
          
          // Decrypt
          const decryptStart = performance.now();
          const decrypted = await mf.decryptData(encrypted, password);
          const decryptTime = performance.now() - decryptStart;
          
          // Verify
          const mf2 = new MemoryFile({ encrypted: true });
          await mf2.initSQL();
          mf2.db = new mf2.sqlJS.Database(decrypted);
          
          const count = mf2.exec('SELECT COUNT(*) as count FROM large_data')[0].count;
          assert(count === 10000, 'All rows should be preserved');
          
          // Performance check - should complete reasonably quickly
          assert(encryptTime < 5000, `Encryption took ${encryptTime}ms, should be < 5000ms`);
          assert(decryptTime < 5000, `Decryption took ${decryptTime}ms, should be < 5000ms`);
        }
      }
    ]
  });

  // Category: Edge Cases
  suite.categories.push({
    name: 'Edge Cases',
    tests: [
      {
        name: 'Empty database encryption',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, 'password');
          
          assert(encrypted.length > 29, 'Even empty DB should have encrypted metadata');
          
          const decrypted = await mf.decryptData(encrypted, 'password');
          const mf2 = new MemoryFile({ encrypted: true });
          await mf2.initSQL();
          mf2.db = new mf2.sqlJS.Database(decrypted);
          
          const tables = mf2.getTables();
          assert(tables.length === 0, 'Empty database should remain empty');
        }
      },
      {
        name: 'Very long password',
        async run() {
          const longPassword = 'a'.repeat(1000);
          
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase('CREATE TABLE test (id INTEGER)');
          
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, longPassword);
          const decrypted = await mf.decryptData(encrypted, longPassword);
          
          const mf2 = new MemoryFile({ encrypted: true });
          await mf2.initSQL();
          mf2.db = new mf2.sqlJS.Database(decrypted);
          
          const tables = mf2.getTables();
          assert(tables.includes('test'), 'Long password should work');
        }
      },
      {
        name: 'Special characters in password',
        async run() {
          const specialPass = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
          
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase('CREATE TABLE test (data TEXT)');
          mf.run('INSERT INTO test VALUES (?)', ['test data']);
          
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, specialPass);
          const decrypted = await mf.decryptData(encrypted, specialPass);
          
          const mf2 = new MemoryFile({ encrypted: true });
          await mf2.initSQL();
          mf2.db = new mf2.sqlJS.Database(decrypted);
          
          const results = mf2.exec('SELECT * FROM test');
          assert(results[0].data === 'test data', 'Special characters in password should work');
        }
      },
      {
        name: 'Unicode password support',
        async run() {
          const unicodePass = '密码🔒パスワード';
          
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase('CREATE TABLE test (id INTEGER)');
          
          const exported = mf.exportDatabase();
          const encrypted = await mf.encryptData(exported, unicodePass);
          const decrypted = await mf.decryptData(encrypted, unicodePass);
          
          assert(decrypted.length === exported.length, 'Unicode password should work');
        }
      },
      {
        name: 'Unsupported version number',
        async run() {
          const mf = new MemoryFile({ encrypted: true });
          await mf.initSQL();
          await mf.createDatabase();
          
          const data = new Uint8Array([1, 2, 3]);
          const encrypted = await mf.encryptData(data, 'password');
          
          // Change version to unsupported value
          encrypted[0] = 99;
          
          try {
            await mf.decryptData(encrypted, 'password');
            throw new Error('Should reject unsupported version');
          } catch (error) {
            assert(error.message.includes('Unsupported encryption version'), 
              'Should detect unsupported version');
          }
        }
      }
    ]
  });

  // Flatten all tests
  suite.tests = suite.categories.flatMap(cat => 
    cat.tests.map(test => ({
      ...test,
      category: cat.name
    }))
  );

  return suite;
}

// Helper function
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createEncryptionTestSuite };
}
