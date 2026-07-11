export const TOMATOES_MODEL_VERSION = "stage-threshold-v1";

export const defaultCalibration = {
    weights: {
        temperature: 0.30,
        diseaseConditions: 0.40,
        water: 0.30
    },
    stageMultipliers: {
        Germination:  1.1,
        Vegetative:   1.0,
        Reproductive: 1.5,
        Maturity:     1.2,
        Unknown:      1.0
    },
    stageSensitivities: {
        Germination:  { temperature: 1.1,  diseaseConditions: 0.9,  water: 1.0  },
        Vegetative:   { temperature: 1.0,  diseaseConditions: 1.1,  water: 1.0  },
        Reproductive: { temperature: 1.3,  diseaseConditions: 1.3,  water: 1.2  },
        Maturity:     { temperature: 1.0,  diseaseConditions: 1.1,  water: 1.2  },
        Unknown:      { temperature: 1.0,  diseaseConditions: 1.0,  water: 1.0  }
    },
    thresholdModel: {
        Germination: {
            temperature:       { optimalMin: 20, optimalMax: 28, mildCold: 14, severeCold: 10, mildHeat: 30, severeHeat: 35 },
            diseaseConditions: { favorableMin: 15, favorableMax: 27, susceptibility: 0.9 }
        },
        Vegetative: {
            temperature:       { optimalMin: 20, optimalMax: 28, mildCold: 13, severeCold: 9,  mildHeat: 30, severeHeat: 35 },
            diseaseConditions: { favorableMin: 15, favorableMax: 27, susceptibility: 1.1 }
        },
        Reproductive: {
            // Pollen viability drops sharply above 29°C — lower mildHeat than other stages
            temperature:       { optimalMin: 20, optimalMax: 27, mildCold: 14, severeCold: 10, mildHeat: 29, severeHeat: 34 },
            diseaseConditions: { favorableMin: 15, favorableMax: 27, susceptibility: 1.3 }
        },
        Maturity: {
            temperature:       { optimalMin: 18, optimalMax: 27, mildCold: 12, severeCold: 8,  mildHeat: 30, severeHeat: 35 },
            diseaseConditions: { favorableMin: 15, favorableMax: 27, susceptibility: 1.2 }
        },
        Unknown: {
            temperature:       { optimalMin: 20, optimalMax: 27, mildCold: 13, severeCold: 9,  mildHeat: 30, severeHeat: 34 },
            diseaseConditions: { favorableMin: 15, favorableMax: 27, susceptibility: 1.1 }
        }
    }
};

export const SAFE_STAGE_MULTIPLIER_RANGE       = { min: 0.85, max: 1.5 };
export const SAFE_STAGE_SENSITIVITY_RANGE      = { min: 0.5,  max: 1.5 };
export const SAFE_DISEASE_SUSCEPTIBILITY_RANGE = { min: 0.5,  max: 1.5 };
export const TEMPERATURE_THRESHOLD_ORDER = [
    "severeCold", "mildCold", "optimalMin", "optimalMax", "mildHeat", "severeHeat"
];
