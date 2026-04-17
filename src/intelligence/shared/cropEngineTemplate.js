import { createActionCollector } from "./actions.js";
import { normalizeEngineWeather } from "./weatherSchema.js";

export const createCropEngine = ({
    cropName,
    resolveContext,
    analyze,
    buildDrivers,
    buildConfidence,
    buildInterpretability,
    buildActions,
    buildExplanation,
    buildRiskDetail
}) => (weatherInput, crop, calibration = {}, irrigation = null) => {
    const context = resolveContext({
        weather: normalizeEngineWeather(weatherInput),
        crop,
        calibration,
        irrigation
    });
    const analysis = analyze(context);
    const analysisWindow = analysis.analysisWindow ?? context.analysisWindow ?? null;
    const driverCandidates = buildDrivers({
        ...context,
        ...analysis
    });
    const confidence = buildConfidence({
        ...context,
        ...analysis
    });
    const riskScore = Math.round(analysis.adjustedScore * 100);
    const actionCollector = createActionCollector();
    const risks = buildActions(
        {
            ...context,
            ...analysis,
            confidence,
            driverCandidates,
            riskScore
        },
        actionCollector
    );
    const recommendedActions = actionCollector.finalize();

    return {
        crop: cropName,
        stage: context.stageContext.stage,
        stageSource: context.stageContext.source,
        riskScore,
        confidenceScore: confidence.score,
        confidence,
        analysisWindow,
        explanation: buildExplanation({
            ...context,
            ...analysis,
            analysisWindow,
            driverCandidates,
            confidence,
            riskScore
        }),
        drivers: driverCandidates.map((driver) => driver.label),
        interpretability: buildInterpretability({
            ...context,
            ...analysis,
            analysisWindow,
            driverCandidates,
            confidence
        }),
        riskDetail: buildRiskDetail({
            ...context,
            ...analysis,
            analysisWindow,
            driverCandidates,
            confidence
        }),
        calibrationWarnings: context.calibrationWarnings,
        risks: risks || [],
        recommendedActions,
        recommendations: recommendedActions.map((action) => action.message)
    };
};
