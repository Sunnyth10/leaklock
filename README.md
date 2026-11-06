```text
 _      _____  ___   _   __ _      _____  _____  _   __
| |    |  ___|/ _ \ | | / /| |    |  _  |/  __ \| | / /
| |    | |__ / /_\ \| |/ / | |    | | | || /  \/| |/ / 
| |    |  __||  _  ||    \ | |    | | | || |    |    \ 
| |____| |___| | | || |\  \| |____\ \_/ /| \__/\| |\  \
\_____/\____/\_| |_/\_| \_/\_____/ \___/  \____/\_| \_/

        ***>> [ STOP SECRETS BEFORE THEY LEAK ] <<***
```

# 🛡️ LeakLock

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-v1.85+-blue.svg?logo=visualstudiocode)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![Security Gate](https://img.shields.io/badge/Security-Fail--Closed-00e5b0.svg)]()
[![Analysis](https://img.shields.io/badge/Analysis-AST%20%2B%20Shannon%20Entropy-blueviolet.svg)]()
[![Local-First](https://img.shields.io/badge/Privacy-100%25%20Local-success.svg)]()

> **LeakLock** is a developer-first credential protection platform that combines a **VS Code Extension**, a **Fail-Closed Git Pre-Commit Hook**, a **High-Performance CLI Scanner**, and a **Real-Time Security Dashboard**. It prevents exposed API keys, database connection strings, and tokens from ever being accidentally committed to version control.

---

## ⚡ The LeakLock Core Architecture

Most conventional scanners run regex matchers that flood developers with false positives and alert fatigue. **LeakLock** replaces blind regex scans with an explainable 4-stage pipeline:

```text
 ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
 │   1. DETECT   │ ──► │   2. PROVE    │ ──► │   3. TRACE    │ ──► │    4. FIX     │
 └───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
  Pattern Matching      Signal Score (0-100)  Git Provenance        One-Click Quick Fix
  Shannon Entropy       Evidence Breakdown    Blast Radius Graph    .env Extraction
  AST Lexical Scope     Suppression Filters   Branch Reachability   .gitignore Sync
```

### 1. DETECT — Multi-Signal Candidate Engine
LeakLock evaluates potential secrets against 5 coordinated layers before triggering:
- **Provider Signatures:** 12+ cloud and identity provider patterns (AWS Access Keys, GitHub PATs, GCP Service Accounts, Stripe Live Keys, Slack Bot Tokens, Azure Connection Strings, OpenAI/Anthropic Keys, Database URIs, Private Keys, JWTs).
- **Shannon Entropy Analysis:** Calculates information entropy ($H = -\sum p_i \log_2 p_i$) across Base64, Hexadecimal, and ASCII distributions to detect high-randomness cryptographic secrets.
- **Compiler AST Analysis (TypeScript/JavaScript):** Employs compiler-grade AST parsing (`ts.createSourceFile`) to inspect property assignments, binary expressions (`process.env.KEY || "..."`), de-concatenate split strings (`"ghp_" + "abc123..."`), and verify assignment context.
- **Context Awareness:** Automatically evaluates file environment (`.env`, `config/` vs `tests/fixtures/`, `mock_data.json`).
- **Placeholder Suppression:** Distinguishes genuine secrets from mock variables, documentation dummy tokens, and samples.

### 2. PROVE — Calibrated Signal Scoring (0–100)
Every finding outputs an auditable, transparent score rather than a black-box warning:
- Pattern match confirmed: `+25`
- Known credential format: `+30`
- High cryptographic entropy: `+20`
- Sensitive identifier name (`api_key`, `secret_token`): `+15`
- Configuration or production context: `+10`
- *Subtractions for test indicators, placeholders, and dummy keywords (`-10` to `-25`)*

### 3. TRACE — Git Provenance & Blast Radius Graph
Even if a developer deletes a secret from an active file, LeakLock traces the Git history:
- Identifies the introductory commit, timestamp, and author.
- Computes **Exposure Duration** in days.
- Maps **Branch Reachability** (`git branch -a --contains`) and alerts if credentials reached remote tracking branches (`origin/*`).
- Generates ASCII timelines and DAG exposure graphs.

### 4. FIX — Controlled Remediation
- **Safe Masking:** Secrets are redacted in all logs and dashboards (`AKIA••••••••••••DEF`) with deterministic SHA-256 fingerprints to eliminate secondary leaks.
- **One-Click Quick Fix (`Cmd+.` / `Alt+.`):** Automatically migrates the secret literal to `.env`, generates `.env.example`, syncs `.gitignore`, and updates code to reference `process.env.<VAR_NAME>`.
- **Patch Preview:** Unified diff view before committing code changes.

---

## 🖥️ VS Code Extension Usage

LeakLock provides seamless protection inside Visual Studio Code:

1. **Real-Time Editor Squiggles:** Flags hardcoded secrets as you type or save documents.
2. **Hover Insight Cards:** Hover over any finding to inspect its Signal Score, Shannon Entropy, and point breakdown.
3. **One-Click Quick Fix:** Press `Cmd+.` (Mac) or `Alt+.` (Windows/Linux) on any highlighted secret to automatically:
   - Extract the value into your local `.env`.
   - Add `.env` to your `.gitignore` if missing.
   - Generate or update `.env.example` with a safe placeholder.
   - Replace the literal with `process.env.<VAR_NAME>`.
4. **Activity Bar Panel:** Click the LeakLock shield icon in the Activity Bar to inspect active workspace leaks categorized by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and jump directly to any offending file and line.
5. **Interactive Webview Dashboard:** Run `LeakLock: Open Security Dashboard` to launch the full graphical risk radar and blast radius visualizer.

---

## 🛡️ Standalone Pre-Commit Hook

LeakLock includes a **fail-closed pre-commit barrier** that prevents accidental commits before they can ever be recorded to Git:

```bash
# Install pre-commit hook into your repository
npx leaklock hook install
```

When installed, every `git commit` automatically scans staged changes:
```text
🔐 [LeakLock] Inspecting staged changes for credentials...
============================================================
🔍 LEAKLOCK SCAN RESULTS
============================================================
Files Scanned:    18
Duration:         24ms
Active Leaks:     0

✅ ALL CLEAN! No secrets or credentials detected.
============================================================
```
*If a critical secret is staged, the commit is actively aborted with explicit remediation steps and diff previews.*

---

## 💻 CLI Commands & CI/CD Integration

The standalone `leaklock` CLI can be run in any terminal or continuous integration pipeline:

```bash
# Scan current repository or directory
npx leaklock scan .

# Scan only Git staged changes (ideal for pre-commit checks)
npx leaklock scan --staged

# Export findings to OASIS SARIF v2.1.0 for GitHub Code Scanning
npx leaklock scan . --sarif > results.sarif

# Evaluate with baseline (suppresses existing known findings, fails only on new)
npx leaklock scan . --baseline .secretleak-baseline.json

# Scan Git commit history for zombie secret leaks
npx leaklock history --max 100

# Trace provenance and blast radius of a specific credential
npx leaklock trace <CREDENTIAL_VALUE>

# Display ASCII timeline across commit history
npx leaklock timeline <CREDENTIAL_VALUE>

# Export formal Git DAG exposure graph in JSON format
npx leaklock graph <CREDENTIAL_VALUE>

# Interactive controlled remediation
npx leaklock fix src/services/s3.ts

# Rescan and verify exposure elimination
npx leaklock verify src/services/s3.ts
```

### GitHub Actions CI Workflow

Add LeakLock to `.github/workflows/security.yml`:

```yaml
name: LeakLock Security Gate

on: [push, pull_request]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run LeakLock Security Scan
        run: |
          node ./dist/cli.js scan . --sarif > results.sarif

      - name: Upload SARIF to GitHub Security Tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif
```

---

## 📦 Project Structure

```text
leaklock/
├── .vscode/                 # VS Code launch and task definitions
├── dist/                    # Compiled, self-contained extension & CLI engines
│   ├── extension.js         # VS Code extension entrypoint
│   ├── cli.js               # Standalone bundled CLI executable
│   ├── core/                # Multi-signal scanner, AST analyzer & risk engine
│   ├── diagnostics/         # In-editor diagnostics & Quick Fix code action provider
│   ├── sidebar/             # Activity Bar findings tree provider
│   └── webview/             # Interactive security dashboard webview
├── media/                   # Extension icons and shield graphics
├── src/                     # React 19 + Tailwind CSS interactive web dashboard
├── index.html               # Web showcase entry shell
├── package.json             # Extension manifest & build scripts
├── LICENSE.txt              # MIT License (Sunny)
└── README.md                # LeakLock documentation
```

---

## 📜 License

MIT License — Copyright (c) 2026 Sunny (Sunnyth). See [LICENSE.txt](LICENSE.txt) for details.
