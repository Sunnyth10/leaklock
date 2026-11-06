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
exports.SecretCodeActionProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SecretCodeActionProvider {
    static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];
    diagnosticProvider;
    constructor(diagnosticProvider) {
        this.diagnosticProvider = diagnosticProvider;
    }
    provideCodeActions(document, range, context) {
        const actions = [];
        // Check if any diagnostics are from Secret Leak Detector
        const secretDiagnostics = context.diagnostics.filter((d) => d.source === 'Secret Leak Detector');
        if (secretDiagnostics.length === 0) {
            return actions;
        }
        const allFindings = this.diagnosticProvider.getAllFindings();
        for (const diagnostic of secretDiagnostics) {
            // Find matching finding
            const finding = allFindings.find((f) => f.fullPath === document.uri.fsPath &&
                f.line === diagnostic.range.start.line + 1);
            if (!finding)
                continue;
            // QuickFix 1: Move to .env
            const moveToEnvAction = this.createMoveToEnvAction(document, diagnostic.range, finding);
            actions.push(moveToEnvAction);
            // QuickFix 2: Ignore this finding
            const ignoreAction = new vscode.CodeAction('Ignore this finding (False Positive)', vscode.CodeActionKind.QuickFix);
            ignoreAction.command = {
                command: 'secret-leak-detector.ignoreFinding',
                title: 'Ignore Finding',
                arguments: [finding.id],
            };
            actions.push(ignoreAction);
        }
        return actions;
    }
    createMoveToEnvAction(document, range, finding) {
        const action = new vscode.CodeAction(`🛡️ Move ${finding.type} to .env and replace with environment variable`, vscode.CodeActionKind.QuickFix);
        action.isPreferred = true;
        action.command = {
            command: 'secret-leak-detector.remediateFinding',
            title: 'Move to .env',
            arguments: [document.uri, range, finding],
        };
        return action;
    }
    /**
     * Performs the automated extraction to .env and ensures .gitignore protects .env.
     */
    static async executeRemediation(documentUri, range, finding) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found to save .env file.');
            return;
        }
        const workspaceRoot = workspaceFolder.uri.fsPath;
        const envPath = path.join(workspaceRoot, '.env');
        const gitignorePath = path.join(workspaceRoot, '.gitignore');
        // Generate appropriate environment variable name from remediation plan if available
        let envVarName = finding.remediation?.envVarName;
        if (!envVarName) {
            if (finding.type.includes('AWS Access Key'))
                envVarName = 'AWS_ACCESS_KEY_ID';
            else if (finding.type.includes('AWS Secret'))
                envVarName = 'AWS_SECRET_ACCESS_KEY';
            else if (finding.type.includes('GitHub'))
                envVarName = 'GITHUB_TOKEN';
            else if (finding.type.includes('OpenAI'))
                envVarName = 'OPENAI_API_KEY';
            else if (finding.type.includes('Anthropic'))
                envVarName = 'ANTHROPIC_API_KEY';
            else if (finding.type.includes('Stripe'))
                envVarName = 'STRIPE_SECRET_KEY';
            else if (finding.type.includes('Slack'))
                envVarName = 'SLACK_TOKEN';
            else if (finding.type.includes('Database'))
                envVarName = 'DATABASE_URL';
            else {
                envVarName = `${finding.provider.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_API_KEY`;
            }
        }
        // Append to .env
        const envLine = `\n${envVarName}="${finding.rawSecret}"\n`;
        try {
            fs.appendFileSync(envPath, envLine, 'utf8');
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to write to .env: ${err}`);
            return;
        }
        // Ensure .env is added to .gitignore
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            if (!gitignoreContent.includes('.env')) {
                fs.appendFileSync(gitignorePath, '\n# Credentials\n.env\n.env.*.local\n', 'utf8');
            }
        }
        else {
            fs.writeFileSync(gitignorePath, '# Credentials\n.env\n.env.*.local\n', 'utf8');
        }
        // Update .env.example
        const envExamplePath = path.join(workspaceRoot, '.env.example');
        const exampleLine = `${envVarName}=your_${envVarName.toLowerCase()}_here\n`;
        if (!fs.existsSync(envExamplePath) || !fs.readFileSync(envExamplePath, 'utf8').includes(envVarName)) {
            fs.appendFileSync(envExamplePath, exampleLine, 'utf8');
        }
        // Replace the secret in the active file with process.env.<NAME>
        const edit = new vscode.WorkspaceEdit();
        // Replace raw secret with process.env.NAME or "process.env.NAME"
        const replacement = `process.env.${envVarName}`;
        edit.replace(documentUri, range, replacement);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(`✅ Moved ${finding.type} to .env (${envVarName}) and protected in .gitignore!`);
    }
}
exports.SecretCodeActionProvider = SecretCodeActionProvider;
//# sourceMappingURL=codeActionProvider.js.map