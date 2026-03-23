import { getWaterAvailability } from "../waterEngine.js";

const defaultCalibration = {
    weights: {
        temperature: 0.4,
        humidity: 0.3,
        water: 0.3
    },
    stageMultipliers: {
        Germination: 1.3,
        Vegetative: 1.0,
        Reproductive: 1.5,
        Maturity: 1.1,
        Unknown: 1.0
    },
    stageSensitivities: {
        Germination: { temperature: 1.2, humidity: 1.0 },
        Vegetative: { temperature: 1.0, humidity: 1.1 },
        Reproductive: { temperature: 1.3, humidity: 1.2 },
        Maturity: { temperature: 0.9, humidity: 1.0 },
        Unknown: { temperature: 1.0, humidity: 1.0 }
    }
};

const applyStageSensitivity = (risk, sensitivity) => Math.min(1, risk * sensitivity);

const toTempRisk = (temp) => {
    if (temp <= 15) return 0.8; // very cold stress
    if (temp <= 20) return 0.4; // mild cold risk
    if (temp <= 25) return 0.1; // optimal temperature zone
    if (temp <= 30) return (temp - 25) / 5 * 0.5 + 0.1; // growing heat risk
    return Math.min(1, 0.6 + (temp - 30) / 15 * 0.4); // severe heat
};

const toHumidityRisk = (humidity) => {
    if (humidity <= 30) return 0.5; // dry conditions
    if (humidity <= 60) return 0.1; // better range
    if (humidity <= 75) return 0.3; // moderate risk (pests/fungal)
    return Math.min(1, 0.5 + (humidity - 75) / 25 * 0.5); // high fungal risk
};

const getStageWeight = (stage, calibration) => {
    const stageMultipliers = calibration?.stageMultipliers || defaultCalibration.stageMultipliers;
    return stageMultipliers[stage] ?? stageMultipliers.Unknown;
};

export const getMaizeInsights = (weather, crop, calibration = {}, irrigation = null) => {
    const temp = weather?.temperature ?? null;
    const humidity = weather?.humidity ?? null;

    // Get water availability analysis
    const waterAnalysis = getWaterAvailability(weather, crop, irrigation, 'maize');

    // Use growth stage from water analysis
    const stage = waterAnalysis.growthStage;

    const mergedCalibration = {
        weights: { ...defaultCalibration.weights, ...(calibration.weights || {}) },
        stageMultipliers: { ...defaultCalibration.stageMultipliers, ...(calibration.stageMultipliers || {}) },
        stageSensitivities: { ...defaultCalibration.stageSensitivities, ...(calibration.stageSensitivities || {}) }
    };

    const tempRisk = temp === null ? 0 : toTempRisk(temp);
    const humidityRisk = humidity === null ? 0 : toHumidityRisk(humidity);

    const stageSens = mergedCalibration.stageSensitivities[stage] || mergedCalibration.stageSensitivities.Unknown;
    const tempRiskAdj = applyStageSensitivity(tempRisk, stageSens.temperature);
    const humidityRiskAdj = applyStageSensitivity(humidityRisk, stageSens.humidity);
    // Water risk adjustments are handled in the water engine
    const waterRiskAdj = waterAnalysis.adjustedRainfallRisk;

    const stageWeight = getStageWeight(stage, mergedCalibration);

    const weights = mergedCalibration.weights;

    const rawScore = tempRiskAdj * weights.temperature + humidityRiskAdj * weights.humidity + waterRiskAdj * weights.water;
    const adjustedScore = Math.min(1, rawScore * stageWeight);
    const riskScore = Math.round(adjustedScore * 100);

    const insights = {
        crop: "maize",
        stage,
        riskScore,
        riskDetail: {
            temperature: Math.round(tempRisk * 100),
            humidity: Math.round(humidityRisk * 100),
            water: Math.round(waterAnalysis.adjustedRainfallRisk * 100),
            temperatureAdjusted: Math.round(tempRiskAdj * 100),
            humidityAdjusted: Math.round(humidityRiskAdj * 100),
            stageWeight,
            stageSensitivity: stageSens,
            weights,
            rawScore: Math.round(rawScore * 100),
            adjustedScore: Math.round(adjustedScore * 100),
            waterAnalysis: {
                growthStage: waterAnalysis.growthStage,
                hasIrrigation: waterAnalysis.hasIrrigation,
                irrigationMitigatesRisk: waterAnalysis.irrigationMitigatesRisk,
                rainfallRiskReduction: Math.round((waterAnalysis.rainfallRisk - waterAnalysis.adjustedRainfallRisk) * 100),
                waterRequirements: waterAnalysis.waterRequirements
            }
        },
        risks: [],
        recommendations: []
    };

    if (temp !== null && tempRisk > 0.5) {
        insights.risks.push("Temperature risk");
        if (temp > 30) insights.recommendations.push("Consider irrigation to cool the crop and prevent heat damage.");
        else if (temp < 15) insights.recommendations.push("Protect seedlings from cold stress (mulch, covers).");
    }

    // Add water-related risks and recommendations from water engine
    if (waterAnalysis.risk) {
        insights.risks.push(waterAnalysis.risk);
    }
    insights.recommendations.push(...waterAnalysis.recommendations);

    if (humidity !== null && humidityRisk > 0.4) {
        insights.risks.push("Humidity-related disease/pest risk");
        insights.recommendations.push("Monitor for leaf spots or fungal symptoms and apply integrated disease management.");
    }

    if (stage === "Reproductive" && adjustedScore >= 0.7) {
        insights.risks.push("Critical reproductive stage risk");
        if (waterAnalysis.hasIrrigation) {
            insights.recommendations.push("Critical stage: Ensure irrigation system is operational for consistent water supply during pollination and grain fill.");
        } else {
            insights.recommendations.push("Prioritize water and nutrient management during pollination and grain fill.");
        }
    }

    if (riskScore <= 30) {
        insights.recommendations.push("Current risk is low. Continue standard monitoring.");
    } else if (riskScore <= 60) {
        insights.recommendations.push("Medium risk detected. Increase scouting frequency.");
    } else {
        insights.recommendations.push("High risk detected. Take immediate mitigation steps.");
    }

    return insights;
};
