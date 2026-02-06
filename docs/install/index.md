---
summary: "Alternative install methods, deployment options, and maintenance for OpenClaw"
read_when:
  - You need Docker, Nix, from-source, or another non-default install method
  - You want to deploy to a cloud platform
  - You need to update, migrate, or uninstall
title: "Install"
---

# Install

If you followed [Getting Started](/start/getting-started), you're already installed.
This section covers alternative install methods, deployment, and maintenance.

<Info>
Looking for first-time setup? Start with [Getting Started](/start/getting-started) instead.
</Info>

## System requirements

- **Node >=22**
- macOS, Linux, or Windows via WSL2
- `pnpm` only if you build from source

## Choose your install method

| Method                                        | When to use                                                       |
| --------------------------------------------- | ----------------------------------------------------------------- |
| [Installer](/start/getting-started) (default) | First-time setup — the Getting Started guide walks you through it |
| [npm/pnpm global](#global-install)            | You manage Node yourself and prefer a manual global install       |
| [From source](#from-source)                   | Contributors and local development                                |
| [Docker](/install/docker)                     | Containerized or headless deployments                             |
| [Nix](/install/nix)                           | You already use Nix                                               |
| [Ansible](/install/ansible)                   | Automated fleet provisioning                                      |
| [Bun](/install/bun)                           | CLI-only usage via Bun runtime                                    |

## Global install

If you already have Node 22+:

```bash
npm install -g openclaw@latest
```

If you have libvips installed globally (common on macOS via Homebrew) and `sharp` fails to install, force prebuilt binaries:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

If you see `sharp: Please add node-gyp to your dependencies`, either install build tooling (macOS: Xcode CLT + `npm install -g node-gyp`) or use the `SHARP_IGNORE_GLOBAL_LIBVIPS=1` workaround above to skip the native build.

Or with pnpm:

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

pnpm requires explicit approval for packages with build scripts. After the first install shows the "Ignored build scripts" warning, run `pnpm approve-builds -g` and select the listed packages.

Then run onboarding:

```bash
openclaw onboard --install-daemon
```

## From source

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

Tip: if you don't have a global install yet, run repo commands via `pnpm openclaw ...`.

For deeper development workflows, see [Setup](/start/setup).

## Installer details

The installer supports two methods:

- `npm` (default): `npm install -g openclaw@latest`
- `git`: clone/build from GitHub and run from a source checkout

### CLI flags

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

Common flags:

- `--install-method npm|git`
- `--git-dir <path>` (default: `~/openclaw`)
- `--no-git-update` (skip `git pull` when using an existing checkout)
- `--no-prompt` (disable prompts; required in CI/automation)
- `--dry-run` (print what would happen; make no changes)
- `--no-onboard` (skip onboarding)

### Environment variables

Equivalent env vars (useful for automation):

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1` (default: `1`; avoids `sharp` building against system libvips)

Full reference: [Installer internals](/install/installer).

## After install

- Run onboarding: `openclaw onboard --install-daemon`
- Quick check: `openclaw doctor`
- Check gateway health: `openclaw status` + `openclaw health`
- Open the dashboard: `openclaw dashboard`

## Troubleshooting: `openclaw` not found (PATH)

Quick diagnosis:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

If `$(npm prefix -g)/bin` (macOS/Linux) or `$(npm prefix -g)` (Windows) is **not** present inside `echo "$PATH"`, your shell can't find global npm binaries (including `openclaw`).

Fix: add it to your shell startup file (zsh: `~/.zshrc`, bash: `~/.bashrc`):

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

On Windows, add the output of `npm prefix -g` to your PATH.

Then open a new terminal (or `rehash` in zsh / `hash -r` in bash).

## Update / uninstall

- Updates: [Updating](/install/updating)
- Migrate to a new machine: [Migrating](/install/migrating)
- Uninstall: [Uninstall](/install/uninstall)
