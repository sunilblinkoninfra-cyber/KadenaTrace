// errors.ts -- Structured error codes for API responses and type-safe error handling
export class KadenaTraceError extends Error {
    code;
    statusCode;
    details;
    timestamp;
    requestId;
    constructor(code, message, statusCode, details, requestId) {
        super(message);
        this.name = "KadenaTraceError";
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.requestId = requestId ?? generateRequestId();
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            requestId: this.requestId,
            timestamp: this.timestamp
        };
    }
}
// Error factory functions for consistent error creation
export const Errors = {
    rateLimitExceeded: (retryAfter) => new KadenaTraceError("RATE_LIMIT_EXCEEDED", `Rate limit exceeded. Please retry after ${retryAfter ?? 60} seconds.`, 429, { retryAfter }),
    providerTimeout: (provider, operation) => new KadenaTraceError("PROVIDER_TIMEOUT", `Provider ${provider} timed out during ${operation}.`, 504, { provider, operation }),
    providerError: (provider, error) => new KadenaTraceError("PROVIDER_ERROR", `Provider ${provider} returned an error.`, 502, { provider, error: String(error) }),
    invalidSeedFormat: (seedValue, expectedFormat) => new KadenaTraceError("INVALID_SEED_FORMAT", `Invalid seed format: ${seedValue}. Expected: ${expectedFormat}`, 400, { seedValue, expectedFormat }),
    invalidChain: (chain, supported) => new KadenaTraceError("INVALID_CHAIN", `Unsupported chain: ${chain}. Supported: ${supported.join(", ")}`, 400, { chain, supported }),
    traceNotFound: (traceId) => new KadenaTraceError("TRACE_NOT_FOUND", `Trace with ID ${traceId} was not found.`, 404, { traceId }),
    caseNotFound: (caseId) => new KadenaTraceError("CASE_NOT_FOUND", `Case with ID ${caseId} was not found.`, 404, { caseId }),
    duplicateCase: (caseId) => new KadenaTraceError("DUPLICATE_CASE", `A case with ID ${caseId} already exists.`, 409, { caseId }),
    unauthorized: (resource) => new KadenaTraceError("UNAUTHORIZED", `Unauthorized access to ${resource}.`, 401, { resource }),
    forbidden: (operation) => new KadenaTraceError("FORBIDDEN", `Operation ${operation} is forbidden.`, 403, { operation }),
    validationError: (field, message, value) => new KadenaTraceError("VALIDATION_ERROR", `Validation failed for ${field}: ${message}`, 400, { field, message, value }),
    pactSubmissionFailed: (error) => new KadenaTraceError("PACT_SUBMISSION_FAILED", "Failed to submit transaction to Kadena chain.", 502, { error: String(error) }),
    pactPreflightFailed: (error) => new KadenaTraceError("PACT_PREFLIGHT_FAILED", "Transaction preflight check failed.", 400, { error: String(error) }),
    walletConnectionError: (wallet, error) => new KadenaTraceError("WALLET_CONNECTION_ERROR", `Failed to connect to wallet ${wallet}.`, 400, { wallet, error: String(error) }),
    bridgeResolutionFailed: (bridgeTransferId) => new KadenaTraceError("BRIDGE_RESOLUTION_FAILED", `Failed to resolve bridge transfer ${bridgeTransferId}.`, 502, { bridgeTransferId }),
    graphPruned: (originalNodes, retainedNodes) => new KadenaTraceError("GRAPH_PRUNED", `Graph was pruned from ${originalNodes} to ${retainedNodes} nodes for performance.`, 200, // Not an error, but informational
    { originalNodes, retainedNodes, warning: true }),
    maxNodesExceeded: (maxNodes) => new KadenaTraceError("MAX_NODES_EXCEEDED", `Trace exceeded maximum node limit of ${maxNodes}.`, 400, { maxNodes }),
    internalError: (operation, error) => new KadenaTraceError("INTERNAL_ERROR", `An internal error occurred during ${operation}.`, 500, { operation, error: String(error) })
};
function generateRequestId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}
// Error response builder for Fastify
export function buildErrorResponse(error) {
    if (error instanceof KadenaTraceError) {
        return {
            statusCode: error.statusCode,
            body: error.toJSON()
        };
    }
    const genericError = new KadenaTraceError("INTERNAL_ERROR", error instanceof Error ? error.message : "An unknown error occurred", 500);
    return {
        statusCode: 500,
        body: genericError.toJSON()
    };
}
// Retry configuration for transient errors
export const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableCodes: ["PROVIDER_TIMEOUT", "PROVIDER_ERROR", "PACT_SUBMISSION_FAILED"]
};
export function shouldRetry(error) {
    return RETRY_CONFIG.retryableCodes.includes(error);
}
export function calculateRetryDelay(attempt) {
    const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
    return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}
