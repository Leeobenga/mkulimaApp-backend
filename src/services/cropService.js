import { normalizeWeatherData } from "./weather.service.js";
import { getCropInsights } from "../intelligence/index.js";

const normalizeCrop = (crop = {}) => ({
    ...crop,
    type: crop.type ?? crop.crop_type ?? null,
    plantingDate: crop.plantingDate ?? crop.planting_date ?? null
});

export const generateCropInsights = async ({ weatherData, crops }) => {
    const weather = normalizeWeatherData(weatherData);

    return crops.map((crop) => {
        const normalizedCrop = normalizeCrop(crop);
        return getCropInsights(normalizedCrop.type, weather, normalizedCrop);
    });
};
