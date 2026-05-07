export function severityToRiskLevel(severity) {
    switch (severity) {
        case "critical":
            return "critical";
        case "high":
            return "high";
        case "medium":
            return "medium";
        default:
            return "low";
    }
}
export function scoreToRiskLevel(score) {
    if (score >= 80) {
        return "critical";
    }
    if (score >= 60) {
        return "high";
    }
    if (score >= 30) {
        return "medium";
    }
    return "low";
}
