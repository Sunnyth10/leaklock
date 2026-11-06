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
exports.VerificationEngine = void 0;
const fs = __importStar(require("fs"));
const scanner_1 = require("../scanner/scanner");
const gitHistoryEngine_1 = require("../history/gitHistoryEngine");
class VerificationEngine {
    workspaceRoot;
    historyEngine;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.historyEngine = new gitHistoryEngine_1.GitHistoryEngine(workspaceRoot);
    }
    /**
     * Verifies whether a specific finding has been successfully remediated in the file and repository.
     */
    async verifyFindingFix(finding) {
        const filePath = finding.fullPath;
        const now = new Date().toISOString();
        if (!fs.existsSync(filePath)) {
            return {
                isResolved: true,
                targetFileClean: true,
                workingTreeClean: true,
                historyStatus: 'HEAD_AND_HISTORY_CLEAN',
                details: 'Offending file was removed from working tree.',
                timestamp: now,
            };
        }
        const currentFindings = (0, scanner_1.scanFile)(filePath, { workspaceRoot: this.workspaceRoot });
        const isStillInFile = currentFindings.some((f) => f.fingerprint === finding.fingerprint || f.rawSecret === finding.rawSecret);
        if (isStillInFile) {
            return {
                isResolved: false,
                targetFileClean: false,
                workingTreeClean: false,
                historyStatus: 'NOT_FIXED',
                details: `Secret string is still present on line ${finding.line} in ${finding.file}.`,
                timestamp: now,
            };
        }
        // Check Git history status
        const gitExposure = await this.historyEngine.traceSecret(finding.rawSecret);
        if (gitExposure.isPresentInHistory) {
            return {
                isResolved: true,
                targetFileClean: true,
                workingTreeClean: true,
                historyStatus: 'REMOVED_FROM_HEAD_STILL_IN_HISTORY',
                details: `Secret removed from active working tree! WARNING: Secret still exists in commit history (${gitExposure.introducedCommit?.sha.substring(0, 7)}). Credential revocation is mandatory.`,
                timestamp: now,
            };
        }
        return {
            isResolved: true,
            targetFileClean: true,
            workingTreeClean: true,
            historyStatus: 'HEAD_AND_HISTORY_CLEAN',
            details: 'Secret completely eliminated from file and no historical commits detected.',
            timestamp: now,
        };
    }
    /**
     * Compares before and after scan states to generate an audit-ready verification delta.
     */
    compareScans(before, after) {
        const afterFingerprints = new Set(after.map((f) => f.fingerprint));
        const beforeFingerprints = new Set(before.map((f) => f.fingerprint));
        const resolvedFindings = before.filter((f) => !afterFingerprints.has(f.fingerprint));
        const remainingFindings = after.filter((f) => beforeFingerprints.has(f.fingerprint));
        const newFindings = after.filter((f) => !beforeFingerprints.has(f.fingerprint));
        const isFullyClean = after.length === 0;
        const summary = `Before: ${before.length} finding(s) ➔ After: ${after.length} finding(s) (Resolved: ${resolvedFindings.length}, New: ${newFindings.length})`;
        return {
            beforeCount: before.length,
            afterCount: after.length,
            resolvedFindings,
            remainingFindings,
            newFindings,
            isFullyClean,
            summary,
        };
    }
}
exports.VerificationEngine = VerificationEngine;
//# sourceMappingURL=verificationEngine.js.map