# Contributing to MemoryFile

Thank you for your interest in contributing to MemoryFile!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit with clear messages
7. Push to your fork
8. Open a Pull Request

## Development Setup

```bash
# Clone the repository
git clone https://github.com/AmbientAccent/memoryfile.git
cd memoryfile

# Standard development workflow - requires server because test-runner.html
# loads sql-wasm.js which needs to fetch sql-wasm.wasm (CORS restriction)
python3 -m http.server 3000
open http://localhost:3000/test-runner.html

# Quick test of inline examples - these work without a server because they
# embed WASM as base64 data URI in sql-wasm-inline.js
open examples/01-basic-demo-inline.html
```

## Building Inline WASM

The project supports two WASM approaches:

### Standard WASM (Development)
- Uses `lib/sql-wasm.js` with separate `.wasm` file
- Requires HTTP server for development
- Smaller file size (~50KB overhead)

### Inline WASM (Production/Distribution)
- Uses `lib/sql-wasm-inline.js` with embedded WASM
- Works with `file://` protocol
- Larger file size (+800KB overhead)
- True portability - no server needed

### Building Inline Version

When `sql-wasm.wasm` is updated, rebuild the inline version:

```bash
node build-inline-wasm.js
```

This creates `lib/sql-wasm-inline.js` with WASM embedded as base64 data URI.

### Creating Inline Examples

To create an inline version of an example:

```bash
cp examples/my-demo.html examples/my-demo-inline.html
sed -i '' 's|../lib/sql-wasm.js|../lib/sql-wasm-inline.js|' examples/my-demo-inline.html
```

Or manually change:
```html
<!-- From: -->
<script src="../lib/sql-wasm.js"></script>

<!-- To: -->
<script src="../lib/sql-wasm-inline.js"></script>
```

See [INLINE_WASM.md](INLINE_WASM.md) for details.

## Running Tests

### Run All Tests
Open `test-runner.html` in Chrome or Edge and click "Run All Tests"

### Run Specific Test Suites
- `test-runner.html` - Core functionality tests
- `trust-test-runner.html` - Trust and verification tests
- `limits-runner.html` - System limits tests

All tests should pass before submitting a PR.

## Code Guidelines

### JavaScript Style
- Use ES6+ features
- Prefer `const` and `let` over `var`
- Use async/await for asynchronous code
- Add comments for complex logic
- Keep functions focused and small

### Documentation
- Update README.md if adding major features
- Add JSDoc comments for public APIs
- Update relevant docs/ files
- Include examples for new features

### Testing
- Add unit tests for new functions
- Add integration tests for new workflows
- Ensure all existing tests pass
- Performance tests for critical operations

## Pull Request Process

1. **Before submitting:**
   - Run all test suites
   - Update documentation
   - Add tests for new features
   - Check for console errors

2. **PR description should include:**
   - What changed and why
   - Any breaking changes
   - Screenshots (if UI changes)
   - Related issues

3. **Review process:**
   - Maintainers will review your PR
   - Address any feedback
   - Once approved, PR will be merged

## Areas for Contribution

### High Priority
- Browser compatibility improvements
- Performance optimizations
- Documentation improvements
- Bug fixes

### Medium Priority
- New example applications
- Additional test coverage
- UI/UX improvements
- Error handling enhancements

### Future Features
- Compression support
- Encryption options
- Import/export utilities
- Developer tools

## Reporting Bugs

When reporting bugs, please include:

1. **Description:** Clear description of the issue
2. **Steps to reproduce:** Minimal steps to trigger the bug
3. **Expected behavior:** What should happen
4. **Actual behavior:** What actually happens
5. **Environment:** Browser, OS, version
6. **Screenshots:** If applicable

## Feature Requests

We welcome feature requests! Please:

1. Check if the feature already exists
2. Search existing issues
3. Describe the use case
4. Explain why it's valuable
5. Suggest implementation (optional)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn

## Questions?

- Check [README.md](README.md) for basics
- Read [docs/](docs/) for detailed guides
- Open an issue for discussion
- Join community discussions

## FAQ for Contributors

### When do I need to run a local server?

You need a server ONLY for files that use `sql-wasm.js` (the standard version). This includes:
- test-runner.html
- Most examples (01-basic-demo.html, 02-commit-demo.html, etc.)

Files with `-inline.html` suffix work directly via `open` command or double-click. No server needed.

**The issue:** Browsers block loading `.wasm` files via `file://` protocol due to CORS policy. The standard version tries to fetch `sql-wasm.wasm` separately, which fails without a server.

**For day-to-day development:** Run `python3 -m http.server 3000` once and keep it running. Open test-runner.html via `http://localhost:3000/test-runner.html`. This is the standard development workflow.

### What's my development workflow for code changes?

Standard cycle for core library changes:

1. Edit the JavaScript file directly (e.g., `lib/html-sqlite-core.js`)
2. Start server: `python3 -m http.server 3000`
3. Open `http://localhost:3000/test-runner.html` in Chrome/Edge
4. Click "Run All Tests"
5. Fix any failures and refresh the page
6. Commit when all tests pass

No build step required for JavaScript changes. The HTML files load scripts directly.

### When do I need to rebuild inline WASM?

Almost never. Only rebuild `sql-wasm-inline.js` if:
- The `sql-wasm.wasm` binary itself is updated (rare, maintainer task)
- The `sql-wasm.js` wrapper changes (rare)

Regular contributors working on application code (html-sqlite-core.js, trust-manager.js, tests) never need to run `node build-inline-wasm.js`.

### Which tests should I run before submitting a PR?

Minimum validation:
1. Open `http://localhost:3000/test-runner.html`
2. Click "Run All Tests"
3. All 200+ tests must pass (100% success rate)

If you changed encryption: also run `encryption-test-runner.html`  
If you changed trust/verification: also run `trust-test-runner.html`

Tests run fast (5-10 seconds for full suite). No long-running tests to worry about.

### What are the code style conventions?

Follow these patterns observed in the codebase:

JavaScript style:
- Use `const` and `let`, never `var`
- Prefer `async/await` over promises
- Use camelCase for variables and functions
- Use PascalCase for classes
- Arrow functions for callbacks: `array.map(item => item.id)`
- Template literals for strings: `` `Hello ${name}` ``

Commit messages:
- Use present tense: "Add feature" not "Added feature"
- Be descriptive: "Fix encryption key derivation bug" not "Fix bug"
- Reference issues when relevant: "Fix password validation (#123)"

Branch naming:
- Use descriptive names: `fix-encryption-bug`, `add-compression-support`
- No strict convention, just be clear

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to MemoryFile!
