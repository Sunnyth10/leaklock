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
exports.DiagnosticProvider = void 0;
const vscode = __importStar(require("vscode"));
const scanner_1 = require("../engine/scanner");
class DiagnosticProvider {
    diagnosticCollection;
    currentFindings = new Map();
    onFindingsChangedEmitter = new vscode.EventEmitter();
    onFindingsChanged = this.onFindingsChangedEmitter.event;
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('secret-leak-detector');
    }
    getDiagnosticCollection() {
        return this.diagnosticCollection;
    }
    getAllFindings() {
        const findings = [];
        for (const fileFindings of this.currentFindings.values()) {
            findings.push(...fileFindings);
        }
        return findings;
    }
    clear() {
        this.diagnosticCollection.clear();
        this.currentFindings.clear();
        this.onFindingsChangedEmitter.fire([]);
    }
    scanDocument(document) {
        // Skip virtual or output documents
        if (document.uri.scheme !== 'file') {
            return [];
        }
        const text = document.getText();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        const findings = (0, scanner_1.scanContent)(text, document.uri.fsPath, workspaceRoot);
        this.currentFindings.set(document.uri.fsPath, findings);
        const diagnostics = [];
        for (const finding of findings) {
            const line = Math.max(0, finding.line - 1);
            const startCol = Math.max(0, finding.column - 1);
            const endCol = startCol + finding.length;
            const range = new vscode.Range(line, startCol, line, endCol);
            let severity = vscode.DiagnosticSeverity.Warning;
            if (finding.risk === 'CRITICAL' || finding.risk === 'HIGH') {
                severity = vscode.DiagnosticSeverity.Error;
            }
            else if (finding.risk === 'LOW') {
                severity = vscode.DiagnosticSeverity.Information;
            }
            const diagnostic = new vscode.Diagnostic(range, `[Secret Leak Detector] ${finding.type} detected! Confidence: ${finding.confidence}%. ${finding.remediation}`, severity);
            diagnostic.code = {
                value: finding.id,
                target: vscode.Uri.parse('https://github.com/MokuLakshithReddy/Secret_Leak_Detector'),
            };
            diagnostic.source = 'Secret Leak Detector';
            diagnostics.push(diagnostic);
        }
        this.diagnosticCollection.set(document.uri, diagnostics);
        this.onFindingsChangedEmitter.fire(this.getAllFindings());
        return findings;
    }
    removeDocument(uri) {
        this.diagnosticCollection.delete(uri);
        this.currentFindings.delete(uri.fsPath);
        this.onFindingsChangedEmitter.fire(this.getAllFindings());
    }
    dispose() {
        this.diagnosticCollection.dispose();
        this.onFindingsChangedEmitter.dispose();
    }
}
exports.DiagnosticProvider = DiagnosticProvider;
//# sourceMappingURL=diagnosticProvider.js.map