import { getMaizeInsights } from "./crops/maize/index.js";
import { getBeansInsights } from "./crops/beans/index.js";
import { getKalesInsights } from "./crops/kales/index.js";
import { getTomatoesInsights } from "./crops/tomatoes/index.js";
import { getOnionsInsights } from "./crops/onions/index.js";
import { getCabbageInsights } from "./crops/cabbage/index.js";
import { getSpinachInsights } from "./crops/spinach/index.js";

export const getCropInsights = (cropType, weather, cropData, calibration = {}, irrigation = null) => {
    const normalizedCropType = typeof cropType === "string"
        ? cropType.toLowerCase()
        : "";

    switch (normalizedCropType) {
        case "maize":
            return getMaizeInsights(weather, cropData, calibration, irrigation);

        case "beans":
            return getBeansInsights(weather, cropData, calibration, irrigation);

        case "kale":
        case "kales":
        case "sukuma wiki":
        case "sukumawiki":
            return getKalesInsights(weather, cropData, calibration, irrigation);

        case "tomatoes":
        case "tomato":
            return getTomatoesInsights(weather, cropData, calibration, irrigation);

        case "onions":
        case "onion":
            return getOnionsInsights(weather, cropData, calibration, irrigation);

        case "cabbage":
            return getCabbageInsights(weather, cropData, calibration, irrigation);

        case "spinach":
            return getSpinachInsights(weather, cropData, calibration, irrigation);

        default:
            return {
                crop: cropType || "unknown",
                message: "No insights available for this crop type yet."
            };
    }
};
