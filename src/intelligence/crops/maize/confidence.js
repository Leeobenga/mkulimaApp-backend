import { buildComponentAlignedConfidence } from "../../shared/confidence.js";

const coverageFromValue = (value) =>
    value === null || value === undefined ? 0 : 1;

export const buildMaizeConfidence = ({
    weather,
    analysisWindow,
    stageContext,
    irrigationContext,
    mergedCalibration,
    temperatureAnalysis,
    diseaseConditionsAnalysis,
    waterAnalysis
}) => {
    const stageCoverage = stageContext.source === "explicit"
        ? 1
        : stageContext.source === "derived"
            ? (stageContext.stageConfidence ?? 0.6)
            : 0;
    const componentSignals = {
        temperature: [
            {
                id: "currentTemperature",
                label: "current temperature",
                weight: 0.45,
                coverage: coverageFromValue(temperatureAnalysis.currentRisk)
            },
            {
                id: "temperatureForecast",
                label: "temperature forecast",
                weight: analysisWindow.days ? 0.25 : 0,
                coverage: coverageFromValue(
                    temperatureAnalysis.forecastHeatRisk ?? temperatureAnalysis.forecastColdRisk
                )
            },
            {
                id: "growthStage",
                label: "growth stage",
                weight: 0.3,
                coverage: stageCoverage
            }
        ],
        diseaseConditions: [
            {
                id: "humidity",
                label: "humidity",
                weight: 0.15,
                coverage: coverageFromValue(weather?.humidity)
            },
            {
                id: "observedRainfall",
                label: "observed rainfall",
                weight: 0.1,
                coverage: coverageFromValue(weather?.rainfall?.observedMm)
            },
            {
                id: "forecastRainfall",
                label: "forecast rainfall",
                weight: analysisWindow.days ? 0.15 : 0,
                coverage: coverageFromValue(weather?.rainfall?.forecastWindowMm)
            },
            {
                id: "wetDayPattern",
                label: "wet-day pattern",
                weight: analysisWindow.days ? 0.15 : 0,
                coverage: coverageFromValue(diseaseConditionsAnalysis.wetDayPressure)
            },
            {
                id: "precipitationProbability",
                label: "precipitation probability",
                weight: analysisWindow.days ? 0.1 : 0,
                coverage: coverageFromValue(diseaseConditionsAnalysis.precipitationProbabilityPressure)
            },
            {
                id: "diseaseTemperature",
                label: "temperature suitability",
                weight: 0.2,
                coverage: coverageFromValue(diseaseConditionsAnalysis.temperaturePressure)
            },
            {
                id: "airflow",
                label: "airflow",
                weight: 0.15,
                coverage: coverageFromValue(diseaseConditionsAnalysis.airflowPressure)
            },
            {
                id: "diseaseStage",
                label: "growth stage",
                weight: 0.15,
                coverage: stageCoverage
            }
        ],
        water: [
            {
                id: "rainfallWindow",
                label: "rainfall window",
                weight: 0.45,
                coverage: coverageFromValue(weather?.rainfall?.analysisWindowMm)
            },
            {
                id: "irrigationAvailability",
                label: "irrigation availability",
                weight: 0.25,
                coverage: irrigationContext.availabilityCoverage
            },
            {
                id: "irrigationQuality",
                label: "irrigation quality",
                weight: irrigationContext.available === true ? 0.15 : 0,
                coverage: irrigationContext.qualityCoverage
            },
            {
                id: "waterStage",
                label: "growth stage",
                weight: 0.15,
                coverage: stageCoverage
            }
        ]
    };

    const confidence = buildComponentAlignedConfidence({
        componentSignals,
        componentWeights: mergedCalibration.weights
    });

    return {
        ...confidence,
        irrigationContext: {
            available: irrigationContext.available,
            availabilityCoverage: Math.round(irrigationContext.availabilityCoverage * 100),
            qualityCoverage: Math.round(irrigationContext.qualityCoverage * 100)
        },
        waterReliability: {
            irrigationMitigatesRisk: waterAnalysis.irrigationMitigatesRisk
        }
    };
};
