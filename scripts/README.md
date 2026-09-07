# Build and Install

One-liner to bump version, validate, build, and launch the NSIS installer.

Requires `pwsh` (PowerShell 7+). Do not use Windows PowerShell 5.1.

## Quick start

```powershell
# full checks + build + launch NSIS exe
./scripts/build-and-install.ps1

# bump patch 0.5.0 -> 0.5.1 then build + install
./scripts/build-and-install.ps1 -Bump patch

# explicit version
./scripts/build-and-install.ps1 -Version 0.6.0

# npm passthrough (same flags after --)
npm run build:install -- -Bump minor
npm run build:install:bump   # alias for -Bump patch
```

## Flags

| Flag | Effect |
|---|---|
| `-Version X.Y.Z` | Set explicit version (mutually exclusive with `-Bump`) |
| `-Bump patch|minor|major` | Semantic bump from current `package.json` version |
| `-NoInstall` | Build but do not launch installer |
| `-SkipChecks` | Skip validation (typecheck/test/cargo) |
| `-NoBuild` | Only bump version, do not build |

## What it does

1. **Version bump** (if `-Version`/`-Bump`): regex-replaces `"version"` in `package.json`, `src-tauri/Cargo.toml` (anchored `^version` so deps like `reqwest = { version = "0.13.4" }` are safe), and `src-tauri/tauri.conf.json`, then syncs `Cargo.lock` via `cargo generate-lockfile --offline` (fallback `cargo update -p utility-desktop --offline`). Resets `$LASTEXITCODE` after.
2. If `-NoBuild`, exits after bump.
3. **Validation** (unless `-SkipChecks`): `npm run typecheck` -> `npm run test` (skips `lint` if no script) -> `cargo fmt --check` -> `cargo clippy --all-targets -- -D warnings` -> `cargo test` (each checks `$LASTEXITCODE`). Runs without `--locked` locally (CI keeps `--locked`).
4. **Build**: `npm run build` -> `npm run tauri -- build`.
5. **Installer**: finds newest `src-tauri/target/release/bundle/nsis/*.exe` (fallback `msi/*.msi`) by `LastWriteTime`. If missing and not `-NoInstall`, lists `bundle/` and throws. Launches via `Start-Process -Verb Open` (fallback `RunAs`).

## Examples

```powershell
# quick iteration (no checks, no installer)
./scripts/build-and-install.ps1 -SkipChecks -NoInstall

# bump minor, skip checks, build
./scripts/build-and-install.ps1 -Bump minor -SkipChecks

# only bump version, verify manifests, no build
./scripts/build-and-install.ps1 -Bump patch -NoBuild

# revert after testing bump
./scripts/build-and-install.ps1 -Version 0.5.0 -NoBuild
```

## Pitfalls

- Use `pwsh`, not `powershell` 5.1 (`$LASTEXITCODE` undefined under `Set-StrictMode` and `--` in double quotes breaks).
- Do not edit `Cargo.lock` manually; the script syncs it.
- Do not leave `--locked` locally after a bump; the script intentionally runs without it.
- Single quotes are used for strings containing `--` to avoid WinPS parsing issues.
