import { createAnalyzer, buildDriverCandidates } from "../../shared/cropAnalysis.js";
import { getStageProfile, getStageWeight } from "./calibration.js";

export { buildDriverCandidates };
export const analyzeCabbage = createAnalyzer({ getStageProfile, getStageWeight, cropType: "cabbage" });
