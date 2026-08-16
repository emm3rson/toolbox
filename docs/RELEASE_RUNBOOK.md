# Release Runbook & Versioning Guide

Reference guide for cutting and shipping production releases of the Toolbox desktop application.

---

## 1. Versioning Standard (SemVer)

Follow standard Semantic Versioning (`MAJOR.MINOR.PATCH`):
- **`PATCH` (e.g. `0.1.0` → `0.1.1`)**: Bug fixes, visual polish, copy revisions, or internal refactorings that do not add new tools or change existing workflows.
- **`MINOR` (e.g. `0.1.0` → `0.2.0`)**: New tools, new settings, or backward-compatible feature additions.
- **`MAJOR` (e.g. `0.1.0` → `1.0.0` or `1.x` → `2.0.0`)**: Breaking workflow changes, file format compatibility changes, or production stability milestone (`1.0.0`).

---

## 2. The 3-File Version Sync

Before building a release, the version number **must be identical** across all three files:

| File | Purpose | Location |
|---|---|---|
| [`src-tauri/tauri.conf.json`](file:///c:/Projects/utility-desktop/src-tauri/tauri.conf.json) | Windows exe metadata & NSIS installer version | `"version": "X.Y.Z"` |
| [`package.json`](file:///c:/Projects/utility-desktop/package.json) | Frontend bundle version | `"version": "X.Y.Z"` |
| [`src-tauri/Cargo.toml`](file:///c:/Projects/utility-desktop/src-tauri/Cargo.toml) | Rust crate release version | `version = "X.Y.Z"` |

---

## 3. Step-by-Step Release Workflow

### Step 1: Run Full Verification Suite
Verify both frontend and native Rust test suites pass:
```bash
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

### Step 2: Bump Version Across Config Files
Update the version string in:
1. `src-tauri/tauri.conf.json`
2. `package.json`
3. `src-tauri/Cargo.toml`

### Step 3: Build the Release Installer
Compile the optimized native release and build the NSIS Windows installer:
```bash
npm run tauri build
```
The installer will be generated at:
`src-tauri/target/release/bundle/nsis/Toolbox_X.Y.Z_x64-setup.exe`

### Step 4: Update Changelog
Add a task-grouped entry at the top of [`CHANGELOG.md`](file:///c:/Projects/utility-desktop/CHANGELOG.md) following `AGENTS.md` guidelines:
```markdown
## Release vX.Y.Z — YYYY-MM-DD

- Changed: ...
- Decision: ...
- Verified: ...
```

### Step 5: Commit & Git Tag
Commit the version bump and create a Git release tag:
```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md docs/
git commit -m "chore(release): bump version to vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```
