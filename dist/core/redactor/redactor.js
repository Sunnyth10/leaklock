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
exports.redactSecret = redactSecret;
exports.generateFingerprint = generateFingerprint;
const crypto = __importStar(require("crypto"));
/**
 * Masks a secret string to prevent secondary leakage in logs, terminals, or dashboards.
 * Preserves initial prefix (e.g. 'AKIA', 'ghp_') and trailing characters when safe.
 */
function redactSecret(secret) {
    if (!secret)
        return '';
    const len = secret.length;
    if (len <= 8) {
        return '••••••••';
    }
    // Preserve up to 4 chars at beginning and 3 chars at end
    const prefixLen = Math.min(4, Math.floor(len / 4));
    const suffixLen = Math.min(3, Math.floor(len / 4));
    const maskLen = Math.max(4, len - prefixLen - suffixLen);
    const prefix = secret.substring(0, prefixLen);
    const suffix = secret.substring(len - suffixLen);
    const mask = '•'.repeat(Math.min(12, maskLen));
    return `${prefix}${mask}${suffix}`;
}
/**
 * Computes an anonymous deterministic SHA-256 fingerprint for a credential.
 * Allows tracking secrets across files, commits, and baselines without persisting plaintext.
 */
function generateFingerprint(secret) {
    return crypto.createHash('sha256').update(secret).digest('hex').substring(0, 16);
}
//# sourceMappingURL=redactor.js.map