# HTML Commits Architecture

## Vision
Transform the browser's file save limitation into a **git-like commit system** where each HTML file is a complete, versioned snapshot with embedded commit history.

## Core Concepts

### 1. Commits, Not Saves
- Every "save" operation is a **commit** with a message
- Creates a new versioned HTML file (immutable history)
- Original file remains unchanged (non-destructive)
- Each file is fully self-contained and executable

### 2. Embedded Version Control
Each HTML file contains:
```html
<script id="commit-metadata" type="application/json">
{
  "commitHash": "a1b2c3d4",
  "parentHash": "z9y8x7w6",
  "commitMessage": "Added signature section",
  "commitAuthor": "user@example.com",
  "commitDate": "2026-01-13T05:37:00Z",
  "appVersion": "1.0.0",
  "commitType": "signed"
}
</script>

<script id="embedded-db" type="application/x-sqlite3">
  <!-- Base64 encoded SQLite database -->
</script>
```

### 3. Naming Conventions (Framework Level)
The framework provides flexible naming patterns:

```javascript
// Default pattern
"{basename}.{commitHash}.html"
// Example: contract.a1b2c3d4.html

// Timestamp pattern
"{basename}.{timestamp}.html"
// Example: contract.20260113-053700.html

// Semantic pattern (app-specific)
"{basename}.{commitType}-{date}.html"
// Example: contract.signed-2026-01-13.html
```

### 4. Application-Specific Customization
Apps built on the framework can define their own commit types:

Contract App:
```javascript
commitTypes: {
  'draft': (base) => `${base}.draft-${shortDate()}.html`,
  'signed': (base) => `${base}.signed-${shortDate()}.html`,
  'executed': (base) => `${base}.executed-${shortDate()}.html`
}
```

Notes App:
```javascript
commitTypes: {
  'save': (base) => `${base}.${shortHash()}.html`,
  'backup': (base) => `${base}.backup-${timestamp()}.html`
}
```

Deal Tracker (DoDealDone):
```javascript
commitTypes: {
  'update': (base) => `${base}.${shortHash()}.html`,
  'milestone': (base, msg) => `${base}.${slugify(msg)}-${date()}.html`,
  'close': (base) => `${base}.closed-${shortDate()}.html`
}
```

## Implementation Details

### Commit Hash Generation
```javascript
async function generateCommitHash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify({
    dbState: uint8ArrayToBase64(db.export()),
    timestamp: Date.now(),
    message: commitMessage,
    parent: currentCommitHash
  }));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}
```

### Commit Chain
Each file knows its ancestry:
```
contract.html (initial)
  └─> contract.draft-2026-01-12.html (commit: "Initial draft")
       └─> contract.reviewed-2026-01-12.html (commit: "Reviewed by legal")
            └─> contract.signed-2026-01-13.html (commit: "Signed by both parties")
```

### Commit History Table in SQLite
```sql
CREATE TABLE commit_history (
  commit_hash TEXT PRIMARY KEY,
  parent_hash TEXT,
  commit_message TEXT NOT NULL,
  commit_type TEXT,
  commit_author TEXT,
  commit_date TEXT NOT NULL,
  app_version TEXT
);
```

### Commit UI Flow

#### Option 1: Simple Commit (Default)
```
[Add Note] → [Commit] → Shows dialog:
  - Commit message: "Added meeting notes"
  - [Commit and Save]
  
→ Downloads: notes.a1b2c3d4.html
```

#### Option 2: Semantic Commit (App-Specific)
```
[Sign Contract] → Shows dialog:
  - This will create a signed version
  - Commit message: "Signed by John Doe on behalf of ACME Corp"
  - [Sign and Save]
  
→ Downloads: contract.signed-2026-01-13.html
```

## Framework API

```javascript
class HTMLCommitFramework {
  constructor(config) {
    this.basename = config.basename || 'document';
    this.commitTypes = config.commitTypes || defaultCommitTypes;
    this.onCommit = config.onCommit || (() => {});
  }
  
  async commit(message, type = 'default') {
    const hash = await this.generateCommitHash();
    const metadata = this.createCommitMetadata(hash, message, type);
    const filename = this.generateFilename(type, hash);
    const html = this.buildHTML(metadata);
    return this.save(html, filename);
  }
  
  async save(html, filename) {
    // Try File System Access API first (localhost)
    // Fall back to download
  }
  
  loadHistory() {
    // Load commit_history from embedded DB
  }
  
  getCommitChain() {
    // Reconstruct ancestry from current back to initial
  }
}
```

## User Experience Benefits

1. Automatic Versioning: Every change creates a traceable version
2. Commit Messages: Rich context for what changed and why
3. Branching: Open any previous version and commit from there
4. Diffing: Compare any two HTML files (future feature)
5. Portability: Send any version to anyone - it's fully executable
6. Auditability: Complete change history in each file
7. No Server Required: Pure client-side, works offline

## File Extension Strategy

### Option A: Keep `.html` (Recommended)
- Pro: Files open in any browser immediately
- Pro: No MIME type issues
- Con: Doesn't signal "special" nature

### Option B: Custom `.vhtml` or `.commit.html`
- Pro: Signals versioned nature
- Con: Requires browser association setup
- Con: Might not auto-open in browser

### Option C: Double Extension `.commit.html`
- Best of both worlds
- Windows still recognizes as HTML
- Name conveys meaning
- Recommended for framework

## Real-World Examples

### Contract Lifecycle
```
contract.html                        (Initial draft)
contract.reviewed-2026-01-12.html    (Legal review)
contract.revised-2026-01-12.html     (Client changes)
contract.signed-2026-01-13.html      (Fully executed) ← Send this
```

### Notes App
```
notes.html                    (Start)
notes.a1b2c3d4.html          (Added 5 notes)
notes.f3e8d9c2.html          (Added 10 more notes)
notes.backup-20260113.html   (Manual backup point)
```

### Tax Return App
```
tax-return-2025.html                  (Initial)
tax-return-2025.draft-01-10.html     (First draft)
tax-return-2025.reviewed-01-12.html  (CPA reviewed)
tax-return-2025.filed-01-15.html     (Submitted to IRS)
```

## Implementation Phases

### Phase 1: Core Commit System (Next)
- [ ] Generate commit hashes
- [ ] Add commit metadata structure
- [ ] Create commit UI (message input)
- [ ] Implement smart filename generation
- [ ] Add commit_history table to DB

### Phase 2: Framework Abstraction
- [ ] Extract commit logic into framework
- [ ] Create configuration API
- [ ] Document app customization patterns
- [ ] Build example apps (notes, contracts, deals)

### Phase 3: Advanced Features
- [ ] Visual commit history viewer
- [ ] Diff between versions
- [ ] Commit tags/labels
- [ ] Export commit log
- [ ] Branch visualization

## Why This Is Powerful

1. Turns limitation into feature: Browser security becomes version control
2. No central server needed: Each file is a complete repository
3. Human-readable filenames: `contract.signed-2026-01-13.html` tells a story
4. Audit trail: Every change has context and reason
5. Framework for app builders: Clean API for custom apps
6. Legal/compliance: Built-in change tracking for regulated industries

## Comparison to Traditional Git

| Feature | Git | HTML Commits |
|---------|-----|--------------|
| Storage | Repository | Single HTML file |
| Distribution | Clone/Push | Send file |
| History | .git folder | Embedded SQLite |
| Viewing | Command line | Open in browser |
| Portability | Need Git | Just need browser |
| Diffing | Built-in | Future feature |
| Branching | Explicit | Open old version |

## Prior Art

- Fossil VCS is version control built on SQLite (by SQLite's creator)
- Git is distributed version control (inspired our model)
- Conventional Commits are structured commit messages we can adopt
- Timecapsule is versioned documents with similar philosophy
- CouchDB is document versioning with similar metadata approach

---

We're building the first truly portable, browser-native, version-controlled document format. Each HTML file is simultaneously:
- A fully functional application
- A complete database
- A version control repository
- A human-readable file

It's git + app + data, all in one portable HTML file.
