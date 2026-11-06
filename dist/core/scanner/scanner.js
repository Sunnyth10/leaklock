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
exports.scanContent = scanContent;
exports.scanFile = scanFile;
exports.buildScanResult = buildScanResult;
const fs = __importStar(require("fs"));
const rules_1 = require("../detectors/rules");
const contextAnalyzer_1 = require("../context/contextAnalyzer");
const astAnalyzer_1 = require("../context/astAnalyzer");
const evidenceEngine_1 = require("../evidence/evidenceEngine");
const riskEngine_1 = require("../risk/riskEngine");
const remediationEngine_1 = require("../remediation/remediationEngine");
const redactor_1 = require("../redactor/redactor");
function scanContent(content, filePath, options = {}) {
    const opts = typeof options === 'string' ? { workspaceRoot: options } : options;
    const rules = opts.rules || rules_1.CORE_RULES;
    const workspaceRoot = opts.workspaceRoot;
    const lines = content.split(/\r?\n/);
    const fileContext = (0, contextAnalyzer_1.analyzeFileContext)(filePath);
    const findings = [];
    // Adversarial normalization: resolve split string concatenations (e.g. "ghp_" + "123...")
    let scanTargetContent = content;
    const concatRegex = /"([^"\r\n]{2,80})"\s*\+\s*"([^"\r\n]{10,120})"/g;
    let concatMatch;
    while ((concatMatch = concatRegex.exec(content)) !== null) {
        const combined = concatMatch[1] + concatMatch[2];
        scanTargetContent += `\nconst _deobfuscated = "${combined}";`;
    }
    for (const rule of rules) {
        rule.pattern.lastIndex = 0;
        let match;
        while ((match = rule.pattern.exec(scanTargetContent)) !== null) {
            const rawSecret = match[1] || match[0];
            const matchIndex = match.index;
            // Calculate line and column
            const textBefore = content.substring(0, matchIndex);
            const linesBefore = textBefore.split(/\r?\n/);
            const lineNumber = linesBefore.length;
            const columnNumber = linesBefore[linesBefore.length - 1].length + 1;
            // Extract lexical context and AST assignment semantics
            const lexicalContext = (0, contextAnalyzer_1.analyzeLexicalContext)(lines, lineNumber - 1);
            const astContext = (0, astAnalyzer_1.analyzeAstContext)(lines, lineNumber - 1);
            // Build Evidence Model & calculate confidence
            const evidenceResult = (0, evidenceEngine_1.buildEvidenceModel)(rule, rawSecret, fileContext, lexicalContext, filePath, astContext);
            // If classified as a false positive or placeholder, suppress it
            if (evidenceResult.isSuppressed) {
                continue;
            }
            // Check minimum entropy constraint
            if (rule.minEntropy &&
                evidenceResult.evidence.shannonEntropy < rule.minEntropy &&
                rule.baseRiskWeight < 90) {
                continue;
            }
            // Calculate relative path
            let relativePath = filePath;
            if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
                relativePath = filePath.substring(workspaceRoot.length).replace(/^[\\/]+/, '');
            }
            // Calculate dynamic Risk Assessment (0 - 100)
            const riskAssessment = (0, riskEngine_1.calculateRiskAssessment)(rule, evidenceResult.confidence, fileContext);
            // Build controlled Remediation Plan
            const remediation = (0, remediationEngine_1.buildRemediationPlan)(rule, rawSecret, relativePath, lineNumber, lexicalContext.inferredVariable);
            const id = `sec_${(0, redactor_1.generateFingerprint)(rawSecret)}_${lineNumber}`;
            const fingerprint = (0, redactor_1.generateFingerprint)(rawSecret);
            const redacted = (0, redactor_1.redactSecret)(rawSecret);
            const finding = {
                id,
                fingerprint,
                type: rule.name,
                provider: rule.provider,
                file: relativePath,
                fullPath: filePath,
                line: lineNumber,
                column: columnNumber,
                length: rawSecret.length,
                rawSecret,
                redactedSecret: redacted,
                confidence: evidenceResult.confidence,
                risk: riskAssessment.tier,
                riskAssessment,
                evidence: evidenceResult.evidence,
                remediation,
                status: 'ACTIVE',
                detectedAt: new Date().toISOString(),
                // Compatibility fields
                signals: evidenceResult.evidence.items.map((i) => i.description),
                exampleFix: remediation.replacementCode,
                entropy: evidenceResult.evidence.shannonEntropy,
            };
            findings.push(finding);
        }
    }
    // Deduplicate overlapping findings
    return deduplicateFindings(findings);
}
function scanFile(filePath, options = {}) {
    try {
        if (!fs.existsSync(filePath))
            return [];
        const stat = fs.statSync(filePath);
        if (stat.isDirectory() || stat.size > 5 * 1024 * 1024) {
            // Skip directories or files over 5MB
            return [];
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return scanContent(content, filePath, options);
    }
    catch {
        return [];
    }
}
function deduplicateFindings(findings) {
    const result = [];
    for (const finding of findings) {
        const existingIndex = result.findIndex((existing) => existing.file === finding.file &&
            existing.line === finding.line &&
            (existing.rawSecret.includes(finding.rawSecret) ||
                finding.rawSecret.includes(existing.rawSecret)));
        if (existingIndex === -1) {
            result.push(finding);
        }
        else {
            const existing = result[existingIndex];
            // Prefer specific cloud provider over Generic Credential
            if (existing.provider === 'Generic Credential' && finding.provider !== 'Generic Credential') {
                result[existingIndex] = finding;
            }
            else if (finding.confidence > existing.confidence) {
                result[existingIndex] = finding;
            }
        }
    }
    return result;
}
function buildScanResult(findings, filesScanned, durationMs) {
    const riskSummary = {
        critical: findings.filter((f) => f.risk === 'CRITICAL').length,
        high: findings.filter((f) => f.risk === 'HIGH').length,
        medium: findings.filter((f) => f.risk === 'MEDIUM').length,
        low: findings.filter((f) => f.risk === 'LOW').length,
    };
    const blocked = riskSummary.critical > 0 || riskSummary.high > 0;
    return {
        findings,
        filesScanned,
        durationMs,
        timestamp: new Date().toISOString(),
        isClean: findings.length === 0,
        blocked,
        riskSummary,
    };
}
//# sourceMappingURL=scanner.js.map