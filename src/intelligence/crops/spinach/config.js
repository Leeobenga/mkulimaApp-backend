export const SPINACH_MODEL_VERSION = "stage-threshold-v1";

export const defaultCalibration = {
    weights: {
        temperature:       0.40,
        diseaseConditions: 0.30,
        water:             0.30
    },
    stageMultipliers: {
        Germination:  1.2,
        Vegetative:   1.5,  // leaf production IS the product — highest sensitivity
        Reproductive: 0.9,  // bolting means the crop is already lost; reduced weight
        Maturity:     0.8,
        Unknown:      1.0
    },
    stageSensitivities: {
        Germination:  { temperature: 1.2, diseaseConditions: 0.9, water: 1.2 },
        Vegetative:   { temperature: 1.3, diseaseConditions: 1.1, water: 1.1 },
        Reproductive: { temperature: 0.9, diseaseConditions: 1.0, water: 0.9 },
        Maturity:     { temperature: 0.8, diseaseConditions: 0.9, water: 0.8 },
        Unknown:      { temperature: 1.0, diseaseConditions: 1.0, water: 1.0 }
    },
    thresholdModel: {
        Germination: {
            temperature:       { optimalMin: 10, optimalMax: 18, mildCold: 4,  severeCold: -2, mildHeat: 22, severeHeat: 27 },
            diseaseConditions: { favorableMin: 8, favorableMax: 18, susceptibility: 0.85 }
        },
        Vegetative: {
            // Bolting threshold is 20°C under long days — mildHeat is kept low
            temperature:       { optimalMin: 10, optimalMax: 18, mildCold: 3,  severeCold: -3, mildHeat: 20, severeHeat: 26 },
            diseaseConditions: { favorableMin: 8, favorableMax: 18, susceptibility: 1.1 }
        },
        Reproductive: {
            temperature:       { optimalMin: 10, optimalMax: 22, mildCold: 4,  severeCold: -1, mildHeat: 24, severeHeat: 30 },
            diseaseConditions: { favorableMin: 8, favorableMax: 18, susceptibility: 1.0 }
        },
        Maturity: {
            temperature:       { optimalMin: 10, optimalMax: 22, mildCold: 4,  severeCold: -1, mildHeat: 26, severeHeat: 32 },
            diseaseConditions: { favorableMin: 8, favorableMax: 18, susceptibility: 0.85 }
        },
        Unknown: {
            temperature:       { optimalMin: 10, optimalMax: 18, mildCold: 4,  severeCold: -2, mildHeat: 21, severeHeat: 27 },
            diseaseConditions: { favorableMin: 8, favorableMax: 18, susceptibility: 0.95 }
        }
    }
};

export const SAFE_STAGE_MULTIPLIER_RANGE       = { min: 0.85, max: 1.5 };
export const SAFE_STAGE_SENSITIVITY_RANGE      = { min: 0.5,  max: 1.5 };
export const SAFE_DISEASE_SUSCEPTIBILITY_RANGE = { min: 0.5,  max: 1.5 };
export const TEMPERATURE_THRESHOLD_ORDER = [
    "severeCold", "mildCold", "optimalMin", "optimalMax", "mildHeat", "severeHeat"
];
