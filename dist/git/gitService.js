"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scanner_1 = require("../engine/scanner");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitService {
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    /**
     * Checks if the workspace root is a git repository.
     */
    async isGitRepo() {
        try {
            await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspaceRoot });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Retrieves staged diff and scans all newly added lines for leaked secrets.
     */
    async scanStagedChanges() {
        if (!(await this.isGitRepo())) {
            return [];
        }
        try {
            const { stdout } = await execAsync('git diff --cached --unified=0', { cwd: this.workspaceRoot });
            if (!stdout || stdout.trim().length === 0) {
                return [];
            }
            const allFindings = [];
            const fileDiffs = stdout.split(/^diff --git /m);
            for (const diff of fileDiffs) {
                if (!diff.trim())
                    continue;
                const fileMatch = diff.match(/^[ab]\/(.+?) [ab]\/(.+)/m) || diff.match(/^\+\+\+ b\/(.+)/m);
                const fileName = fileMatch ? fileMatch[1] : 'staged-file';
                const fullPath = path.join(this.workspaceRoot, fileName);
                // Extract newly added lines marked with '+'
                const addedLines = diff
                    .split('\n')
                    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
                    .map((line) => line.substring(1))
                    .join('\n');
                if (addedLines.trim()) {
                    const findings = (0, scanner_1.scanContent)(addedLines, fullPath, this.workspaceRoot);
                    allFindings.push(...findings);
                }
            }
            return allFindings;
        }
        catch (err) {
            console.error('Failed to run git diff --cached:', err);
            return [];
        }
    }
    formatTerminalBlockedMessage(findings) {
        const criticals = findings.filter((f) => f.risk === 'CRITICAL');
        const primary = criticals[0] || findings[0];
        const remediationText = typeof primary.remediation === 'string'
            ? primary.remediation
            : primary.remediation?.steps?.join('\n') || 'Rotate and move to .env';
        const signalsList = primary.evidence?.items?.map((i) => `  - [${i.confidenceImpact >= 0 ? '+' : ''}${i.confidenceImpact}] ${i.description}`).join('\n') ||
            primary.signals?.map((s) => `  - ${s}`).join('\n') ||
            '  - Known pattern match';
        const blastRadiusText = primary.riskAssessment?.blastRadius
            ? `${primary.riskAssessment.blastRadius.level} (${primary.riskAssessment.blastRadius.summary})`
            : 'Local Working Tree';
        const banner = `
============================================================
❌ COMMIT BLOCKED BY SECRET LEAK DETECTOR
============================================================
🚨 Security Risk: Hard-coded secret detected before commit!

Finding Details:
------------------------------------------------------------
• Type:        ${primary.type}
• Provider:    ${primary.provider}
• File:        ${primary.file} (Line ${primary.line})
• Secret:      ${primary.redactedSecret}
• Risk Level:  ${primary.risk} (Score: ${primary.riskAssessment?.score ?? 95}/100)
• Confidence:  ${primary.confidence}%
• Blast Radius: ${blastRadiusText}

Evidence & Signals Detected:
${signalsList}

Recommended Remediation:
------------------------------------------------------------
${remediationText}

Example Fix:
  ${primary.exampleFix || primary.remediation?.replacementCode}

After fixing:
  1. Replace the secret in ${primary.file} with an environment variable.
  2. Add the sensitive value to your local .env (ensure .env is in .gitignore!).
  3. Run 'git add ${primary.file}'
  4. Run your 'git commit' again.
============================================================
`;
        return banner;
    }
    /**
     * Installs a standalone pre-commit hook into .git/hooks/pre-commit
     */
    async installPreCommitHook() {
        if (!(await this.isGitRepo())) {
            return { success: false, message: 'Workspace is not a Git repository.' };
        }
        const hooksDir = path.join(this.workspaceRoot, '.git', 'hooks');
        if (!fs.existsSync(hooksDir)) {
            try {
                fs.mkdirSync(hooksDir, { recursive: true });
            }
            catch (err) {
                return { success: false, message: `Could not create .git/hooks directory: ${err}` };
            }
        }
        const hookPath = path.join(hooksDir, 'pre-commit');
        const hookContent = `#!/bin/sh
# Secret Leak Detector Pre-Commit Hook
# Automatically blocks git commit if secrets are detected in staged changes

echo "🔐 [Secret Leak Detector] Scanning staged changes for credentials..."

DIFF=$(git diff --cached --unified=0)

# Check for AWS Access Keys
if echo "$DIFF" | grep -E '^[+]' | grep -E -q '(AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}'; then
    echo "❌ COMMIT BLOCKED: Potential AWS Access Key found in staged changes!"
    echo "Please remove the credential or use an environment variable before committing."
    exit 1
fi

# Check for GitHub Tokens
if echo "$DIFF" | grep -E '^[+]' | grep -E -q '(gh[pousr]_[A-Za-z0-9_]{36}|github_pat_[A-Za-z0-9_]{82})'; then
    echo "❌ COMMIT BLOCKED: Potential GitHub Personal Access Token found in staged changes!"
    echo "Please remove the token before committing."
    exit 1
fi

# Check for Stripe Secret Keys
if echo "$DIFF" | grep -E '^[+]' | grep -E -q '(sk|rk)_(live|test)_[0-9a-zA-Z]{24}'; then
    echo "❌ COMMIT BLOCKED: Stripe Secret Key found in staged changes!"
    exit 1
fi

# Check for Private Keys
if echo "$DIFF" | grep -E '^[+]' | grep -E -q '-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----'; then
    echo "❌ COMMIT BLOCKED: Unencrypted Private Key found in staged changes!"
    exit 1
fi

echo "✅ [Secret Leak Detector] Staged changes clean. Proceeding with commit."
exit 0
`;
        try {
            fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
            return { success: true, message: `Pre-commit hook successfully installed to ${hookPath}` };
        }
        catch (err) {
            return { success: false, message: `Failed to write hook file: ${err}` };
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=gitService.js.map