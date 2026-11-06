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
exports.BaselineEngine = exports.DEFAULT_BASELINE_FILENAME = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.DEFAULT_BASELINE_FILENAME = '.secretleak-baseline.json';
class BaselineEngine {
    baselinePath;
    constructor(workspaceRoot, customFilename = exports.DEFAULT_BASELINE_FILENAME) {
        this.baselinePath = path.isAbsolute(customFilename)
            ? customFilename
            : path.join(workspaceRoot, customFilename);
    }
    exists() {
        return fs.existsSync(this.baselinePath);
    }
    loadBaseline() {
        try {
            if (!this.exists())
                return null;
            const data = fs.readFileSync(this.baselinePath, 'utf8');
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    saveBaseline(findings) {
        const baselineFindings = findings.map((f) => ({
            id: f.id,
            fingerprint: f.fingerprint,
            ruleId: f.type,
            file: f.file,
            line: f.line,
            firstSeen: f.detectedAt,
        }));
        const file = {
            version: 1,
            generatedAt: new Date().toISOString(),
            generator: 'Secret Leak Detector v1.0.0',
            findings: baselineFindings,
        };
        fs.writeFileSync(this.baselinePath, JSON.stringify(file, null, 2), 'utf8');
        return file;
    }
    filterAgainstBaseline(currentFindings) {
        const baseline = this.loadBaseline();
        if (!baseline) {
            return {
                newFindings: currentFindings,
                existingFindings: [],
                resolvedCount: 0,
                totalBaseline: 0,
            };
        }
        const baselineMap = new Map();
        for (const b of baseline.findings) {
            // Key by fingerprint or file+rule
            baselineMap.set(b.fingerprint, b);
            baselineMap.set(`${b.file}:${b.ruleId}:${b.line}`, b);
        }
        const newFindings = [];
        const existingFindings = [];
        const matchedFingerprints = new Set();
        for (const finding of currentFindings) {
            const match = baselineMap.get(finding.fingerprint) ||
                baselineMap.get(`${finding.file}:${finding.type}:${finding.line}`);
            if (match) {
                finding.status = 'BASELINE';
                existingFindings.push(finding);
                matchedFingerprints.add(match.fingerprint);
            }
            else {
                newFindings.push(finding);
            }
        }
        const resolvedCount = Math.max(0, baseline.findings.length - matchedFingerprints.size);
        return {
            newFindings,
            existingFindings,
            resolvedCount,
            totalBaseline: baseline.findings.length,
        };
    }
}
exports.BaselineEngine = BaselineEngine;
//# sourceMappingURL=baselineEngine.js.map