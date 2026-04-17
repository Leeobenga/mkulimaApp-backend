const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeRainfallSchema = (weather = {}) => {
    if (weather?.rainfall && typeof weather.rainfall === "object" && !Array.isArray(weather.rainfall)) {
        const observedMm = toNumberOrNull(
            weather.rainfall.observedMm
            ?? weather.rainfall.observed
            ?? weather.observedRainfall
        );
        const forecastWindowMm = toNumberOrNull(
            weather.rainfall.forecastWindowMm
            ?? weather.rainfall.forecast
            ?? weather.forecastRainfall
        );
        const analysisWindowMm = toNumberOrNull(
            weather.rainfall.analysisWindowMm
            ?? weather.rainfall.analysis
            ?? forecastWindowMm
            ?? observedMm
        );

        return {
            observedMm,
            forecastWindowMm,
            analysisWindowMm
        };
    }

    const observedMm = toNumberOrNull(weather?.observedRainfall);
    const forecastWindowMm = toNumberOrNull(weather?.forecastRainfall);
    const scalarRainfall = toNumberOrNull(weather?.rainfall);

    return {
        observedMm,
        forecastWindowMm,
        analysisWindowMm: forecastWindowMm ?? scalarRainfall ?? observedMm
    };
};

export const normalizeEngineWeather = (weather = {}) => ({
    ...weather,
    rainfall: normalizeRainfallSchema(weather)
});
