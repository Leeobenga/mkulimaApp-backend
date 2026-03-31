import { resolveGrowthStage } from "../../cropStage.js";
import { createCropEngine } from "../../shared/cropEngineTemplate.js";
import { normalizeIrrigationContext } from "../../shared/irrigation.js";
import { analyzeMaize, buildDriverCandidates } from "./analysis.js";
import { mergeCalibration } from "./calibration.js";
import { buildMaizeConfidence } from "./confidence.js";
import {
    buildActions,
    buildExplanation,
    buildInterpretability,
    buildRiskDetail
} from "./presentation.js";

const resolveContext = ({
    weather,
    crop,
    calibration,
    irrigation
}) => {
    const stageContext = resolveGrowthStage(crop);
    const irrigationContext = normalizeIrrigationContext(crop, irrigation);
    const {
        calibration: mergedCalibration,
        warnings: calibrationWarnings
    } = mergeCalibration(calibration);

    return {
        weather,
        crop,
        stageContext,
        irrigationContext,
        mergedCalibration,
        calibrationWarnings
    };
};

export const getMaizeInsights = createCropEngine({
    cropName: "maize",
    resolveContext,
    analyze: analyzeMaize,
    buildDrivers: buildDriverCandidates,
    buildConfidence: buildMaizeConfidence,
    buildInterpretability,
    buildActions,
    buildExplanation,
    buildRiskDetail
});
