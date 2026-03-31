import { GROWTH_STAGES } from "../../cropStage.js";
import {
    defaultCalibration,
    SAFE_DISEASE_SUSCEPTIBILITY_RANGE,
    SAFE_STAGE_MULTIPLIER_RANGE,
    SAFE_STAGE_SENSITIVITY_RANGE,
    TEMPERATURE_THRESHOLD_ORDER
} from "./config.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const toNumberOrNull = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
};
const asPlainObject = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

const warnUnknownStageKeys = (config = {}, section, warnings = []) => {
    Object.keys(config).forEach((stage) => {
        if (!GROWTH_STAGES.includes(stage)) {
            warnings.push(`Unknown calibration stage \`${section}.${stage}\` was ignored.`);
        }
    });
};

const sanitizeBoundedOverride = (
    value,
    fallback,
    { min, max, path, warnings }
) => {
    if (value === undefined) {
        return fallback;
    }

    const numericValue = toNumberOrNull(value);
    if (numericValue === null) {
        warnings.push(`Calibration value \`${path}\` must be numeric. Default was kept.`);
        return fallback;
    }

    const boundedValue = clamp(numericValue, min, max);
    if (boundedValue !== numericValue) {
        warnings.push(`Calibration value \`${path}\` was clamped to the safe range ${min}-${max}.`);
    }

    return boundedValue;
};

const readDiseaseKey = (value, path, warnings) => {
    if (value.disease !== undefined) {
        warnings.push(`Legacy calibration key \`${path}.disease\` now maps to \`${path}.diseaseConditions\`.`);
    }

    return value.diseaseConditions ?? value.disease;
};

const normalizeWeights = (customWeights = {}, warnings = []) => {
    const safeCustomWeights = asPlainObject(customWeights);
    const mergedWeights = { ...defaultCalibration.weights };

    if (Object.prototype.hasOwnProperty.call(safeCustomWeights, "humidity")) {
        warnings.push("Legacy calibration key `weights.humidity` is ignored. Use `weights.diseaseConditions` instead.");
    }

    Object.keys(safeCustomWeights).forEach((key) => {
        if (key === "humidity") {
            return;
        }

        if (key === "disease") {
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(defaultCalibration.weights, key)) {
            warnings.push(`Unknown calibration weight \`weights.${key}\` was ignored.`);
            return;
        }

        const numericValue = toNumberOrNull(safeCustomWeights[key]);
        if (numericValue === null || numericValue < 0) {
            warnings.push(`Calibration weight \`weights.${key}\` must be a non-negative number. Default was kept.`);
            return;
        }

        mergedWeights[key] = numericValue;
    });

    const legacyDiseaseWeight = readDiseaseKey(safeCustomWeights, "weights", warnings);
    if (legacyDiseaseWeight !== undefined) {
        const numericValue = toNumberOrNull(legacyDiseaseWeight);
        if (numericValue === null || numericValue < 0) {
            warnings.push("Calibration weight `weights.diseaseConditions` must be a non-negative number. Default was kept.");
        } else {
            mergedWeights.diseaseConditions = numericValue;
        }
    }

    const totalWeight = Object.values(mergedWeights).reduce((sum, value) => sum + value, 0);
    if (totalWeight <= 0) {
        warnings.push("Calibration weights summed to 0. Default weights were restored.");
        return { ...defaultCalibration.weights };
    }

    if (Math.abs(totalWeight - 1) > 0.001) {
        warnings.push("Calibration weights were normalized to keep total influence at 1.");
    }

    return Object.fromEntries(
        Object.entries(mergedWeights).map(([key, value]) => [key, value / totalWeight])
    );
};

const mergeStageMultipliers = (customStageMultipliers = {}, warnings = []) => {
    const safeCustomStageMultipliers = asPlainObject(customStageMultipliers);

    warnUnknownStageKeys(safeCustomStageMultipliers, "stageMultipliers", warnings);

    return Object.fromEntries(
        GROWTH_STAGES.map((stage) => [
            stage,
            sanitizeBoundedOverride(
                safeCustomStageMultipliers[stage],
                defaultCalibration.stageMultipliers[stage],
                {
                    ...SAFE_STAGE_MULTIPLIER_RANGE,
                    path: `stageMultipliers.${stage}`,
                    warnings
                }
            )
        ])
    );
};

const mergeStageSensitivities = (customSensitivities = {}, warnings = []) => {
    const safeCustomSensitivities = asPlainObject(customSensitivities);

    warnUnknownStageKeys(safeCustomSensitivities, "stageSensitivities", warnings);

    return Object.fromEntries(
        GROWTH_STAGES.map((stage) => {
            const baseSensitivity = defaultCalibration.stageSensitivities[stage];
            const customSensitivity = asPlainObject(safeCustomSensitivities[stage]);

            if (Object.prototype.hasOwnProperty.call(customSensitivity, "humidity")) {
                warnings.push(`Legacy calibration key \`stageSensitivities.${stage}.humidity\` is ignored. Use \`diseaseConditions\` instead.`);
            }

            Object.keys(customSensitivity).forEach((key) => {
                if (key === "humidity" || key === "disease") {
                    return;
                }

                if (!Object.prototype.hasOwnProperty.call(baseSensitivity, key)) {
                    warnings.push(`Unknown calibration key \`stageSensitivities.${stage}.${key}\` was ignored.`);
                }
            });

            return [
                stage,
                {
                    temperature: sanitizeBoundedOverride(
                        customSensitivity.temperature,
                        baseSensitivity.temperature,
                        {
                            ...SAFE_STAGE_SENSITIVITY_RANGE,
                            path: `stageSensitivities.${stage}.temperature`,
                            warnings
                        }
                    ),
                    diseaseConditions: sanitizeBoundedOverride(
                        readDiseaseKey(customSensitivity, `stageSensitivities.${stage}`, warnings),
                        baseSensitivity.diseaseConditions,
                        {
                            ...SAFE_STAGE_SENSITIVITY_RANGE,
                            path: `stageSensitivities.${stage}.diseaseConditions`,
                            warnings
                        }
                    ),
                    water: sanitizeBoundedOverride(
                        customSensitivity.water,
                        baseSensitivity.water,
                        {
                            ...SAFE_STAGE_SENSITIVITY_RANGE,
                            path: `stageSensitivities.${stage}.water`,
                            warnings
                        }
                    )
                }
            ];
        })
    );
};

const sanitizeTemperatureThresholds = (stage, customThresholds = {}, warnings = []) => {
    const baseThresholds = defaultCalibration.thresholdModel[stage].temperature;
    const mergedThresholds = { ...baseThresholds };

    Object.keys(customThresholds).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(baseThresholds, key)) {
            warnings.push(`Unknown calibration key \`thresholdModel.${stage}.temperature.${key}\` was ignored.`);
            return;
        }

        const numericValue = toNumberOrNull(customThresholds[key]);
        if (numericValue === null) {
            warnings.push(`Calibration value \`thresholdModel.${stage}.temperature.${key}\` must be numeric. Default was kept.`);
            return;
        }

        mergedThresholds[key] = numericValue;
    });

    const orderedValues = TEMPERATURE_THRESHOLD_ORDER.map((key) => mergedThresholds[key]);
    const isAscending = orderedValues.every((value, index) => index === 0 || value > orderedValues[index - 1]);

    if (!isAscending) {
        warnings.push(`Temperature thresholds for \`${stage}\` were ignored because they must increase from severe cold to severe heat.`);
        return baseThresholds;
    }

    return mergedThresholds;
};

const sanitizeDiseaseThresholds = (stage, customThresholds = {}, warnings = []) => {
    const baseThresholds = defaultCalibration.thresholdModel[stage].diseaseConditions;
    const mergedThresholds = { ...baseThresholds };

    Object.keys(customThresholds).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(baseThresholds, key)) {
            warnings.push(`Unknown calibration key \`thresholdModel.${stage}.diseaseConditions.${key}\` was ignored.`);
            return;
        }

        if (key === "susceptibility") {
            mergedThresholds.susceptibility = sanitizeBoundedOverride(
                customThresholds.susceptibility,
                baseThresholds.susceptibility,
                {
                    ...SAFE_DISEASE_SUSCEPTIBILITY_RANGE,
                    path: `thresholdModel.${stage}.diseaseConditions.susceptibility`,
                    warnings
                }
            );
            return;
        }

        const numericValue = toNumberOrNull(customThresholds[key]);
        if (numericValue === null) {
            warnings.push(`Calibration value \`thresholdModel.${stage}.diseaseConditions.${key}\` must be numeric. Default was kept.`);
            return;
        }

        mergedThresholds[key] = numericValue;
    });

    if (mergedThresholds.favorableMin >= mergedThresholds.favorableMax) {
        warnings.push(`Disease-condition thresholds for \`${stage}\` were ignored because favorableMin must stay below favorableMax.`);
        return baseThresholds;
    }

    return mergedThresholds;
};

const mergeThresholdModel = (customThresholdModel = {}, warnings = []) => {
    const safeCustomThresholdModel = asPlainObject(customThresholdModel);

    warnUnknownStageKeys(safeCustomThresholdModel, "thresholdModel", warnings);

    return Object.fromEntries(
        GROWTH_STAGES.map((stage) => {
            const customModel = asPlainObject(safeCustomThresholdModel[stage]);
            const diseaseConditionsThresholds = asPlainObject(
                customModel.diseaseConditions ?? customModel.disease
            );

            if (customModel.disease !== undefined) {
                warnings.push(`Legacy calibration key \`thresholdModel.${stage}.disease\` now maps to \`thresholdModel.${stage}.diseaseConditions\`.`);
            }

            return [
                stage,
                {
                    temperature: sanitizeTemperatureThresholds(
                        stage,
                        asPlainObject(customModel.temperature),
                        warnings
                    ),
                    diseaseConditions: sanitizeDiseaseThresholds(
                        stage,
                        diseaseConditionsThresholds,
                        warnings
                    )
                }
            ];
        })
    );
};

export const mergeCalibration = (calibration = {}) => {
    const safeCalibration = calibration && typeof calibration === "object" ? calibration : {};
    const warnings = [];
    const allowedSections = ["weights", "stageMultipliers", "stageSensitivities", "thresholdModel"];

    Object.keys(safeCalibration).forEach((key) => {
        if (!allowedSections.includes(key)) {
            warnings.push(`Unknown calibration section \`${key}\` was ignored.`);
        }
    });

    return {
        calibration: {
            weights: normalizeWeights(safeCalibration.weights || {}, warnings),
            stageMultipliers: mergeStageMultipliers(safeCalibration.stageMultipliers || {}, warnings),
            stageSensitivities: mergeStageSensitivities(safeCalibration.stageSensitivities || {}, warnings),
            thresholdModel: mergeThresholdModel(safeCalibration.thresholdModel || {}, warnings)
        },
        warnings: [...new Set(warnings)]
    };
};

export const getStageWeight = (stage, calibration) =>
    calibration.stageMultipliers[stage] ?? calibration.stageMultipliers.Unknown;

export const getStageProfile = (stage, calibration) =>
    calibration.thresholdModel[stage] ?? calibration.thresholdModel.Unknown;
