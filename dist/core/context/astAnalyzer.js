"use strict";
/**
 * AST and Structural Syntax Analyzer
 * Parses source code lexical tokens to extract object hierarchies,
 * assignment semantics, and call contexts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeAstContext = analyzeAstContext;
const SENSITIVE_PROPERTY_REGEX = /(?:api_?key|secret|token|password|auth|credential|access_?key|private_?key)/i;
const LOGGING_REGEX = /(?:console\.(?:log|warn|error|info|debug)|logger\.|print\(|logging\.)/i;
function analyzeAstContext(contentLines, targetLineZeroBased) {
    const line = contentLines[targetLineZeroBased] || '';
    // 1. Detect Logging / Print statements (Penalize logging benign messages)
    const isLoggingCall = LOGGING_REGEX.test(line);
    // 2. Detect environment variable fallback: process.env.KEY || "hardcoded_secret"
    const isEnvFallback = /(?:process\.env\.[A-Za-z0-9_]+|os\.(?:getenv|environ\.get)\([^)]+\))\s*\|\|\s*["'][^"']+["']/.test(line);
    // 3. Detect Authorization Header: headers: { Authorization: "Bearer ..." }
    const isAuthorizationHeader = /(?:authorization|x-api-key|bearer)\s*[:=]/i.test(line);
    // 4. Detect Nested Object Assignment: config.services.stripe.apiKey = "..."
    const propMatch = line.match(/([a-zA-Z0-9_$.]+)\s*[:=]\s*["'][^"']+["']/) ||
        line.match(/["']([a-zA-Z0-9_.]+)["']\s*:\s*["'][^"']+["']/);
    let variablePath;
    let isSensitiveProperty = false;
    if (propMatch) {
        variablePath = propMatch[1];
        isSensitiveProperty = SENSITIVE_PROPERTY_REGEX.test(variablePath);
    }
    // Determine Scope Type
    let scopeType = 'UNKNOWN';
    if (isEnvFallback) {
        scopeType = 'ENV_FALLBACK';
    }
    else if (isAuthorizationHeader) {
        scopeType = 'HEADER';
    }
    else if (variablePath && variablePath.includes('.')) {
        scopeType = 'OBJECT_PROPERTY';
    }
    else if (variablePath) {
        scopeType = 'VARIABLE_DECLARATION';
    }
    else if (isLoggingCall) {
        scopeType = 'FUNCTION_ARG';
    }
    return {
        variablePath,
        isSensitiveProperty,
        isEnvFallback,
        isAuthorizationHeader,
        isLoggingCall,
        scopeType,
    };
}
//# sourceMappingURL=astAnalyzer.js.map