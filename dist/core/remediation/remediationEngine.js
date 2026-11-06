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
exports.buildRemediationPlan = buildRemediationPlan;
exports.applyControlledRemediation = applyControlledRemediation;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const redactor_1 = require("../redactor/redactor");
function buildRemediationPlan(rule, rawSecret, filePath, line, inferredVarName) {
    const envVarName = rule.suggestedEnvName(inferredVarName);
    const replacementCode = `process.env.${envVarName}`;
    const redacted = (0, redactor_1.redactSecret)(rawSecret);
    const steps = [
        `1. Revoke / rotate credential immediately with provider: ${rule.provider}`,
        `2. Migrate secret value to local .env file (${envVarName})`,
        `3. Replace hardcoded literal in ${filePath} with ${replacementCode}`,
        `4. Verify .env is listed in .gitignore so it is never committed`,
        `5. If committed previously, purge from Git history using git-filter-repo or BFG`,
        `6. Rescan file and commit to verify exposure is eliminated`,
    ];
    const envFileSnippet = `${envVarName}="${rawSecret}"`;
    const envExampleSnippet = `${envVarName}=your_${envVarName.toLowerCase()}_here`;
    const gitHistoryPurgeCommand = `git filter-repo --invert-paths --path "${filePath}"`;
    // Create unified diff preview
    const diffPreview = `--- a/${filePath}
+++ b/${filePath}
@@ -${line},1 +${line},1 @@
- ... "${redacted}" ...
+ ... ${replacementCode} ...`;
    return {
        steps,
        envVarName,
        replacementCode,
        envFileSnippet,
        envExampleSnippet,
        gitHistoryPurgeCommand,
        diffPreview,
    };
}
function applyControlledRemediation(finding, workspaceRoot) {
    try {
        const targetFile = finding.fullPath;
        if (!fs.existsSync(targetFile)) {
            return {
                success: false,
                message: `Target file not found: ${targetFile}`,
                envPath: '',
                modifiedFile: targetFile,
            };
        }
        const fileContent = fs.readFileSync(targetFile, 'utf8');
        if (!fileContent.includes(finding.rawSecret)) {
            return {
                success: false,
                message: 'Secret no longer found in target file (may have already been modified).',
                envPath: '',
                modifiedFile: targetFile,
            };
        }
        // 1. Replace the secret in target file
        const newContent = fileContent.replace(new RegExp(escapeRegExp(finding.rawSecret), 'g'), finding.remediation.replacementCode);
        fs.writeFileSync(targetFile, newContent, 'utf8');
        // 2. Append to .env
        const envPath = path.join(workspaceRoot, '.env');
        const envLine = `\n# Secured by Secret Leak Detector\n${finding.remediation.envFileSnippet}\n`;
        fs.appendFileSync(envPath, envLine, 'utf8');
        // 3. Ensure .env is in .gitignore
        const gitignorePath = path.join(workspaceRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const gitignore = fs.readFileSync(gitignorePath, 'utf8');
            if (!gitignore.includes('.env')) {
                fs.appendFileSync(gitignorePath, '\n# Credentials\n.env\n.env.*.local\n', 'utf8');
            }
        }
        else {
            fs.writeFileSync(gitignorePath, '# Credentials\n.env\n.env.*.local\n', 'utf8');
        }
        // 4. Update or create .env.example
        const envExamplePath = path.join(workspaceRoot, '.env.example');
        const exampleLine = `${finding.remediation.envExampleSnippet}\n`;
        if (!fs.existsSync(envExamplePath) || !fs.readFileSync(envExamplePath, 'utf8').includes(finding.remediation.envVarName)) {
            fs.appendFileSync(envExamplePath, exampleLine, 'utf8');
        }
        return {
            success: true,
            message: `Successfully migrated ${finding.type} to .env (${finding.remediation.envVarName}) and replaced in ${finding.file}.`,
            envPath,
            modifiedFile: targetFile,
        };
    }
    catch (err) {
        return {
            success: false,
            message: `Remediation failed: ${err.message}`,
            envPath: '',
            modifiedFile: finding.fullPath,
        };
    }
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=remediationEngine.js.map