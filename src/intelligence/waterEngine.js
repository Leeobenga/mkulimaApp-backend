import { resolveGrowthStage } from "./cropStage.js";
import { createActionCollector } from "./shared/actions.js";
import { normalizeEngineWeather } from "./shared/weatherSchema.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const interpolate = (value, inputMin, inputMax, outputMin, outputMax) => {
    if (inputMax === inputMin) {
        return outputMax;
    }

    const ratio = clamp((value - inputMin) / (inputMax - inputMin));
    return outputMin + ratio * (outputMax - outputMin);
};

const toRainfallRisk = (rainfall) => {
    if (rainfall < 5) return 0.9; // severe water stress
    if (rainfall < 15) return 0.5; // moderate water stress
    if (rainfall <= 30) return 0.2; // acceptable
    return 0.1; // abundant water, low water stress
};

const getCropWaterRequirements = (cropType) => {
    const requirements = {
        maize: { sensitivity: 'high', criticalStages: ['Reproductive'] },
        beans: { sensitivity: 'medium', criticalStages: ['Reproductive', 'PodFill'] },
        wheat: { sensitivity: 'medium', criticalStages: ['Reproductive'] },
        rice: { sensitivity: 'very_high', criticalStages: ['Reproductive', 'GrainFill'] },
        unknown: { sensitivity: 'medium', criticalStages: ['Reproductive'] }
    };
    return requirements[cropType] || requirements.unknown;
};

const toIrrigationSupportFactor = (irrigation = {}) => {
    if (irrigation?.available !== true) {
        return 0;
    }

    return interpolate(irrigation.qualityCoverage ?? 0, 0, 1, 0.7, 1);
};

export const getWaterAvailability = (weatherInput, crop, irrigation, cropType = 'unknown') => {
    const weather = normalizeEngineWeather(weatherInput);
    const rainfall = weather?.rainfall?.analysisWindowMm ?? null;

    const stageContext = resolveGrowthStage(crop);
    const growthStage = stageContext.stage;
    const waterRequirements = getCropWaterRequirements(cropType);
    const irrigationContext = irrigation && typeof irrigation === "object" ? irrigation : {};
    const hasIrrigation = irrigationContext.available === true;
    const irrigationSupportFactor = toIrrigationSupportFactor(irrigationContext);
    const rainfallRisk = rainfall === null ? 0 : toRainfallRisk(rainfall);
    const actionCollector = createActionCollector();
    const cropName = cropType.charAt(0).toUpperCase() + cropType.slice(1);
    const stageMessage = growthStage !== "Unknown" ? ` during ${growthStage} stage` : "";

    let adjustedRainfallRisk = rainfallRisk;
    let irrigationRiskReduction = 0;
    if (hasIrrigation && rainfallRisk > 0.3) {
        irrigationRiskReduction = Math.min(0.5, rainfallRisk * 0.6 * irrigationSupportFactor);
        adjustedRainfallRisk = Math.max(0, rainfallRisk - irrigationRiskReduction);
    }

    if (waterRequirements.criticalStages.includes(growthStage)) {
        adjustedRainfallRisk = Math.min(1, adjustedRainfallRisk * 1.3);
    }

    const waterAnalysis = {
        rainfallRisk,
        adjustedRainfallRisk,
        hasIrrigation,
        irrigationMitigatesRisk: irrigationRiskReduction > 0,
        irrigationRiskReduction,
        irrigationSupportFactor,
        irrigationContext,
        growthStage,
        growthStageSource: stageContext.source,
        cropType,
        waterRequirements,
        forecastSummary: weather?.forecastSummary || {}
    };

    if (rainfall !== null && rainfallRisk > 0.5) {
        waterAnalysis.risk = "Water availability risk";

        if (rainfall < 5) {
            if (hasIrrigation) {
                actionCollector.add(
                    `Low rainfall detected for ${cropName}${stageMessage}. Activate irrigation system within 48 hours to maintain soil moisture.`,
                    {
                        key: "water_low_rainfall_irrigate",
                        why: "The rainfall window is too low for the crop stage, but irrigation is available to buffer stress.",
                        priority: "immediate",
                        category: "water",
                        timing: "within 48 hours",
                        score: 88
                    }
                );
            } else {
                actionCollector.add(
                    `Severe water stress for ${cropName}${stageMessage}. Irrigation recommended within 48 hours - consider supplemental watering options.`,
                    {
                        key: "water_low_rainfall_no_irrigation",
                        why: "The rainfall window is too low for the crop stage and no irrigation support is confirmed.",
                        priority: "immediate",
                        category: "water",
                        timing: "within 48 hours",
                        score: 90
                    }
                );
            }
        } else {
            if (hasIrrigation) {
                actionCollector.add(
                    `Monitor soil moisture for ${cropName}${stageMessage} and use irrigation to supplement rainfall during critical growth stages.`,
                    {
                        key: "water_monitor_with_irrigation",
                        why: "Rainfall is below the safer water window, but irrigation can partially reduce stress.",
                        priority: "soon",
                        category: "water",
                        timing: "within 72 hours",
                        score: 68
                    }
                );
            } else {
                actionCollector.add(
                    `Monitor soil moisture for ${cropName}${stageMessage} and ensure steady water supply during critical growth stages.`,
                    {
                        key: "water_monitor_without_irrigation",
                        why: "Rainfall is below the safer water window and the crop may need supplemental water planning.",
                        priority: "soon",
                        category: "water",
                        timing: "within 72 hours",
                        score: 66
                    }
                );
            }
        }

        if (waterRequirements.criticalStages.includes(growthStage)) {
            actionCollector.add(
                `${cropName} is in ${growthStage} stage where water stress can severely impact yield. Prioritize water management.`,
                {
                    key: "water_stage_critical",
                    why: "This growth stage is yield-sensitive, so even moderate water stress has a higher agronomic impact.",
                    priority: "immediate",
                    category: "stage_critical",
                    timing: "today",
                    score: 94
                }
            );
        }
    }

    if (hasIrrigation && adjustedRainfallRisk > 0.4) {
        actionCollector.add(
            `Consider scheduling irrigation for ${cropName} to optimize water use efficiency and reduce overall risk.`,
            {
                key: "water_schedule_irrigation",
                why: "Irrigation is available and current rainfall is still insufficient to fully cover crop water demand.",
                priority: "soon",
                category: "irrigation",
                timing: "before the next dry spell",
                score: 76
            }
        );
    }

    const actionPlan = actionCollector.draft();
    const recommendedActions = actionCollector.finalize();

    return {
        ...waterAnalysis,
        actionPlan,
        recommendedActions,
        recommendations: recommendedActions.map((action) => action.message)
    };
};
