import { resolveGrowthStage } from "../../cropStage.js";
import { createCropEngine } from "../../shared/cropEngineTemplate.js";
import { normalizeIrrigationContext } from "../../shared/irrigation.js";
import { analyzeOnions, buildDriverCandidates } from "./analysis.js";
import { mergeCalibration } from "./calibration.js";
import { buildOnionsConfidence } from "./confidence.js";
import { buildActions, buildExplanation, buildInterpretability, buildRiskDetail } from "./presentation.js";

const resolveContext = ({ weather, crop, calibration, irrigation }) => {
    const stageContext = resolveGrowthStage(crop);
    const irrigationContext = normalizeIrrigationContext(crop, irrigation);
    const { calibration: mergedCalibration, warnings: calibrationWarnings } = mergeCalibration(calibration);

    return { weather, crop, stageContext, irrigationContext, mergedCalibration, calibrationWarnings };
};

export const getOnionsInsights = createCropEngine({
    cropName: "onions",
    resolveContext,
    analyze: analyzeOnions,
    buildDrivers: buildDriverCandidates,
    buildConfidence: buildOnionsConfidence,
    buildInterpretability,
    buildActions,
    buildExplanation,
    buildRiskDetail
});
