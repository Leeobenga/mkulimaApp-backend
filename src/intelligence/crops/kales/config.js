export const KALES_MODEL_VERSION = "stage-threshold-v1";

export const defaultCalibration = {
    weights: {
        temperature: 0.35,
        diseaseConditions: 0.30,
        water: 0.35
    },
    stageMultipliers: {
        Germination:  1.2,
        Vegetative:   1.3,
        Reproductive: 1.1,
        Maturity:     0.9,
        Unknown:      1.0
    },
    stageSensitivities: {
        Germination:  { temperature: 1.2,  diseaseConditions: 0.8,  water: 1.1 },
        Vegetative:   { temperature: 1.2,  diseaseConditions: 1.0,  water: 1.1 },
        Reproductive: { temperature: 0.9,  diseaseConditions: 1.1,  water: 0.9 },
        Maturity:     { temperature: 0.8,  diseaseConditions: 1.0,  water: 0.8 },
        Unknown:      { temperature: 1.0,  diseaseConditions: 1.0,  water: 1.0 }
    },
    thresholdModel: {
        Germination: {
            temperature:       { optimalMin: 15, optimalMax: 22, mildCold: 10, severeCold: 5, mildHeat: 25, severeHeat: 30 },
            diseaseConditions: { favorableMin: 12, favorableMax: 20, susceptibility: 0.85 }
        },
        Vegetative: {
            temperature:       { optimalMin: 15, optimalMax: 22, mildCold: 8, severeCold: 4, mildHeat: 25, severeHeat: 30 },
            diseaseConditions: { favorableMin: 12, favorableMax: 20, susceptibility: 1.0 }
        },
        Reproductive: {
            temperature:       { optimalMin: 14, optimalMax: 22, mildCold: 8, severeCold: 4, mildHeat: 26, severeHeat: 31 },
            diseaseConditions: { favorableMin: 12, favorableMax: 20, susceptibility: 0.9 }
        },
        Maturity: {
            temperature:       { optimalMin: 12, optimalMax: 22, mildCold: 6, severeCold: 2, mildHeat: 27, severeHeat: 32 },
            diseaseConditions: { favorableMin: 12, favorableMax: 20, susceptibility: 0.8 }
        },
        Unknown: {
            temperature:       { optimalMin: 14, optimalMax: 22, mildCold: 8, severeCold: 4, mildHeat: 25, severeHeat: 30 },
            diseaseConditions: { favorableMin: 12, favorableMax: 20, susceptibility: 0.9 }
        }
    }
};

export const SAFE_STAGE_MULTIPLIER_RANGE       = { min: 0.85, max: 1.5 };
export const SAFE_STAGE_SENSITIVITY_RANGE      = { min: 0.5,  max: 1.5 };
export const SAFE_DISEASE_SUSCEPTIBILITY_RANGE = { min: 0.5,  max: 1.5 };
export const TEMPERATURE_THRESHOLD_ORDER = [
    "severeCold", "mildCold", "optimalMin", "optimalMax", "mildHeat", "severeHeat"
];
