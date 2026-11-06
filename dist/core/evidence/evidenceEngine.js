"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEvidenceModel = buildEvidenceModel;
const entropy_1 = require("../entropy/entropy");
const falsePositiveClassifier_1 = require("../classifier/falsePositiveClassifier");
const validators_1 = require("../detectors/validators");
function buildEvidenceModel(rule, rawSecret, fileContext, lexicalContext, filePath, astContext) {
    const items = [];
    let confidence = rule.baseConfidence;
    // 1. Pattern Signal
    items.push({
        signal: 'KNOWN_PATTERN_MATCH',
        description: `Matched recognized credential signature for ${rule.provider} (${rule.name})`,
        confidenceImpact: 0,
        details: { ruleId: rule.id, provider: rule.provider },
    });
    // 2. Entropy Signal
    const shannonEntropy = (0, entropy_1.calculateShannonEntropy)(rawSecret);
    const normalizedEntropy = (0, entropy_1.calculateNormalizedEntropy)(rawSecret);
    const { setName } = (0, entropy_1.detectCharacterSet)(rawSecret);
    if (shannonEntropy >= 4.5) {
        confidence = Math.min(100, confidence + 5);
        items.push({
            signal: 'HIGH_ENTROPY',
            description: `Cryptographic entropy: ${shannonEntropy} bits/char (${setName} set), indicates non-human randomness`,
            confidenceImpact: +5,
            details: { shannonEntropy, normalizedEntropy, characterSet: setName },
        });
    }
    else if (shannonEntropy >= 3.4) {
        items.push({
            signal: 'MODERATE_ENTROPY',
            description: `Moderate entropy: ${shannonEntropy} bits/char (${setName} set)`,
            confidenceImpact: 0,
            details: { shannonEntropy, normalizedEntropy, characterSet: setName },
        });
    }
    else {
        // If entropy is low and the rule requires minEntropy
        if (rule.minEntropy && shannonEntropy < rule.minEntropy) {
            confidence = Math.max(10, confidence - 30);
            items.push({
                signal: 'LOW_ENTROPY',
                description: `Low entropy score: ${shannonEntropy} bits/char below minimum threshold of ${rule.minEntropy}`,
                confidenceImpact: -30,
                details: { shannonEntropy, minEntropy: rule.minEntropy },
            });
        }
    }
    // 3. Variable Identifier & AST Context Signal
    if (lexicalContext.isSensitiveIdentifier || astContext?.isSensitiveProperty) {
        const varName = astContext?.variablePath || lexicalContext.inferredVariable || 'credential';
        confidence = Math.min(100, confidence + 10);
        items.push({
            signal: 'SENSITIVE_IDENTIFIER',
            description: `Assigned to sensitive identifier / property: '${varName}'`,
            confidenceImpact: +10,
            details: { identifier: varName },
        });
    }
    else if (lexicalContext.isBenignIdentifier) {
        confidence = Math.max(10, confidence - 25);
        items.push({
            signal: 'BENIGN_IDENTIFIER',
            description: `Identifier name indicates mock or sample value: '${lexicalContext.inferredVariable}'`,
            confidenceImpact: -25,
            details: { identifier: lexicalContext.inferredVariable },
        });
    }
    // AST: Env fallback or header context
    if (astContext?.isEnvFallback) {
        confidence = Math.min(100, confidence + 12);
        items.push({
            signal: 'ENV_FALLBACK_ASSIGNMENT',
            description: 'Hardcoded literal provided as environment variable fallback (e.g. process.env.KEY || "...")',
            confidenceImpact: +12,
        });
    }
    if (astContext?.isAuthorizationHeader) {
        confidence = Math.min(100, confidence + 10);
        items.push({
            signal: 'AUTHORIZATION_HEADER',
            description: 'Passed in HTTP Authorization or Bearer token header context',
            confidenceImpact: +10,
        });
    }
    // 4. File Context Signal
    if (fileContext.isConfig || fileContext.isSensitiveName) {
        confidence = Math.min(100, confidence + 8);
        items.push({
            signal: 'PRODUCTION_CONFIG_FILE',
            description: `Located in configuration or secret storage file (${fileContext.fileExtension})`,
            confidenceImpact: +8,
            details: { isConfig: fileContext.isConfig, extension: fileContext.fileExtension },
        });
    }
    if (fileContext.isTest) {
        confidence = Math.max(20, confidence - 20);
        items.push({
            signal: 'TEST_FILE_PENALTY',
            description: 'Found inside test/mock directory structure',
            confidenceImpact: -20,
        });
    }
    if (fileContext.isDoc) {
        confidence = Math.max(20, confidence - 25);
        items.push({
            signal: 'DOCUMENTATION_PENALTY',
            description: 'Found inside documentation or markdown guide',
            confidenceImpact: -25,
        });
    }
    // 5. Provider-Specific Structural Validation
    let valRes;
    if (rule.id === 'aws-access-key')
        valRes = (0, validators_1.validateAwsAccessKey)(rawSecret);
    else if (rule.id === 'stripe-secret-key')
        valRes = (0, validators_1.validateStripeKey)(rawSecret);
    else if (rule.id === 'github-pat')
        valRes = (0, validators_1.validateGitHubToken)(rawSecret);
    else if (rule.id === 'jwt-token')
        valRes = (0, validators_1.validateJwtToken)(rawSecret);
    else if (rule.id === 'database-url')
        valRes = (0, validators_1.validateDatabaseUrl)(rawSecret);
    if (valRes && valRes.isValid) {
        confidence = Math.min(100, confidence + valRes.confidenceBonus);
        items.push({
            signal: 'STRUCTURAL_VALIDATION_PASSED',
            description: `Structural validation verified: ${valRes.reason}`,
            confidenceImpact: valRes.confidenceBonus,
        });
    }
    // 6. False Positive & Placeholder Check
    const fpCheck = (0, falsePositiveClassifier_1.evaluateFalsePositive)(rawSecret, lexicalContext.inferredVariable, filePath);
    if (fpCheck.isFalsePositive) {
        return {
            confidence: 0,
            evidence: {
                items: [
                    {
                        signal: 'KNOWN_PLACEHOLDER_REJECTED',
                        description: fpCheck.reason || 'Placeholder value rejected',
                        confidenceImpact: -100,
                    },
                ],
                shannonEntropy,
                normalizedEntropy,
                characterSet: setName,
                surroundingCode: {
                    before: lexicalContext.surroundingBefore,
                    targetLine: lexicalContext.matchedLine,
                    after: lexicalContext.surroundingAfter,
                    inferredVariable: lexicalContext.inferredVariable,
                },
                fileContext: {
                    fileExtension: fileContext.fileExtension,
                    isConfig: fileContext.isConfig,
                    isTest: fileContext.isTest,
                    isDoc: fileContext.isDoc,
                    isSensitiveName: fileContext.isSensitiveName,
                    isExampleOrSample: fileContext.isExampleOrSample,
                },
            },
            isSuppressed: true,
            suppressReason: fpCheck.reason,
        };
    }
    if (fpCheck.confidencePenalty > 0) {
        confidence = Math.max(10, confidence - fpCheck.confidencePenalty);
    }
    const finalConfidence = Math.max(0, Math.min(100, Math.round(confidence)));
    const evidenceModel = {
        items,
        shannonEntropy,
        normalizedEntropy,
        characterSet: setName,
        surroundingCode: {
            before: lexicalContext.surroundingBefore,
            targetLine: lexicalContext.matchedLine,
            after: lexicalContext.surroundingAfter,
            inferredVariable: lexicalContext.inferredVariable,
        },
        fileContext: {
            fileExtension: fileContext.fileExtension,
            isConfig: fileContext.isConfig,
            isTest: fileContext.isTest,
            isDoc: fileContext.isDoc,
            isSensitiveName: fileContext.isSensitiveName,
            isExampleOrSample: fileContext.isExampleOrSample,
        },
    };
    return {
        confidence: finalConfidence,
        evidence: evidenceModel,
        isSuppressed: false,
    };
}
//# sourceMappingURL=evidenceEngine.js.map