import assert from "node:assert/strict";
import test from "node:test";
import { getWaterAvailability } from "../../src/intelligence/waterEngine.js";
import { normalizeEngineWeather } from "../../src/intelligence/shared/weatherSchema.js";
import { normalizeWeatherData } from "../../src/services/weather.service.js";
import { maizeScenarios } from "../fixtures/maizeScenarios.js";

test("normalizeWeatherData preserves null rainfall when weather input is empty", () => {
    const weather = normalizeWeatherData({});

    assert.equal(weather.rainfall.observedMm, null);
    assert.equal(weather.rainfall.forecastWindowMm, null);
    assert.equal(weather.rainfall.analysisWindowMm, null);
});

test("normalizeEngineWeather preserves null rainfall in the shared schema", () => {
    const weather = normalizeEngineWeather({});

    assert.equal(weather.rainfall.observedMm, null);
    assert.equal(weather.rainfall.forecastWindowMm, null);
    assert.equal(weather.rainfall.analysisWindowMm, null);
});

test("water engine does not generate water stress when rainfall is missing", () => {
    const result = getWaterAvailability(
        normalizeEngineWeather({}),
        { growthStage: "Reproductive" },
        {},
        "maize"
    );

    assert.equal(result.rainfallRisk, 0);
    assert.equal(result.adjustedRainfallRisk, 0);
    assert.equal(result.risk, undefined);
    assert.deepEqual(result.recommendations, []);
});

test("water engine uses observed rainfall when forecast rainfall is missing", () => {
    const result = getWaterAvailability(
        normalizeEngineWeather({
            rainfall: {
                observedMm: 8,
                forecastWindowMm: null,
                analysisWindowMm: 8
            }
        }),
        { growthStage: "Vegetative" },
        {},
        "maize"
    );

    assert.equal(result.rainfallRisk, 0.5);
    assert.equal(result.adjustedRainfallRisk, 0.5);
    assert.equal(result.risk, undefined);
});

test("water engine lowers dry-weather risk when irrigation is available", () => {
    const dryWeather = normalizeEngineWeather(maizeScenarios.dryReproductiveNoIrrigation.weather);
    const noIrrigation = getWaterAvailability(
        dryWeather,
        maizeScenarios.dryReproductiveNoIrrigation.crop,
        {},
        "maize"
    );
    const withIrrigation = getWaterAvailability(
        dryWeather,
        maizeScenarios.dryReproductiveWithIrrigation.crop,
        maizeScenarios.dryReproductiveWithIrrigation.irrigation,
        "maize"
    );

    assert.ok(withIrrigation.adjustedRainfallRisk < noIrrigation.adjustedRainfallRisk);
    assert.equal(withIrrigation.irrigationMitigatesRisk, true);
});
