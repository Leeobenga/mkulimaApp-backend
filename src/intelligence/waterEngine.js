const toRainfallRisk = (rainfall) => {
    if (rainfall < 5) return 0.9; // severe water stress
    if (rainfall < 15) return 0.5; // moderate water stress
    if (rainfall <= 30) return 0.2; // acceptable
    return 0.1; // abundant water, low water stress
};

export const getWaterAvailability = (weather, crop, irrigation, cropType = 'unknown') => {
    const rainfall = weather?.rainfall ?? null;
    const temp = weather?.temperature ?? null;

    const rainfallRisk = rainfall === null ? 0 : toRainfallRisk(rainfall);
    const hasIrrigation = irrigation && irrigation.available === true;

    // Adjust rainfall risk based on irrigation availability
    let adjustedRainfallRisk = rainfallRisk;
    if (hasIrrigation && rainfallRisk > 0.3) {
        // Reduce rainfall risk by up to 50% if irrigation is available
        const irrigationMitigation = Math.min(0.5, rainfallRisk * 0.6);
        adjustedRainfallRisk = Math.max(0, rainfallRisk - irrigationMitigation);
    }

    const waterAnalysis = {
        rainfallRisk,
        adjustedRainfallRisk,
        hasIrrigation,
        irrigationMitigatesRisk: hasIrrigation && rainfallRisk > 0.3,
        recommendations: []
    };

    // Water availability risk assessment
    if (rainfall !== null && rainfallRisk > 0.5) {
        waterAnalysis.risk = "Water availability risk";
        if (rainfall < 5) {
            if (hasIrrigation) {
                waterAnalysis.recommendations.push("Low rainfall detected. Activate irrigation system within 48 hours to maintain soil moisture.");
            } else {
                waterAnalysis.recommendations.push("Irrigation recommended within 48 hours - consider supplemental watering options.");
            }
        } else {
            if (hasIrrigation) {
                waterAnalysis.recommendations.push("Monitor soil moisture and use irrigation to supplement rainfall during critical growth stages.");
            } else {
                waterAnalysis.recommendations.push("Monitor soil moisture and ensure steady supply during critical growth stages.");
            }
        }
    }

    // Irrigation-specific recommendations
    if (hasIrrigation && adjustedRainfallRisk > 0.4) {
        waterAnalysis.recommendations.push("Consider scheduling irrigation to optimize water use efficiency and reduce overall risk.");
    }

    return waterAnalysis;
};