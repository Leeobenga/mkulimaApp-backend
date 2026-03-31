export const GROWTH_STAGES = ["Germination", "Vegetative", "Reproductive", "Maturity", "Unknown"];

const STAGE_ALIASES = new Map([
    ["germination", "Germination"],
    ["emergence", "Germination"],
    ["seedling", "Germination"],
    ["vegetative", "Vegetative"],
    ["vegetation", "Vegetative"],
    ["reproductive", "Reproductive"],
    ["flowering", "Reproductive"],
    ["pollination", "Reproductive"],
    ["grain fill", "Reproductive"],
    ["grain_fill", "Reproductive"],
    ["maturity", "Maturity"],
    ["mature", "Maturity"],
    ["ripening", "Maturity"],
    ["unknown", "Unknown"]
]);

const normalizeStageKey = (stage) =>
    String(stage)
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");

export const normalizeGrowthStage = (stage) => {
    if (typeof stage !== "string" || stage.trim() === "") {
        return null;
    }

    return STAGE_ALIASES.get(normalizeStageKey(stage)) || null;
};

export const deriveGrowthStageFromPlantingDate = (plantingDate, now = new Date()) => {
    if (!plantingDate) {
        return {
            stage: "Unknown",
            plantingDateValid: false,
            daysSincePlanting: null
        };
    }

    const planted = new Date(plantingDate);

    if (Number.isNaN(planted.getTime())) {
        return {
            stage: "Unknown",
            plantingDateValid: false,
            daysSincePlanting: null
        };
    }

    const elapsedDays = Math.max(0, Math.floor((now - planted) / (1000 * 60 * 60 * 24)));

    if (elapsedDays <= 7) {
        return {
            stage: "Germination",
            plantingDateValid: true,
            daysSincePlanting: elapsedDays
        };
    }

    if (elapsedDays <= 35) {
        return {
            stage: "Vegetative",
            plantingDateValid: true,
            daysSincePlanting: elapsedDays
        };
    }

    if (elapsedDays <= 60) {
        return {
            stage: "Reproductive",
            plantingDateValid: true,
            daysSincePlanting: elapsedDays
        };
    }

    return {
        stage: "Maturity",
        plantingDateValid: true,
        daysSincePlanting: elapsedDays
    };
};

export const resolveGrowthStage = (crop = {}, now = new Date()) => {
    const plantingDate = crop?.plantingDate ?? crop?.planting_date ?? null;
    const explicitStage = normalizeGrowthStage(
        crop?.growthStage ?? crop?.growth_stage ?? crop?.stage ?? null
    );
    const derivedStage = deriveGrowthStageFromPlantingDate(plantingDate, now);

    if (explicitStage && explicitStage !== "Unknown") {
        return {
            stage: explicitStage,
            source: "explicit",
            plantingDate,
            plantingDateValid: derivedStage.plantingDateValid,
            daysSincePlanting: derivedStage.daysSincePlanting
        };
    }

    if (derivedStage.stage !== "Unknown") {
        return {
            stage: derivedStage.stage,
            source: "derived",
            plantingDate,
            plantingDateValid: derivedStage.plantingDateValid,
            daysSincePlanting: derivedStage.daysSincePlanting
        };
    }

    return {
        stage: "Unknown",
        source: "unknown",
        plantingDate,
        plantingDateValid: derivedStage.plantingDateValid,
        daysSincePlanting: derivedStage.daysSincePlanting
    };
};
