export const MAIZE_MODEL_VERSION = "stage-threshold-v4";

export const defaultCalibration = {
    weights: {
        temperature: 0.35,
        diseaseConditions: 0.3,
        water: 0.35
    },
    stageMultipliers: {
        Germination: 1.25,
        Vegetative: 1.0,
        Reproductive: 1.5,
        Maturity: 1.05,
        Unknown: 1.0
    },
    stageSensitivities: {
        Germination: { temperature: 1.15, diseaseConditions: 0.9, water: 1.0 },
        Vegetative: { temperature: 1.0, diseaseConditions: 1.0, water: 1.0 },
        Reproductive: { temperature: 1.2, diseaseConditions: 1.25, water: 1.0 },
        Maturity: { temperature: 0.9, diseaseConditions: 0.85, water: 1.0 },
        Unknown: { temperature: 1.0, diseaseConditions: 1.0, water: 1.0 }
    },
    thresholdModel: {
        Germination: {
            temperature: { optimalMin: 18, optimalMax: 30, mildCold: 14, severeCold: 10, mildHeat: 32, severeHeat: 36 },
            diseaseConditions: { favorableMin: 18, favorableMax: 28, susceptibility: 0.9 }
        },
        Vegetative: {
            temperature: { optimalMin: 20, optimalMax: 32, mildCold: 16, severeCold: 12, mildHeat: 34, severeHeat: 38 },
            diseaseConditions: { favorableMin: 20, favorableMax: 30, susceptibility: 1.0 }
        },
        Reproductive: {
            temperature: { optimalMin: 18, optimalMax: 30, mildCold: 15, severeCold: 11, mildHeat: 32, severeHeat: 36 },
            diseaseConditions: { favorableMin: 18, favorableMax: 29, susceptibility: 1.25 }
        },
        Maturity: {
            temperature: { optimalMin: 16, optimalMax: 30, mildCold: 12, severeCold: 8, mildHeat: 33, severeHeat: 37 },
            diseaseConditions: { favorableMin: 20, favorableMax: 30, susceptibility: 0.75 }
        },
        Unknown: {
            temperature: { optimalMin: 18, optimalMax: 31, mildCold: 14, severeCold: 10, mildHeat: 33, severeHeat: 37 },
            diseaseConditions: { favorableMin: 19, favorableMax: 29, susceptibility: 1.0 }
        }
    }
};

export const SAFE_STAGE_MULTIPLIER_RANGE = { min: 0.85, max: 1.5 };
export const SAFE_STAGE_SENSITIVITY_RANGE = { min: 0.5, max: 1.5 };
export const SAFE_DISEASE_SUSCEPTIBILITY_RANGE = { min: 0.5, max: 1.5 };
export const TEMPERATURE_THRESHOLD_ORDER = [
    "severeCold",
    "mildCold",
    "optimalMin",
    "optimalMax",
    "mildHeat",
    "severeHeat"
];
