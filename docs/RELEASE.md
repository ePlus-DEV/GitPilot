# GitPilot Release Guide

## Channels

| Channel | Tag pattern | Example | Who gets it |
|---------|-------------|---------|-------------|
| **Stable** | `v*.*.*` | `v1.2.0` | All users on stable update channel |
| **Alpha** | `v*.*.*-alpha.*` | `v1.2.0-alpha.1` | Users who opted into alpha channel |
| **Beta** | `v*.*.*-beta.*` | `v1.2.0-beta.1` | Users who opted into alpha channel |

---

## Pre-release checklist

1. All CI checks green on `main`/`develop`
2. `npm run typecheck` — no errors
3. `cargo check --manifest-path src-tauri/Cargo.toml --locked` — no errors
4. Manual smoke-test on at least one platform
5. `CHANGELOG.md` updated (if maintained)

---

## How to release

Version lives in the **git tag** only. The release workflow automatically syncs it into `tauri.conf.json` at build time — do **not** edit `package.json` or `tauri.conf.json` version manually.

### Stable release

```bash
git checkout main
git pull

git tag v1.2.0
git push origin v1.2.0
```

### Alpha / Beta release

```bash
git tag v1.2.0-alpha.1
git push origin v1.2.0-alpha.1
```

After the workflow completes, the `latest.json` updater manifest is automatically copied to the permanent `alpha-channel` release so in-app update checks for alpha users pick it up.

---

## What the release workflow does

```
push tag v* → release.yml
  ├── windows-latest  (x86_64-pc-windows-msvc)
  ├── macos-latest    (aarch64-apple-darwin)
  ├── macos-latest    (x86_64-apple-darwin)
  └── ubuntu-22.04

Each runner:
  1. Syncs tag version → src-tauri/tauri.conf.json
  2. Builds Tauri app + signs installer
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
