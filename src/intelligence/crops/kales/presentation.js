import { KALES_MODEL_VERSION } from "./config.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const toPercent = (value) => Math.round(clamp(value) * 100);

const formatList = (items = []) => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const addRisk = (collection, value) => {
    if (value && !collection.includes(value)) collection.push(value);
};

const getRiskBand = (riskScore) => {
    if (riskScore <= 30) return "low";
    if (riskScore <= 60) return "medium";
    if (riskScore <= 80) return "high";
    return "very high";
};

const formatComponentConfidence = (confidence) => formatList([
    `temperature ${confidence.components.temperature.label}`,
    `disease conditions ${confidence.components.diseaseConditions.label}`,
    `water ${confidence.components.water.label}`
]);

export const buildExplanation = ({ stageContext, analysisWindow, driverCandidates, confidence, riskScore }) => {
    const riskBand = getRiskBand(riskScore);
    const timingText = analysisWindow.days
        ? `over the next ${analysisWindow.days} days using current conditions plus forecast`
        : "from current weather only";
    const driverText = driverCandidates.length > 0
        ? `Main drivers: ${formatList(driverCandidates.slice(0, 2).map((d) => d.reason))}.`
        : "No major stress drivers were detected.";

    let confidenceText = `Confidence is ${confidence.label} with ${formatComponentConfidence(confidence)} component confidence`;
    if (confidence.missingInputs.length > 0) {
        confidenceText += ` because ${formatList(confidence.missingInputs)} ${confidence.missingInputs.length === 1 ? "is" : "are"} missing.`;
    } else if (confidence.partialInputs.length > 0) {
        confidenceText += ` with limited coverage for ${formatList(confidence.partialInputs)}.`;
    } else if (stageContext.source === "explicit") {
        confidenceText += " with explicit crop-stage information and complete component inputs.";
    } else {
        confidenceText += " with complete weather inputs, but crop stage is still inferred.";
    }

    return `${riskBand.charAt(0).toUpperCase() + riskBand.slice(1)} kales (sukuma wiki) risk for the ${stageContext.stage} stage ${timingText}. ${driverText} ${confidenceText}`;
};

export const buildInterpretability = ({
    stageContext, mergedCalibration, stageWeight, rawScore, adjustedScore,
    driverCandidates, confidence, diseaseConditionsAnalysis
}) => ({
    topDrivers: driverCandidates.slice(0, 3).map((d) => ({
        label: d.label,
        reason: d.reason,
        contribution: toPercent(d.value)
    })),
    stageAdjustment: {
        method: "stage_weighted_risk_curve",
        multiplier: stageWeight,
        rawScore: toPercent(rawScore),
        adjustedScore: toPercent(adjustedScore),
        effect: Math.round((adjustedScore - rawScore) * 100),
        stageConfidence: Math.round((stageContext.stageConfidence ?? 0) * 100),
        note: "Stage weighting bends the score most in the middle bands so stage context changes urgency without forcing ceiling effects."
    },
    componentImportance: Object.fromEntries(
        Object.entries(mergedCalibration.weights).map(([k, v]) => [k, Math.round(v * 100)])
    ),
    confidence: {
        overall: { score: confidence.score, label: confidence.label },
        components: Object.fromEntries(
            Object.entries(confidence.components).map(([k, v]) => [k, { score: v.score, label: v.label }])
        ),
        componentCoverage: confidence.coverage
    },
    diseaseSignals: {
        humidity:                 toPercent(diseaseConditionsAnalysis.humidityPressure ?? 0),
        observedRainfall:         toPercent(diseaseConditionsAnalysis.currentRainfallPressure ?? 0),
        forecastRainfall:         toPercent(diseaseConditionsAnalysis.forecastRainfallPressure ?? 0),
        wetDays:                  toPercent(diseaseConditionsAnalysis.wetDayPressure ?? 0),
        precipitationProbability: toPercent(diseaseConditionsAnalysis.precipitationProbabilityPressure ?? 0),
        temperatureSuitability:   toPercent(diseaseConditionsAnalysis.temperaturePressure ?? 0),
        airflow:                  toPercent(diseaseConditionsAnalysis.airflowPressure ?? 0)
    }
});

export const buildRiskDetail = ({
    weather, stageContext, analysisWindow, calibrationWarnings, mergedCalibration,
    stageProfile, stageSensitivity, stageWeight, rawScore, adjustedScore, confidence,
    temperatureRisk, diseaseConditionsRisk, waterRisk,
    temperatureAdjusted, diseaseConditionsAdjusted, waterAdjusted,
    temperatureAnalysis, diseaseConditionsAnalysis, waterAnalysis
}) => ({
    modelVersion: KALES_MODEL_VERSION,
    temperature:               toPercent(temperatureRisk),
    diseaseConditions:         toPercent(diseaseConditionsRisk),
    water:                     toPercent(waterRisk),
    temperatureAdjusted:       toPercent(temperatureAdjusted),
    diseaseConditionsAdjusted: toPercent(diseaseConditionsAdjusted),
    waterAdjusted:             toPercent(waterAdjusted),
    stageWeight,
    stageSensitivity,
    stageContext: {
        source:            stageContext.source,
        plantingDateValid: stageContext.plantingDateValid,
        daysSincePlanting: stageContext.daysSincePlanting,
        stageConfidence:   Math.round((stageContext.stageConfidence ?? 0) * 100)
    },
    thresholdModel:    stageProfile,
    weights:           mergedCalibration.weights,
    calibrationWarnings,
    rawScore:          toPercent(rawScore),
    adjustedScore:     toPercent(adjustedScore),
    confidence,
    forecast: {
        basis:   analysisWindow.basis,
        summary: weather?.forecastSummary || {}
    },
    components: {
        temperature: {
            currentValue:     weather?.temperature ?? null,
            currentRisk:      toPercent(temperatureAnalysis.currentRisk ?? 0),
            forecastHeatRisk: toPercent(temperatureAnalysis.forecastHeatRisk ?? 0),
            forecastColdRisk: toPercent(temperatureAnalysis.forecastColdRisk ?? 0),
            combinedRisk:     toPercent(temperatureRisk),
            thresholds:       stageProfile.temperature
        },
        diseaseConditions: {
            humidityPressure:                 toPercent(diseaseConditionsAnalysis.humidityPressure ?? 0),
            currentRainfallPressure:          toPercent(diseaseConditionsAnalysis.currentRainfallPressure ?? 0),
            forecastRainfallPressure:         toPercent(diseaseConditionsAnalysis.forecastRainfallPressure ?? 0),
            rainfallPressure:                 toPercent(diseaseConditionsAnalysis.rainfallPressure ?? 0),
            wetDayPressure:                   toPercent(diseaseConditionsAnalysis.wetDayPressure ?? 0),
            precipitationProbabilityPressure: toPercent(diseaseConditionsAnalysis.precipitationProbabilityPressure ?? 0),
            temperaturePressure:              toPercent(diseaseConditionsAnalysis.temperaturePressure ?? 0),
            airflowPressure:                  toPercent(diseaseConditionsAnalysis.airflowPressure ?? 0),
            moisturePressure:                 toPercent(diseaseConditionsAnalysis.moisturePressure ?? 0),
            combinedRisk:                     toPercent(diseaseConditionsRisk),
            thresholds:                       stageProfile.diseaseConditions
        },
        water: {
            rainfallRisk:           toPercent(waterAnalysis.rainfallRisk),
            adjustedRainfallRisk:   toPercent(waterRisk),
            hasIrrigation:          waterAnalysis.hasIrrigation,
            irrigationMitigatesRisk: waterAnalysis.irrigationMitigatesRisk,
            irrigationContext:      waterAnalysis.irrigationContext
        }
    },
    waterAnalysis: {
        growthStage:             waterAnalysis.growthStage,
        growthStageSource:       waterAnalysis.growthStageSource,
        hasIrrigation:           waterAnalysis.hasIrrigation,
        irrigationMitigatesRisk: waterAnalysis.irrigationMitigatesRisk,
        rainfallRiskReduction:   Math.round((waterAnalysis.rainfallRisk - waterRisk) * 100),
        waterRequirements:       waterAnalysis.waterRequirements,
        actionPlan:              waterAnalysis.recommendedActions
    }
});

export const buildActions = ({
    stageContext, temperatureAdjusted, diseaseConditionsAdjusted,
    waterAnalysis, stageProfile, adjustedScore, confidence, riskScore, weather
}, actionCollector) => {
    const risks = [];

    if (temperatureAdjusted > 0.5) {
        addRisk(risks, "Temperature stress");

        const hottestDay = weather?.forecastSummary?.hottestDay ?? weather?.temperature ?? null;
        const coolestNight = weather?.forecastSummary?.coolestNight ?? weather?.temperature ?? null;

        if (hottestDay !== null && hottestDay >= stageProfile.temperature.mildHeat) {
            actionCollector.add(
                stageContext.stage === "Vegetative"
                    ? "Heat stress risk for sukuma wiki — temperatures above 25°C can trigger bolting and reduce leaf quality. Increase irrigation frequency and consider shade netting during peak heat."
                    : "Reduce heat stress on kales with irrigation and mulching to maintain soil moisture and moderate temperature.",
                {
                    key: stageContext.stage === "Vegetative" ? "kales_heat_bolting_risk" : "kales_heat_stress",
                    why: "Forecast temperatures exceed the kales heat threshold. Kales are a cool-season crop and bolt under sustained heat.",
                    priority: stageContext.stage === "Vegetative" ? "immediate" : "soon",
                    category: "temperature",
                    timing: stageContext.stage === "Vegetative" ? "within 24 hours" : "before the hottest period",
                    score: stageContext.stage === "Vegetative" ? 90 : 72
                }
            );
        } else if (coolestNight !== null && coolestNight <= stageProfile.temperature.mildCold) {
            actionCollector.add(
                "Protect kales from cold stress with mulch. While kales tolerate mild cold better than most crops, frost or sustained cold can damage young leaves.",
                {
                    key: "kales_cold_stress",
                    why: "Cool conditions fall below the kales stage cold threshold.",
                    priority: "monitor",
                    category: "temperature",
                    timing: "before the next cool night",
                    score: 58
                }
            );
        }
    }

    if (diseaseConditionsAdjusted > 0.45) {
        addRisk(risks, "Disease-conducive conditions");
        actionCollector.add(
            "Scout for Black rot, Downy mildew, and Alternaria leaf spot. These diseases are favored by cool, wet conditions common in kale-growing areas.",
            {
                key: "kales_disease_conditions_scout",
                why: "Weather signals are favorable for brassica foliar diseases, not confirmed disease presence.",
                priority: "soon",
                category: "disease_conditions",
                timing: "over the next 24-48 hours",
                score: 68
            }
        );
        actionCollector.add(
            "Avoid overhead irrigation during evening hours and improve canopy airflow to reduce leaf wetness duration.",
            {
                key: "kales_disease_conditions_moisture",
                why: "Prolonged leaf wetness in cool conditions promotes Downy mildew and Black rot spread in kales.",
                priority: "monitor",
                category: "disease_conditions",
                timing: "during the current scouting cycle",
                score: 58
            }
        );
    }

    if (waterAnalysis.risk) {
        addRisk(risks, waterAnalysis.risk);
    }

    actionCollector.merge(waterAnalysis.actionPlan);

    if (stageContext.stage === "Vegetative" && adjustedScore >= 0.7) {
        addRisk(risks, "Critical leaf development stress");
        actionCollector.add(
            waterAnalysis.hasIrrigation
                ? "Maintain consistent irrigation through the vegetative stage — leaf size, yield, and quality depend heavily on stable moisture and cool temperatures now."
                : "Prioritize water management during the vegetative stage as this is when leaf yield and quality are determined for sukuma wiki.",
            {
                key: "kales_stage_critical_vegetative",
                why: "The vegetative stage is the primary yield-determining stage for kales — stress now directly reduces harvestable leaf mass.",
                priority: "immediate",
                category: "stage_critical",
                timing: "today",
                score: 93
            }
        );
    }

    if (confidence.score < 70) {
        addRisk(risks, "Lower confidence due to missing agronomic or weather inputs");
        actionCollector.add(
            "Capture planting date or confirm growth stage, plus irrigation context and missing weather inputs, to improve kales risk confidence.",
            {
                key: "kales_data_quality",
                why: "The engine is using inferred or incomplete inputs in one or more components.",
                priority: "monitor",
                category: "data_quality",
                timing: "before the next analysis cycle",
                score: 48
            }
        );
    }

    if (riskScore <= 30) {
        actionCollector.add("Overall kales (sukuma wiki) risk is low. Continue standard monitoring.", {
            key: "kales_overall_low",
            why: "No major component is showing sustained stress.",
            priority: "routine",
            category: "overall",
            timing: "this week",
            score: 20
        });
    } else if (riskScore <= 60) {
        actionCollector.add("Overall kales risk is moderate. Increase scouting frequency and prepare interventions.", {
            key: "kales_overall_moderate",
            why: "At least one stress component is elevated enough to justify closer monitoring.",
            priority: "monitor",
            category: "overall",
            timing: "within 48 hours",
            score: 38
        });
    } else {
        actionCollector.add("Overall kales (sukuma wiki) risk is high. Prioritize mitigation actions immediately.", {
            key: "kales_overall_high",
            why: "Multiple stress components or a stage-critical stress signal are elevated.",
            priority: "soon",
            category: "overall",
            timing: "today",
            score: 62
        });
    }

    return risks;
};
