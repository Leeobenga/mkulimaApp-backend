export const CABBAGE_MODEL_VERSION = "stage-threshold-v1";

export const defaultCalibration = {
    weights: {
        temperature:       0.35,
        diseaseConditions: 0.35,
        water:             0.30
    },
    stageMultipliers: {
        Germination:  1.1,
        Vegetative:   1.2,
        Reproductive: 1.4,  // heading stage — head formation quality determined here
        Maturity:     1.0,
        Unknown:      1.0
    },
    stageSensitivities: {
        Germination:  { temperature: 1.1, diseaseConditions: 0.9, water: 1.1 },
        Vegetative:   { temperature: 1.1, diseaseConditions: 1.1, water: 1.0 },
        Reproductive: { temperature: 1.3, diseaseConditions: 1.2, water: 1.2 },
        Maturity:     { temperature: 0.9, diseaseConditions: 1.0, water: 0.9 },
        Unknown:      { temperature: 1.0, diseaseConditions: 1.0, water: 1.0 }
    },
    thresholdModel: {
        Germination: {
            temperature:       { optimalMin: 15, optimalMax: 20, mildCold: 8,  severeCold: 2,  mildHeat: 25, severeHeat: 30 },
            diseaseConditions: { favorableMin: 10, favorableMax: 25, susceptibility: 0.8 }
        },
        Vegetative: {
            temperature:       { optimalMin: 15, optimalMax: 20, mildCold: 7,  severeCold: 1,  mildHeat: 25, severeHeat: 30 },
            diseaseConditions: { favorableMin: 10, favorableMax: 25, susceptibility: 1.1 }
        },
        Reproductive: {
            // Heat above 23°C inhibits head formation; cabbage splits or fails to close
            temperature:       { optimalMin: 14, optimalMax: 18, mildCold: 8,  severeCold: 2,  mildHeat: 23, severeHeat: 28 },
            diseaseConditions: { favorableMin: 10, favorableMax: 25, susceptibility: 1.2 }
        },
        Maturity: {
            temperature:       { optimalMin: 12, optimalMax: 22, mildCold: 5,  severeCold: -1, mildHeat: 27, severeHeat: 32 },
            diseaseConditions: { favorableMin: 10, favorableMax: 25, susceptibility: 0.9 }
        },
        Unknown: {
            temperature:       { optimalMin: 14, optimalMax: 20, mildCold: 7,  severeCold: 1,  mildHeat: 24, severeHeat: 30 },
            diseaseConditions: { favorableMin: 10, favorableMax: 25, susceptibility: 1.0 }
        }
    }
};

export const SAFE_STAGE_MULTIPLIER_RANGE       = { min: 0.85, max: 1.5 };
export const SAFE_STAGE_SENSITIVITY_RANGE      = { min: 0.5,  max: 1.5 };
export const SAFE_DISEASE_SUSCEPTIBILITY_RANGE = { min: 0.5,  max: 1.5 };
export const TEMPERATURE_THRESHOLD_ORDER = [
    "severeCold", "mildCold", "optimalMin", "optimalMax", "mildHeat", "severeHeat"
];
