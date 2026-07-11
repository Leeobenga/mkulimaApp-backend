import { getWaterAvailability } from "../waterEngine.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const interpolate = (value, inputMin, inputMax, outputMin, outputMax) => {
    if (inputMax === inputMin) return outputMax;
    const ratio = clamp((value - inputMin) / (inputMax - inputMin));
    return outputMin + ratio * (outputMax - outputMin);
};

const weightedAverage = (entries = [], fallback = 0) => {
    const valid = entries.filter((e) => e.value !== null && e.value !== undefined && e.weight > 0);
    if (valid.length === 0) return fallback;
    const totalWeight = valid.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight === 0) return fallback;
    return valid.reduce((sum, e) => sum + e.value * e.weight, 0) / totalWeight;
};

const applyStageSensitivity = (risk, sensitivity) => clamp((risk ?? 0) * (sensitivity ?? 1));

export const applyStageWeightedRiskCurve = (rawScore, stageWeight = 1) => {
    const delta = (stageWeight ?? 1) - 1;
    return clamp(rawScore + delta * rawScore * (1 - rawScore));
};

export const buildAnalysisWindow = (weather) => {
    const forecastDays = weather?.forecastSummary?.windowDays ?? 0;
    return {
        basis: forecastDays > 0 ? "current_plus_forecast" : "current_weather_only",
        days: forecastDays > 0 ? forecastDays : null
    };
};

const scoreTemperatureAgainstThresholds = (temperature, thresholds) => {
    if (temperature === null || temperature === undefined) return null;
    if (temperature <= thresholds.severeCold) return 1;
    if (temperature < thresholds.mildCold) return interpolate(temperature, thresholds.severeCold, thresholds.mildCold, 1, 0.65);
    if (temperature < thresholds.optimalMin) return interpolate(temperature, thresholds.mildCold, thresholds.optimalMin, 0.65, 0.15);
    if (temperature <= thresholds.optimalMax) return 0.1;
    if (temperature <= thresholds.mildHeat) return interpolate(temperature, thresholds.optimalMax, thresholds.mildHeat, 0.15, 0.55);
    if (temperature <= thresholds.severeHeat) return interpolate(temperature, thresholds.mildHeat, thresholds.severeHeat, 0.55, 1);
    return 1;
};

const scoreDiseaseTemperature = (temperature, diseaseProfile) => {
    if (temperature === null || temperature === undefined) return null;
    const tolerance = 8;
    const lower = diseaseProfile.favorableMin - tolerance;
    const upper = diseaseProfile.favorableMax + tolerance;
    if (temperature >= diseaseProfile.favorableMin && temperature <= diseaseProfile.favorableMax) return 1;
    if (temperature < lower || temperature > upper) return 0.05;
    if (temperature < diseaseProfile.favorableMin) return interpolate(temperature, lower, diseaseProfile.favorableMin, 0.05, 1);
    return interpolate(temperature, diseaseProfile.favorableMax, upper, 1, 0.05);
};

const toHumidityPressure = (humidity) => {
    if (humidity === null || humidity === undefined) return null;
    if (humidity <= 55) return 0.08;
    if (humidity <= 70) return interpolate(humidity, 55, 70, 0.08, 0.35);
    if (humidity <= 80) return interpolate(humidity, 70, 80, 0.35, 0.65);
    if (humidity <= 90) return interpolate(humidity, 80, 90, 0.65, 0.9);
    return 1;
};

const toRainfallMoisturePressure = (rainfallMm) => {
    if (rainfallMm === null || rainfallMm === undefined) return null;
    if (rainfallMm < 5) return 0.1;
    if (rainfallMm < 15) return interpolate(rainfallMm, 5, 15, 0.1, 0.55);
    if (rainfallMm <= 30) return interpolate(rainfallMm, 15, 30, 0.55, 0.8);
    return 0.9;
};

const toPrecipitationProbabilityPressure = (probability) => {
    if (probability === null || probability === undefined) return null;
    if (probability < 30) return 0.1;
    if (probability <= 60) return interpolate(probability, 30, 60, 0.1, 0.55);
    if (probability <= 85) return interpolate(probability, 60, 85, 0.55, 0.9);
    return 1;
};

const toAirflowPressure = (windSpeed) => {
    if (windSpeed === null || windSpeed === undefined) return null;
    if (windSpeed <= 5) return 0.8;
    if (windSpeed <= 12) return interpolate(windSpeed, 5, 12, 0.8, 0.35);
    if (windSpeed <= 20) return interpolate(windSpeed, 12, 20, 0.35, 0.1);
    return 0.05;
};

export const buildTemperatureAnalysis = (weather, thresholds) => {
    const fs = weather?.forecastSummary || {};
    const currentRisk = scoreTemperatureAgainstThresholds(weather?.temperature ?? null, thresholds);
    const forecastHeatRisk = scoreTemperatureAgainstThresholds(fs.hottestDay ?? fs.avgMaxTemp ?? null, thresholds);
    const forecastColdRisk = scoreTemperatureAgainstThresholds(fs.coolestNight ?? fs.avgMinTemp ?? null, thresholds);

    let forecastRisk = Math.max(forecastHeatRisk ?? 0, forecastColdRisk ?? 0);
    if ((fs.extremeHotDays ?? 0) > 0) forecastRisk = Math.max(forecastRisk, 0.85);
    else if ((fs.hotDays ?? 0) >= 2) forecastRisk = Math.max(forecastRisk, 0.65);
    else if (forecastHeatRisk === null && forecastColdRisk === null && (fs.windowDays ?? 0) === 0) forecastRisk = null;

    return {
        currentRisk,
        forecastHeatRisk,
        forecastColdRisk,
        forecastRisk,
        combinedRisk: weightedAverage(
            [{ value: currentRisk, weight: 0.6 }, { value: forecastRisk, weight: 0.4 }],
            0
        )
    };
};

export const buildDiseaseConditionsAnalysis = (weather, diseaseProfile) => {
    const fs = weather?.forecastSummary || {};
    const humidityPressure = toHumidityPressure(weather?.humidity ?? null);
    const currentRainfallPressure = toRainfallMoisturePressure(weather?.rainfall?.observedMm ?? null);
    const forecastRainfallPressure = (fs.windowDays ?? 0) > 0
        ? toRainfallMoisturePressure(weather?.rainfall?.forecastWindowMm ?? null)
        : null;
    const rainfallPressure = weightedAverage(
        [{ value: currentRainfallPressure, weight: 0.35 }, { value: forecastRainfallPressure, weight: 0.65 }],
        0
    );
    const wetDayPressure = (fs.windowDays ?? 0) > 0 ? clamp((fs.wetDays ?? 0) / fs.windowDays) : null;
    const precipitationProbabilityPressure = toPrecipitationProbabilityPressure(fs.meanPrecipitationProbability ?? null);
    const moisturePressure = weightedAverage(
        [
            { value: humidityPressure, weight: 0.35 },
            { value: rainfallPressure, weight: 0.25 },
            { value: wetDayPressure, weight: 0.25 },
            { value: precipitationProbabilityPressure, weight: 0.15 }
        ],
        0
    );
    const temperaturePressure = weightedAverage(
        [
            { value: scoreDiseaseTemperature(weather?.temperature ?? null, diseaseProfile), weight: 0.6 },
            { value: scoreDiseaseTemperature(fs.avgMaxTemp ?? null, diseaseProfile), weight: 0.4 }
        ],
        0
    );
    const airflowPressure = toAirflowPressure(weather?.windSpeed ?? fs.avgWindSpeed ?? null);
    const combinedRisk = clamp(
        weightedAverage(
            [
                { value: moisturePressure, weight: 0.55 },
                { value: temperaturePressure, weight: 0.25 },
                { value: airflowPressure, weight: 0.1 },
                { value: wetDayPressure, weight: 0.1 }
            ],
            0
        ) * diseaseProfile.susceptibility
    );

    return {
        humidityPressure,
        currentRainfallPressure,
        forecastRainfallPressure,
        rainfallPressure,
        wetDayPressure,
        precipitationProbabilityPressure,
        moisturePressure,
        temperaturePressure,
        airflowPressure,
        combinedRisk
    };
};

const describeTemperatureDriver = (weather, thresholds) => {
    const hottestDay = weather?.forecastSummary?.hottestDay;
    const coolestNight = weather?.forecastSummary?.coolestNight;
    if ((hottestDay ?? weather?.temperature ?? -Infinity) >= thresholds.mildHeat) return "forecast heat above the stage threshold";
    if ((coolestNight ?? weather?.temperature ?? Infinity) <= thresholds.mildCold) return "cool conditions below the stage threshold";
    return "stage-specific temperature stress";
};

const describeDiseaseConditionsDriver = (weather, diseaseConditionsAnalysis) => {
    const humidity = weather?.humidity ?? null;
    const wetDays = weather?.forecastSummary?.wetDays ?? 0;
    const windSpeed = weather?.windSpeed ?? weather?.forecastSummary?.avgWindSpeed ?? null;
    if (wetDays >= 2 && humidity !== null && humidity >= 75) return "humid and wet weather that could support foliar disease development";
    if (wetDays >= 2) return "persistent wet weather that could increase disease-conducive conditions";
    if (humidity !== null && humidity >= 80 && windSpeed !== null && windSpeed <= 8) return "high humidity and low airflow that could support foliar disease";
    if (diseaseConditionsAnalysis.moisturePressure >= 0.5) return "moisture conditions that could support disease development";
    return "some disease-conducive weather signals";
};

const describeWaterDriver = (analysisWindow, waterAnalysis) => {
    if (waterAnalysis.rainfallRisk > 0.5 && analysisWindow.days) return `limited rainfall over the next ${analysisWindow.days} days`;
    if (waterAnalysis.rainfallRisk > 0.5) return "limited rainfall availability";
    if (waterAnalysis.irrigationMitigatesRisk) return "water stress partially buffered by irrigation";
    return "water availability pressure";
};

export const buildDriverCandidates = ({
    weather,
    analysisWindow,
    stageProfile,
    temperatureAdjusted,
    diseaseConditionsAdjusted,
    waterAdjusted,
    diseaseConditionsAnalysis,
    waterAnalysis
}) => [
    { label: "Temperature stress", value: temperatureAdjusted, reason: describeTemperatureDriver(weather, stageProfile.temperature) },
    { label: "Disease-conducive conditions", value: diseaseConditionsAdjusted, reason: describeDiseaseConditionsDriver(weather, diseaseConditionsAnalysis) },
    { label: "Water stress", value: waterAdjusted, reason: describeWaterDriver(analysisWindow, waterAnalysis) }
]
    .sort((a, b) => b.value - a.value)
    .filter((d) => d.value >= 0.25);

export const createAnalyzer = ({ getStageProfile, getStageWeight, cropType }) =>
    ({ weather, stageContext, irrigationContext, mergedCalibration }) => {
        const stage = stageContext.stage;
        const stageProfile = getStageProfile(stage, mergedCalibration);
        const stageSensitivity = mergedCalibration.stageSensitivities[stage] || mergedCalibration.stageSensitivities.Unknown;
        const stageWeight = getStageWeight(stage, mergedCalibration);
        const analysisWindow = buildAnalysisWindow(weather);
        const waterAnalysis = getWaterAvailability(weather, { growthStage: stage }, irrigationContext, cropType);
        const temperatureAnalysis = buildTemperatureAnalysis(weather, stageProfile.temperature);
        const diseaseConditionsAnalysis = buildDiseaseConditionsAnalysis(weather, stageProfile.diseaseConditions);

        const temperatureRisk = temperatureAnalysis.combinedRisk;
        const diseaseConditionsRisk = diseaseConditionsAnalysis.combinedRisk;
        const waterRisk = waterAnalysis.adjustedRainfallRisk;

        const temperatureAdjusted = applyStageSensitivity(temperatureRisk, stageSensitivity.temperature);
        const diseaseConditionsAdjusted = applyStageSensitivity(diseaseConditionsRisk, stageSensitivity.diseaseConditions);
        const waterAdjusted = applyStageSensitivity(waterRisk, stageSensitivity.water);

        const rawScore = (
            temperatureAdjusted * mergedCalibration.weights.temperature
            + diseaseConditionsAdjusted * mergedCalibration.weights.diseaseConditions
            + waterAdjusted * mergedCalibration.weights.water
        );
        const adjustedScore = applyStageWeightedRiskCurve(rawScore, stageWeight);

        return {
            analysisWindow, stageProfile, stageSensitivity, stageWeight,
            temperatureAnalysis, diseaseConditionsAnalysis, waterAnalysis,
            temperatureRisk, diseaseConditionsRisk, waterRisk,
            temperatureAdjusted, diseaseConditionsAdjusted, waterAdjusted,
            rawScore, adjustedScore
        };
    };
