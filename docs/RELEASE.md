# GitPilot Release Guide

## Channels

| Channel | Tag pattern | Example | Who gets it |
|---------|-------------|---------|-------------|
| **Stable** | `v*.*.*` | `v1.2.0` | All users on stable channel |
| **Beta** | `v*.*.*-beta.*` or `v*.*.*-alpha.*` or `v*.*.*-rc.*` | `v1.2.0-beta.1` | Users who opted into beta channel |

---

## Pre-release checklist

1. All CI checks green on `main`/`develop`
2. `npm run typecheck` — no errors
3. `cargo check --manifest-path src-tauri/Cargo.toml --locked` — no errors
4. Manual smoke-test on at least one platform
5. `CHANGELOG.md` updated (if maintained)

---

## Versioning — single source of truth

**Only edit `package.json` → `"version"`.**

`tauri.conf.json` has no `version` field — Tauri 2 reads it automatically from `package.json`.
Never put `-alpha`/`-beta` in `package.json`. Channel info belongs in the **git tag** only.

| What to change | Where |
|---|---|
| Bump version | `package.json` → `"version": "1.2.0"` |
| Mark as alpha/beta | Git tag suffix: `v1.2.0-alpha.1` |
| Never touch | `tauri.conf.json` version (field removed) |

---

## How to release

### Stable release

```bash
# 1. Bump version in package.json → "1.2.0", commit & push
git checkout main
git pull

git tag v1.2.0
git push origin v1.2.0
```

### Beta / pre-release

```bash
# package.json stays at base version e.g. "0.1.0"
# Pre-release info goes in the tag only:
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

The release workflow strips the suffix before writing to `tauri.conf.json` so Windows MSI bundling works (MSI requires numeric-only pre-release identifiers).

After the workflow completes, `latest.json` is automatically copied to the permanent `beta-channel` release so in-app update checks for beta users pick it up.

---

## What the release workflow does

```
push tag v* → release.yml
  ├── windows-latest  (x86_64-pc-windows-msvc)
  ├── macos-latest    (aarch64-apple-darwin)
  ├── macos-latest    (x86_64-apple-darwin)
  └── ubuntu-22.04

Each runner:
  1. Strips pre-release suffix from tag (e.g. 1.0.0-alpha.1 → 1.0.0)
  2. Writes stripped version → src-tauri/tauri.conf.json (overrides package.json at build time)
  3. Builds Tauri app + signs installer
  3. Publishes GitHub Release with installers + latest.json

Alpha only (ubuntu runner):
  4. Copies latest.json → alpha-channel release (for in-app updater)
```

### Required secrets

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signs installers for auto-update verification |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key |
| `GITHUB_TOKEN` | Auto-provided by Actions; needs `contents: write` |

> To generate a signing key pair: `npx @tauri-apps/cli signer generate`
> Save the private key in the repo secret and the public key in `tauri.conf.json` → `plugins.updater.pubkey`.

---

## Artifacts per platform

| Platform | Installer format |
|----------|-----------------|
| Windows | `.msi` + `.exe` (NSIS) |
| macOS arm64 | `.dmg` (Apple Silicon) |
| macOS x64 | `.dmg` (Intel) |
| Linux | `.deb` + `.AppImage` |

All artifacts are attached to the GitHub Release. The `latest.json` updater manifest is also included and consumed by the in-app update checker.

---

## In-app update endpoints

| Channel | Manifest URL |
|---------|-------------|
| Stable | `https://github.com/ePlus-DEV/GitPilot/releases/latest/download/latest.json` |
| Alpha | `https://github.com/ePlus-DEV/GitPilot/releases/download/alpha-channel/latest.json` |

Endpoint is selected at runtime from `settings.updateChannel` (`stable` \| `alpha`).

---

## Hotfix / patch release

1. Cherry-pick or fix directly on `main`
2. Tag the next patch version: `v1.2.1`
3. Push tag — same workflow runs automatically

No need to cut a branch for hotfixes unless the fix must target an older minor version.

---

## Rolling back

GitHub Releases can be unpublished via UI or CLI:

```bash
# Mark a release as draft (hides from public, stops update delivery)
gh release edit v1.2.0 --draft

# Delete entirely
gh release delete v1.2.0 --yes
git push origin --delete v1.2.0
```

After rollback, re-publish the previous stable release so `latest.json` rolls back too.
