import { createCalibrationMerger } from "../../shared/calibrationFactory.js";
import {
    defaultCalibration,
    SAFE_STAGE_MULTIPLIER_RANGE,
    SAFE_STAGE_SENSITIVITY_RANGE,
    SAFE_DISEASE_SUSCEPTIBILITY_RANGE,
    TEMPERATURE_THRESHOLD_ORDER
} from "./config.js";

export const { mergeCalibration, getStageWeight, getStageProfile } = createCalibrationMerger({
    defaultCalibration,
    SAFE_STAGE_MULTIPLIER_RANGE,
    SAFE_STAGE_SENSITIVITY_RANGE,
    SAFE_DISEASE_SUSCEPTIBILITY_RANGE,
    TEMPERATURE_THRESHOLD_ORDER
});
