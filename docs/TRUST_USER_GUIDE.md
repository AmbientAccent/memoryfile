# Trust Badge User Guide

## What is the Trust Badge?

When you open a MemoryFile HTML document, you'll see a **trust badge** in the corner that tells you if the file is safe.

### What You'll See

#### ✓ VERIFIED (Green)
```
┌─────────────────────┐
│ ✓ VERIFIED          │
│ File integrity      │
│ confirmed           │
└─────────────────────┘
```

What this means: The file is authentic and hasn't been modified since it was created.

What to do: Safe to use. The file content matches its fingerprint.

---

#### ⚠ UNVERIFIED (Yellow)
```
┌─────────────────────┐
│ ⚠ UNVERIFIED        │
│ Cannot confirm      │
│ file integrity      │
└─────────────────────┘
```

What this means: We can't automatically verify this file. It might be fine, but we can't confirm.

What to do:
- Check who sent you the file
- Verify through another channel if important
- File may be legitimate but doesn't use verification system

---

#### ✗ TAMPERED (Red)
```
┌─────────────────────┐
│ ✗ TAMPERED          │
│ File has been       │
│ modified            │
│ DO NOT TRUST        │
└─────────────────────┘
```

What this means: The file has been changed since it was created. Someone modified the content.

What to do:
- DO NOT TRUST THIS FILE
- Do not enter sensitive information
- Contact the sender to get an authentic copy
- Report if this was unexpected

---

## How Does It Work?

### The Fingerprint System

Every file has a unique "fingerprint" (called a hash) that's like its DNA:

```
contract.a1b2c3d4.html
         ^^^^^^^^
         This is the fingerprint
```

How it works:
1. When the file is created, we calculate its fingerprint
2. We put the fingerprint in the filename
3. When you open the file, it checks: "Does my content match my fingerprint?"
4. The badge shows you the result

If anyone changes even one character:
- The fingerprint changes
- File shows TAMPERED
- You know it's been modified

### Example

Original file:
```
invoice.a1b2c3d4.html
        ^^^^^^^^
        Fingerprint matches content ✓
```

**If someone edits it:**
```
invoice.a1b2c3d4.html (filename unchanged)
        ^^^^^^^^
        But content changed!
        Fingerprint doesn't match ✗
```

The badge turns RED and says TAMPERED.

---

## Common Questions

### Q: What if the filename doesn't have a hash?

A: The badge will show UNVERIFIED. The file might be fine, but we can't automatically verify it.

Many older files or files from other systems won't have this verification system.

### Q: Can someone fake the verification?

**A:** They could modify the file AND change the filename, but:
1. The new filename would be different from what you expect
2. If multiple people have copies, the fingerprints won't match
3. For important documents, we can add digital signatures (even stronger)

### Q: Do I need to check the badge every time?

**A:** The badge shows automatically! Just glance at the corner:
- Green? Good! 🟢
- Yellow? Be careful 🟡
- Red? Don't trust! 🔴

### Q: What if I edit the file myself?

**A:** When you save changes, the file will get a new filename with a new fingerprint. That's normal! The old version and new version will have different fingerprints.

### Q: Can I verify the file myself?

**A:** Yes! Advanced users can:
1. Calculate the SHA-256 hash of the file
2. Compare the first 8 characters to the filename
3. If they match, the file is verified

Online tools: [SHA-256 Calculator](https://emn178.github.io/online-tools/sha256_checksum.html)

---

## Learning More

### Click the Badge

Click the trust badge to see:
- The full fingerprint (hash)
- How verification works
- Why it matters
- Copy the hash for your records

### The "Learn More" Button

Inside the expanded badge, click "Learn about verification →" to see:
- What content-addressed files are
- How to verify files
- What each badge status means
- Manual verification steps

---

## Best Practices

### When Receiving Files

1. **Check the badge** as soon as you open the file
2. **Verify the filename** if you know what to expect
3. **Contact sender** if you see TAMPERED
4. **Keep original copies** for comparison

### When Sharing Files

1. **Use the full filename** (including the hash)
2. **Tell recipients** to check for the green badge
3. **Provide hash separately** (email, message) if critical
4. **Use digital signatures** for legal documents

### When Working with Important Documents

1. **Always check verification** before signing or acting
2. **Keep verified copies** as backups
3. **Share fingerprints** through multiple channels
4. **Report tampering** immediately

---

## Real-World Scenarios

### Scenario 1: Contract from Business Partner

You receive: `contract.a1b2c3d4.html`

Badge shows: VERIFIED

What to do: Safe to review and sign. The contract is authentic.

---

### Scenario 2: Invoice Looks Wrong

You receive: `invoice.x9y8z7w6.html`

Badge shows: TAMPERED

What to do:
- DO NOT PAY
- Contact sender: "I received a tampered file"
- Request a verified copy
- Report to your security team

---

### Scenario 3: Old Medical Record

You receive: `medical-record.html` (no hash in filename)

Badge shows: UNVERIFIED

What to do:
- File might be legitimate
- Verify through other means (call doctor's office)
- For future records, request verified files

---

### Scenario 4: Multiple Copies Don't Match

**You have:**
- Copy from email: `report.a1b2c3d4.html` ✓ VERIFIED
- Copy from colleague: `report.f3e2d1c0.html` ✓ VERIFIED

**What this means:**
- Both files are valid
- But they're different versions!
- The hashes prove they contain different content

**What to do:**
- Compare creation dates
- Ask which is the correct version
- Use the hash to identify specific versions

---

## Technical Details (Optional)

### What is SHA-256?

SHA-256 is a mathematical function that creates a unique fingerprint for any file:
- Input: File content (any size)
- Output: 64-character fingerprint (always same size)
- Change one byte → Completely different fingerprint
- Impossible to reverse (can't recreate file from fingerprint)

### Why 8 Characters?

The full fingerprint is 64 characters, but we use the first 8 for filenames:
- Shorter, more manageable
- Still 4.3 billion possible combinations
- Collision (two files with same 8-char hash) is extremely unlikely

For important documents, you can check the full 64-character hash by clicking the badge.

### Content-Addressed Files

This concept comes from systems like:
- **Git** (version control for code)
- **IPFS** (distributed file system)
- **Bitcoin** (blockchain technology)

The idea: The filename IS the content fingerprint. Can't fake it without breaking the match.

---

## Trust Badge Anatomy

### Compact View (Default)

```
┌─────────────────────┐
│ ✓ VERIFIED       ⓘ │  ← Click to expand
└─────────────────────┘
```

### Expanded View

```
┌─────────────────────────────────┐
│ ✓ VERIFIED                   ✕ │  ← Click to collapse
├─────────────────────────────────┤
│ Status: File integrity confirmed│
│ Hash: a1b2c3d4 📋              │  ← Click to copy
│ Method: Content-addressed       │
│                                 │
│ [ Learn about verification → ] │
└─────────────────────────────────┘
```

### Elements

- Icon (✓, ⚠, ✗) - Quick visual status
- Status Text - What this means
- ⓘ Button - Click to expand/collapse
- Hash Display - The fingerprint
- Copy Button - Copy hash to clipboard
- Learn More Button - Educational modal

---

## Accessibility

The trust badge is designed to be accessible:

- Keyboard Navigation - Tab to badge, Enter to expand
- Screen Readers - Proper ARIA labels
- Color + Text - Not relying on color alone
- High Contrast - Visible in all modes

---

## Mobile Experience

On mobile devices:
- Badge appears in corner (doesn't block content)
- Tap to expand
- Swipe to close educational modal
- Responsive sizing

---

## Privacy

The verification system:
- Works entirely in your browser
- No data sent to servers
- No tracking or analytics
- Completely offline capable
- Open source and transparent

---

## Getting Help

If you're unsure about a file's verification status:

1. Contact the sender - Ask about the expected filename/hash
2. Check documentation - Many organizations publish file hashes
3. Use multiple sources - If available, compare files from different sources
4. When in doubt, don't trust - Better safe than sorry

---

## Summary

**Quick Reference Card:**

| Badge | Color | Meaning | Action |
|-------|-------|---------|--------|
| ✓ VERIFIED | Green | File is safe | Use normally |
| ⚠ UNVERIFIED | Yellow | Can't confirm | Verify separately |
| ✗ TAMPERED | Red | File modified | DO NOT TRUST |

**Remember:**
- Green badge = Safe to use
- Always check the badge when opening files
- Report tampering to sender
- For important documents, copy the hash for records

---

**Questions?** Click the badge and select "Learn more" for interactive education.

**Trust your files. Verify everything.** 🔒
