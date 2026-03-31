const uniqueItems = (items = []) => [...new Set(items.filter(Boolean))];

export const getConfidenceLabel = (score) => {
    if (score >= 90) return "high";
    if (score >= 70) return "medium";
    return "low";
};

export const buildConfidenceDimension = (signals = []) => {
    const weightedSignals = signals.filter((signal) => signal.weight > 0);
    const totalWeight = weightedSignals.reduce((sum, signal) => sum + signal.weight, 0);
    const weightedScore = weightedSignals.reduce((sum, signal) => sum + signal.weight * signal.coverage, 0);
    const score = totalWeight > 0
        ? Math.round((weightedScore / totalWeight) * 100)
        : 0;

    return {
        score,
        label: getConfidenceLabel(score),
        missingInputs: weightedSignals
            .filter((signal) => signal.coverage === 0)
            .map((signal) => signal.label),
        partialInputs: weightedSignals
            .filter((signal) => signal.coverage > 0 && signal.coverage < 1)
            .map((signal) => signal.label),
        coverage: Object.fromEntries(
            weightedSignals.map((signal) => [signal.id, Math.round(signal.coverage * 100)])
        )
    };
};

export const buildComponentAlignedConfidence = ({
    componentSignals = {},
    componentWeights = {}
}) => {
    const components = Object.fromEntries(
        Object.entries(componentSignals).map(([componentId, signals]) => [
            componentId,
            buildConfidenceDimension(signals)
        ])
    );
    const weightedEntries = Object.entries(components)
        .map(([componentId, component]) => ({
            componentId,
            score: component.score,
            weight: componentWeights[componentId] ?? 0
        }))
        .filter((entry) => entry.weight > 0);
    const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
    const score = totalWeight > 0
        ? Math.round(
            weightedEntries.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / totalWeight
        )
        : 0;

    return {
        score,
        label: getConfidenceLabel(score),
        missingInputs: uniqueItems(
            Object.values(components).flatMap((component) => component.missingInputs)
        ),
        partialInputs: uniqueItems(
            Object.values(components).flatMap((component) => component.partialInputs)
        ),
        coverage: Object.fromEntries(
            Object.entries(components).map(([componentId, component]) => [componentId, component.coverage])
        ),
        components
    };
};
