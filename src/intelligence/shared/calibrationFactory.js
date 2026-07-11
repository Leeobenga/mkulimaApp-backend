import { GROWTH_STAGES } from "../cropStage.js";

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

const sanitizeBoundedOverride = (value, fallback, { min, max, path, warnings }) => {
    if (value === undefined) return fallback;

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

export const createCalibrationMerger = ({
    defaultCalibration,
    SAFE_STAGE_MULTIPLIER_RANGE,
    SAFE_STAGE_SENSITIVITY_RANGE,
    SAFE_DISEASE_SUSCEPTIBILITY_RANGE,
    TEMPERATURE_THRESHOLD_ORDER
}) => {
    const normalizeWeights = (customWeights = {}, warnings = []) => {
        const safeCustomWeights = asPlainObject(customWeights);
        const mergedWeights = { ...defaultCalibration.weights };

        if (Object.prototype.hasOwnProperty.call(safeCustomWeights, "humidity")) {
            warnings.push("Legacy calibration key `weights.humidity` is ignored. Use `weights.diseaseConditions` instead.");
        }

        Object.keys(safeCustomWeights).forEach((key) => {
            if (key === "humidity" || key === "disease") return;

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
        const safeCustom = asPlainObject(customStageMultipliers);
        warnUnknownStageKeys(safeCustom, "stageMultipliers", warnings);

        return Object.fromEntries(
            GROWTH_STAGES.map((stage) => [
                stage,
                sanitizeBoundedOverride(
                    safeCustom[stage],
                    defaultCalibration.stageMultipliers[stage],
                    { ...SAFE_STAGE_MULTIPLIER_RANGE, path: `stageMultipliers.${stage}`, warnings }
                )
            ])
        );
    };

    const mergeStageSensitivities = (customSensitivities = {}, warnings = []) => {
        const safeCustom = asPlainObject(customSensitivities);
        warnUnknownStageKeys(safeCustom, "stageSensitivities", warnings);

        return Object.fromEntries(
            GROWTH_STAGES.map((stage) => {
                const base = defaultCalibration.stageSensitivities[stage];
                const custom = asPlainObject(safeCustom[stage]);

                if (Object.prototype.hasOwnProperty.call(custom, "humidity")) {
                    warnings.push(`Legacy calibration key \`stageSensitivities.${stage}.humidity\` is ignored. Use \`diseaseConditions\` instead.`);
                }

                Object.keys(custom).forEach((key) => {
                    if (key === "humidity" || key === "disease") return;
                    if (!Object.prototype.hasOwnProperty.call(base, key)) {
                        warnings.push(`Unknown calibration key \`stageSensitivities.${stage}.${key}\` was ignored.`);
                    }
                });

                return [stage, {
                    temperature: sanitizeBoundedOverride(
                        custom.temperature, base.temperature,
                        { ...SAFE_STAGE_SENSITIVITY_RANGE, path: `stageSensitivities.${stage}.temperature`, warnings }
                    ),
                    diseaseConditions: sanitizeBoundedOverride(
                        readDiseaseKey(custom, `stageSensitivities.${stage}`, warnings),
                        base.diseaseConditions,
                        { ...SAFE_STAGE_SENSITIVITY_RANGE, path: `stageSensitivities.${stage}.diseaseConditions`, warnings }
                    ),
                    water: sanitizeBoundedOverride(
                        custom.water, base.water,
                        { ...SAFE_STAGE_SENSITIVITY_RANGE, path: `stageSensitivities.${stage}.water`, warnings }
                    )
                }];
            })
        );
    };

    const sanitizeTemperatureThresholds = (stage, customThresholds = {}, warnings = []) => {
        const base = defaultCalibration.thresholdModel[stage].temperature;
        const merged = { ...base };

        Object.keys(customThresholds).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(base, key)) {
                warnings.push(`Unknown calibration key \`thresholdModel.${stage}.temperature.${key}\` was ignored.`);
                return;
            }
            const numericValue = toNumberOrNull(customThresholds[key]);
            if (numericValue === null) {
                warnings.push(`Calibration value \`thresholdModel.${stage}.temperature.${key}\` must be numeric. Default was kept.`);
                return;
            }
            merged[key] = numericValue;
        });

        const orderedValues = TEMPERATURE_THRESHOLD_ORDER.map((key) => merged[key]);
        const isAscending = orderedValues.every((v, i) => i === 0 || v > orderedValues[i - 1]);
        if (!isAscending) {
            warnings.push(`Temperature thresholds for \`${stage}\` were ignored because they must increase from severe cold to severe heat.`);
            return base;
        }

        return merged;
    };

    const sanitizeDiseaseThresholds = (stage, customThresholds = {}, warnings = []) => {
        const base = defaultCalibration.thresholdModel[stage].diseaseConditions;
        const merged = { ...base };

        Object.keys(customThresholds).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(base, key)) {
                warnings.push(`Unknown calibration key \`thresholdModel.${stage}.diseaseConditions.${key}\` was ignored.`);
                return;
            }
            if (key === "susceptibility") {
                merged.susceptibility = sanitizeBoundedOverride(
                    customThresholds.susceptibility, base.susceptibility,
                    { ...SAFE_DISEASE_SUSCEPTIBILITY_RANGE, path: `thresholdModel.${stage}.diseaseConditions.susceptibility`, warnings }
                );
                return;
            }
            const numericValue = toNumberOrNull(customThresholds[key]);
            if (numericValue === null) {
                warnings.push(`Calibration value \`thresholdModel.${stage}.diseaseConditions.${key}\` must be numeric. Default was kept.`);
                return;
            }
            merged[key] = numericValue;
        });

        if (merged.favorableMin >= merged.favorableMax) {
            warnings.push(`Disease-condition thresholds for \`${stage}\` were ignored because favorableMin must stay below favorableMax.`);
            return base;
        }

        return merged;
    };

    const mergeThresholdModel = (customThresholdModel = {}, warnings = []) => {
        const safeCustom = asPlainObject(customThresholdModel);
        warnUnknownStageKeys(safeCustom, "thresholdModel", warnings);

        return Object.fromEntries(
            GROWTH_STAGES.map((stage) => {
                const customModel = asPlainObject(safeCustom[stage]);
                const diseaseThresholds = asPlainObject(customModel.diseaseConditions ?? customModel.disease);

                if (customModel.disease !== undefined) {
                    warnings.push(`Legacy calibration key \`thresholdModel.${stage}.disease\` now maps to \`thresholdModel.${stage}.diseaseConditions\`.`);
                }

                return [stage, {
                    temperature: sanitizeTemperatureThresholds(stage, asPlainObject(customModel.temperature), warnings),
                    diseaseConditions: sanitizeDiseaseThresholds(stage, diseaseThresholds, warnings)
                }];
            })
        );
    };

    const mergeCalibration = (calibration = {}) => {
        const safe = calibration && typeof calibration === "object" ? calibration : {};
        const warnings = [];
        const allowedSections = ["weights", "stageMultipliers", "stageSensitivities", "thresholdModel"];

        Object.keys(safe).forEach((key) => {
            if (!allowedSections.includes(key)) {
                warnings.push(`Unknown calibration section \`${key}\` was ignored.`);
            }
        });

        return {
            calibration: {
                weights: normalizeWeights(safe.weights || {}, warnings),
                stageMultipliers: mergeStageMultipliers(safe.stageMultipliers || {}, warnings),
                stageSensitivities: mergeStageSensitivities(safe.stageSensitivities || {}, warnings),
                thresholdModel: mergeThresholdModel(safe.thresholdModel || {}, warnings)
            },
            warnings: [...new Set(warnings)]
        };
    };

    const getStageWeight = (stage, calibration) =>
        calibration.stageMultipliers[stage] ?? calibration.stageMultipliers.Unknown;

    const getStageProfile = (stage, calibration) =>
        calibration.thresholdModel[stage] ?? calibration.thresholdModel.Unknown;

    return { mergeCalibration, getStageWeight, getStageProfile };
};
