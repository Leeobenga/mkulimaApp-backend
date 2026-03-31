import { normalizeWeatherData } from "./weather.service.js";
import { getCropInsights } from "../intelligence/index.js";

const normalizeCrop = (crop = {}) => ({
    ...crop,
    type: crop.type ?? crop.crop_type ?? null,
    plantingDate: crop.plantingDate ?? crop.planting_date ?? null,
    growthStage: crop.growthStage ?? crop.growth_stage ?? null,
    calibration: crop.calibration && typeof crop.calibration === "object"
        ? crop.calibration
        : null,
    irrigation: crop.irrigation && typeof crop.irrigation === "object"
        ? crop.irrigation
        : null
});

export const generateCropInsights = async ({
    weatherData,
    crops,
    calibration = null,
    irrigation = null
}) => {
    const weather = normalizeWeatherData(weatherData);

    return crops.map((crop) => {
        const normalizedCrop = normalizeCrop(crop);
        return getCropInsights(
            normalizedCrop.type,
            weather,
            normalizedCrop,
            normalizedCrop.calibration ?? calibration ?? {},
            normalizedCrop.irrigation ?? irrigation ?? null
        );
    });
};
