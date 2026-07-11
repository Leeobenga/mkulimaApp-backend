import { CABBAGE_MODEL_VERSION } from "./config.js";

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

    return `${riskBand.charAt(0).toUpperCase() + riskBand.slice(1)} cabbage risk for the ${stageContext.stage} stage ${timingText}. ${driverText} ${confidenceText}`;
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
    modelVersion: CABBAGE_MODEL_VERSION,
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
            rainfallRisk:            toPercent(waterAnalysis.rainfallRisk),
            adjustedRainfallRisk:    toPercent(waterRisk),
            hasIrrigation:           waterAnalysis.hasIrrigation,
            irrigationMitigatesRisk: waterAnalysis.irrigationMitigatesRisk,
            irrigationContext:       waterAnalysis.irrigationContext
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
                stageContext.stage === "Reproductive"
                    ? "Heat above 23°C during heading is preventing proper head formation — cabbage heads may remain open, split, or bolt. Increase irrigation frequency and consider shade where feasible."
                    : "High temperatures are stressing cabbage. Maintain steady irrigation and mulch to moderate soil temperature.",
                {
                    key: stageContext.stage === "Reproductive" ? "cabbage_heat_heading" : "cabbage_heat_stress",
                    why: "Cabbage requires cool temperatures for tight head formation. Heat above the stage threshold causes bolting, splitting, and tip burn.",
                    priority: stageContext.stage === "Reproductive" ? "immediate" : "soon",
                    category: "temperature",
                    timing: stageContext.stage === "Reproductive" ? "within 24 hours" : "before the hottest period",
                    score: stageContext.stage === "Reproductive" ? 88 : 70
                }
            );
        } else if (coolestNight !== null && coolestNight <= stageProfile.temperature.mildCold) {
            actionCollector.add(
                "Cold nights are slowing cabbage growth. Protect transplants with mulch and avoid stressing plants with excessive irrigation during cold spells.",
                {
                    key: "cabbage_cold_stress",
                    why: "While cabbage tolerates light frost, sustained cold slows leaf production and delays heading.",
                    priority: "monitor",
                    category: "temperature",
                    timing: "before the next cool night",
                    score: 54
                }
            );
        }
    }

    if (diseaseConditionsAdjusted > 0.45) {
        addRisk(risks, "Disease-conducive conditions");
        actionCollector.add(
            "Scout for Black rot, Downy mildew, and Alternaria leaf spot — all three are common in cabbage under the current weather conditions.",
            {
                key: "cabbage_disease_conditions_scout",
                why: "Current humidity and temperature are within the favorable range for brassica foliar diseases. Black rot in particular spreads quickly through water splash.",
                priority: "soon",
                category: "disease_conditions",
                timing: "within 24 hours",
                score: 74
            }
        );
        actionCollector.add(
            "Avoid wetting the inner head during irrigation, improve row spacing for airflow, and remove and destroy any infected leaves immediately.",
            {
                key: "cabbage_disease_conditions_manage",
                why: "The dense canopy structure of cabbage heads traps moisture and accelerates disease spread once established.",
                priority: "monitor",
                category: "disease_conditions",
                timing: "during the current scouting cycle",
                score: 62
            }
        );
    }

    if (waterAnalysis.risk) {
        addRisk(risks, waterAnalysis.risk);
    }

    actionCollector.merge(waterAnalysis.actionPlan);

    if (stageContext.stage === "Reproductive" && adjustedScore >= 0.6) {
        addRisk(risks, "Critical head formation stress");
        actionCollector.add(
            waterAnalysis.hasIrrigation
                ? "Maintain consistent, even irrigation during head formation — irregular moisture causes tip burn and head splitting which reduces marketable yield."
                : "Ensure steady water supply during head formation — drought stress at this stage causes irreversible tip burn and poor head density.",
            {
                key: "cabbage_stage_critical_heading",
                why: "Head quality and density are determined during the Reproductive stage. Water or heat stress here cannot be recovered from.",
                priority: "immediate",
                category: "stage_critical",
                timing: "today",
                score: 91
            }
        );
    }

    if (confidence.score < 70) {
        addRisk(risks, "Lower confidence due to missing agronomic or weather inputs");
        actionCollector.add(
            "Capture planting date or confirm growth stage, plus irrigation context and missing weather inputs, to improve cabbage risk confidence.",
            {
                key: "cabbage_data_quality",
                why: "The engine is using inferred or incomplete inputs in one or more components.",
                priority: "monitor",
                category: "data_quality",
                timing: "before the next analysis cycle",
                score: 48
            }
        );
    }

    if (riskScore <= 30) {
        actionCollector.add("Overall cabbage risk is low. Continue standard monitoring.", {
            key: "cabbage_overall_low",
            why: "No major component is showing sustained stress.",
            priority: "routine",
            category: "overall",
            timing: "this week",
            score: 20
        });
    } else if (riskScore <= 60) {
        actionCollector.add("Overall cabbage risk is moderate. Increase scouting frequency and prepare interventions.", {
            key: "cabbage_overall_moderate",
            why: "At least one stress component is elevated enough to justify closer monitoring.",
            priority: "monitor",
            category: "overall",
            timing: "within 48 hours",
            score: 38
        });
    } else {
        actionCollector.add("Overall cabbage risk is high. Prioritize mitigation actions immediately.", {
            key: "cabbage_overall_high",
            why: "Multiple stress components or a stage-critical stress signal are elevated.",
            priority: "soon",
            category: "overall",
            timing: "today",
            score: 62
        });
    }

    return risks;
};
