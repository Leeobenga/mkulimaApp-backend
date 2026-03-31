const normalizeBoolean = (value) =>
    typeof value === "boolean" ? value : null;

export const normalizeIrrigationContext = (crop = {}, irrigation = null) => {
    const irrigationInput = irrigation && typeof irrigation === "object"
        ? irrigation
        : (crop?.irrigation && typeof crop.irrigation === "object" ? crop.irrigation : {});
    const available = normalizeBoolean(
        irrigationInput.available ?? crop?.currently_irrigating ?? crop?.irrigation_available
    );
    const source = irrigationInput.source ?? crop?.water_source ?? null;
    const availability = irrigationInput.availability ?? crop?.water_availability ?? null;
    const distance = irrigationInput.distance ?? crop?.water_distance ?? null;
    const qualityCoverage = irrigationInput.quality != null || irrigationInput.reliability != null
        ? 1
        : [source, availability, distance].filter((value) => value != null).length / 3;

    return {
        available,
        source,
        availability,
        distance,
        availabilityCoverage: available === null ? 0 : 1,
        qualityCoverage
    };
};
