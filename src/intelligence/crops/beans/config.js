export const BEANS_MODEL_VERSION = "stage-threshold-v1";

export const defaultCalibration = {
    weights: {
        temperature: 0.30,
        diseaseConditions: 0.35,
        water: 0.35
    },
    stageMultipliers: {
        Germination:  1.2,
        Vegetative:   1.0,
        Reproductive: 1.5,
        Maturity:     1.15,
        Unknown:      1.0
    },
    stageSensitivities: {
        Germination:  { temperature: 1.15, diseaseConditions: 0.85, water: 1.0 },
        Vegetative:   { temperature: 1.0,  diseaseConditions: 1.0,  water: 0.95 },
        Reproductive: { temperature: 1.3,  diseaseConditions: 1.2,  water: 1.1 },
        Maturity:     { temperature: 0.9,  diseaseConditions: 1.05, water: 1.1 },
        Unknown:      { temperature: 1.0,  diseaseConditions: 1.0,  water: 1.0 }
    },
    thresholdModel: {
        Germination: {
            temperature:       { optimalMin: 18, optimalMax: 25, mildCold: 14, severeCold: 10, mildHeat: 28, severeHeat: 33 },
            diseaseConditions: { favorableMin: 16, favorableMax: 24, susceptibility: 0.8 }
        },
        Vegetative: {
            temperature:       { optimalMin: 16, optimalMax: 24, mildCold: 12, severeCold: 8,  mildHeat: 28, severeHeat: 32 },
            diseaseConditions: { favorableMin: 17, favorableMax: 25, susceptibility: 1.0 }
        },
        Reproductive: {
            temperature:       { optimalMin: 16, optimalMax: 24, mildCold: 13, severeCold: 10, mildHeat: 26, severeHeat: 30 },
            diseaseConditions: { favorableMin: 18, favorableMax: 26, susceptibility: 1.2 }
        },
        Maturity: {
            temperature:       { optimalMin: 15, optimalMax: 25, mildCold: 10, severeCold: 6,  mildHeat: 29, severeHeat: 33 },
            diseaseConditions: { favorableMin: 16, favorableMax: 24, susceptibility: 1.1 }
        },
        Unknown: {
            temperature:       { optimalMin: 16, optimalMax: 24, mildCold: 12, severeCold: 8,  mildHeat: 27, severeHeat: 31 },
            diseaseConditions: { favorableMin: 17, favorableMax: 25, susceptibility: 1.0 }
        }
    }
};

export const SAFE_STAGE_MULTIPLIER_RANGE      = { min: 0.85, max: 1.5 };
export const SAFE_STAGE_SENSITIVITY_RANGE     = { min: 0.5,  max: 1.5 };
export const SAFE_DISEASE_SUSCEPTIBILITY_RANGE = { min: 0.5, max: 1.5 };
export const TEMPERATURE_THRESHOLD_ORDER = [
    "severeCold", "mildCold", "optimalMin", "optimalMax", "mildHeat", "severeHeat"
];
