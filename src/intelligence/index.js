import { getMaizeInsights } from "./crops/maize/index.js";

export const getCropInsights = (cropType, weather, cropData, calibration = {}, irrigation = null) => {
    const normalizedCropType = typeof cropType === "string"
        ? cropType.toLowerCase()
        : "";

    switch(normalizedCropType) {
        case "maize":
            return getMaizeInsights(weather, cropData, calibration, irrigation);

        default:
            return {
                crop: cropType || "unknown",
                message: "No insights available for this crop type yet."
            };
    }
};
