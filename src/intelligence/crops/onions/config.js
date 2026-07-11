export const ONIONS_MODEL_VERSION = "stage-threshold-v1";

export const defaultCalibration = {
    weights: {
        temperature:       0.25,
        diseaseConditions: 0.40,
        water:             0.35
    },
    stageMultipliers: {
        Germination:  1.1,
        Vegetative:   1.2,
        Reproductive: 1.5,  // bulb initiation and sizing — most yield-critical
        Maturity:     0.9,  // tops falling; reduce irrigation before harvest
        Unknown:      1.0
    },
    stageSensitivities: {
        Germination:  { temperature: 1.1, diseaseConditions: 0.9, water: 1.2 },
        Vegetative:   { temperature: 1.0, diseaseConditions: 1.1, water: 1.1 },
        Reproductive: { temperature: 1.1, diseaseConditions: 1.3, water: 1.3 },
        Maturity:     { temperature: 0.8, diseaseConditions: 1.0, water: 0.7 },
        Unknown:      { temperature: 1.0, diseaseConditions: 1.0, water: 1.0 }
    },
    thresholdModel: {
        Germination: {
            temperature:       { optimalMin: 13, optimalMax: 24, mildCold: 8, severeCold: 3, mildHeat: 28, severeHeat: 33 },
            diseaseConditions: { favorableMin: 13, favorableMax: 28, susceptibility: 0.8 }
        },
        Vegetative: {
            temperature:       { optimalMin: 13, optimalMax: 24, mildCold: 7, severeCold: 2, mildHeat: 28, severeHeat: 33 },
            diseaseConditions: { favorableMin: 13, favorableMax: 28, susceptibility: 1.1 }
        },
        Reproductive: {
            // Bulb sizing — heat above 26°C suppresses bulb development
            temperature:       { optimalMin: 13, optimalMax: 22, mildCold: 8, severeCold: 3, mildHeat: 26, severeHeat: 31 },
            diseaseConditions: { favorableMin: 13, favorableMax: 28, susceptibility: 1.2 }
        },
        Maturity: {
            temperature:       { optimalMin: 18, optimalMax: 28, mildCold: 10, severeCold: 4, mildHeat: 32, severeHeat: 38 },
            diseaseConditions: { favorableMin: 13, favorableMax: 28, susceptibility: 0.9 }
        },
        Unknown: {
            temperature:       { optimalMin: 13, optimalMax: 24, mildCold: 8, severeCold: 3, mildHeat: 28, severeHeat: 33 },
            diseaseConditions: { favorableMin: 13, favorableMax: 28, susceptibility: 1.0 }
        }
    }
};

export const SAFE_STAGE_MULTIPLIER_RANGE       = { min: 0.85, max: 1.5 };
export const SAFE_STAGE_SENSITIVITY_RANGE      = { min: 0.5,  max: 1.5 };
export const SAFE_DISEASE_SUSCEPTIBILITY_RANGE = { min: 0.5,  max: 1.5 };
export const TEMPERATURE_THRESHOLD_ORDER = [
    "severeCold", "mildCold", "optimalMin", "optimalMax", "mildHeat", "severeHeat"
];
