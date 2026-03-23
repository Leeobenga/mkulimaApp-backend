const toRainfallRisk = (rainfall) => {
    if (rainfall < 5) return 0.9; // severe water stress
    if (rainfall < 15) return 0.5; // moderate water stress
    if (rainfall <= 30) return 0.2; // acceptable
    return 0.1; // abundant water, low water stress
};

const getGrowthStage = (plantingDate) => {
    if (!plantingDate) {
        return "Unknown";
    }

    const now = new Date();
    const planted = new Date(plantingDate);

    if (Number.isNaN(planted.getTime())) {
        return "Unknown";
    }

    const days = Math.floor((now - planted) / (1000 * 60 * 60 * 24));

    if (days <= 7) return "Germination";
    if (days <= 35) return "Vegetative";
    if (days <= 60) return "Reproductive";
    return "Maturity";
};

const getCropWaterRequirements = (cropType) => {
    const requirements = {
        maize: { sensitivity: 'high', criticalStages: ['Reproductive'] },
        beans: { sensitivity: 'medium', criticalStages: ['Reproductive', 'PodFill'] },
        wheat: { sensitivity: 'medium', criticalStages: ['Reproductive'] },
        rice: { sensitivity: 'very_high', criticalStages: ['Reproductive', 'GrainFill'] },
        unknown: { sensitivity: 'medium', criticalStages: ['Reproductive'] }
    };
    return requirements[cropType] || requirements.unknown;
};

export const getWaterAvailability = (weather, crop, irrigation, cropType = 'unknown') => {
    const rainfall = weather?.rainfall ?? null;
    const temp = weather?.temperature ?? null;

    // Get crop-specific information
    const growthStage = getGrowthStage(crop?.plantingDate);
    const waterRequirements = getCropWaterRequirements(cropType);

    const rainfallRisk = rainfall === null ? 0 : toRainfallRisk(rainfall);
    const hasIrrigation = irrigation && irrigation.available === true;

    // Adjust rainfall risk based on irrigation availability
    let adjustedRainfallRisk = rainfallRisk;
    if (hasIrrigation && rainfallRisk > 0.3) {
        // Reduce rainfall risk by up to 50% if irrigation is available
        const irrigationMitigation = Math.min(0.5, rainfallRisk * 0.6);
        adjustedRainfallRisk = Math.max(0, rainfallRisk - irrigationMitigation);
    }

    // Increase risk during critical growth stages
    if (waterRequirements.criticalStages.includes(growthStage)) {
        adjustedRainfallRisk = Math.min(1, adjustedRainfallRisk * 1.3);
    }

    const waterAnalysis = {
        rainfallRisk,
        adjustedRainfallRisk,
        hasIrrigation,
        irrigationMitigatesRisk: hasIrrigation && rainfallRisk > 0.3,
        growthStage,
        cropType,
        waterRequirements,
        recommendations: []
    };

    // Water availability risk assessment
    if (rainfall !== null && rainfallRisk > 0.5) {
        waterAnalysis.risk = "Water availability risk";

        // Crop-specific risk messaging
        const cropName = cropType.charAt(0).toUpperCase() + cropType.slice(1);
        const stageMessage = growthStage !== "Unknown" ? ` during ${growthStage} stage` : "";

        if (rainfall < 5) {
            if (hasIrrigation) {
                waterAnalysis.recommendations.push(`Low rainfall detected for ${cropName}${stageMessage}. Activate irrigation system within 48 hours to maintain soil moisture.`);
            } else {
                waterAnalysis.recommendations.push(`Severe water stress for ${cropName}${stageMessage}. Irrigation recommended within 48 hours - consider supplemental watering options.`);
            }
        } else {
            if (hasIrrigation) {
                waterAnalysis.recommendations.push(`Monitor soil moisture for ${cropName}${stageMessage} and use irrigation to supplement rainfall during critical growth stages.`);
            } else {
                waterAnalysis.recommendations.push(`Monitor soil moisture for ${cropName}${stageMessage} and ensure steady water supply during critical growth stages.`);
            }
        }

        // Critical stage warnings
        if (waterRequirements.criticalStages.includes(growthStage)) {
            waterAnalysis.recommendations.push(`⚠️ CRITICAL: ${cropName} is in ${growthStage} stage where water stress can severely impact yield. Prioritize water management.`);
        }
    }

    // Irrigation-specific recommendations
    if (hasIrrigation && adjustedRainfallRisk > 0.4) {
        const cropName = cropType.charAt(0).toUpperCase() + cropType.slice(1);
        waterAnalysis.recommendations.push(`Consider scheduling irrigation for ${cropName} to optimize water use efficiency and reduce overall risk.`);
    }

    return waterAnalysis;
};