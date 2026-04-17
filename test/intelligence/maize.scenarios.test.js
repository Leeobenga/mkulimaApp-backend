import assert from "node:assert/strict";
import test from "node:test";
import { getMaizeInsights } from "../../src/intelligence/crops/maize/index.js";
import { maizeScenarios } from "../fixtures/maizeScenarios.js";

const hasRecommendation = (result, fragment) =>
    result.recommendations.some((message) => message.includes(fragment));

const hasDriver = (result, driver) => result.drivers.includes(driver);

test("empty weather keeps rainfall missing instead of fabricating drought actions", () => {
    const { weather, crop } = maizeScenarios.emptyWeatherReproductive;
    const result = getMaizeInsights(weather, crop);

    assert.equal(result.riskScore, 0);
    assert.equal(result.riskDetail.components.water.rainfallRisk, 0);
    assert.equal(result.riskDetail.components.water.adjustedRainfallRisk, 0);
    assert.ok(!hasDriver(result, "Water stress"));
    assert.ok(!hasRecommendation(result, "Irrigation recommended within 48 hours"));
    assert.ok(hasRecommendation(result, "Overall maize risk is low"));
    assert.ok(result.confidenceScore < 70);
});

test("normal vegetative weather stays low risk without stress actions", () => {
    const { weather, crop } = maizeScenarios.normalVegetative;
    const result = getMaizeInsights(weather, crop);

    assert.ok(result.riskScore <= 30);
    assert.equal(result.stage, "Vegetative");
    assert.ok(!hasDriver(result, "Temperature stress"));
    assert.ok(!hasRecommendation(result, "Protect pollination and grain fill from heat stress"));
    assert.ok(hasRecommendation(result, "Overall maize risk is low"));
});

test("hot dry reproductive weather raises temperature and water stress actions", () => {
    const { weather, crop } = maizeScenarios.hotDryReproductive;
    const result = getMaizeInsights(weather, crop);

    assert.ok(result.riskScore >= 80);
    assert.equal(result.stage, "Reproductive");
    assert.ok(hasDriver(result, "Temperature stress"));
    assert.ok(hasDriver(result, "Water stress"));
    assert.ok(hasRecommendation(result, "Protect pollination and grain fill from heat stress"));
    assert.ok(hasRecommendation(result, "Severe water stress for Maize during Reproductive stage"));
    assert.ok(hasRecommendation(result, "Overall maize risk is high"));
});

test("wet humid conditions trigger disease-conducive recommendations", () => {
    const { weather, crop } = maizeScenarios.wetHumidVegetative;
    const result = getMaizeInsights(weather, crop);

    assert.ok(result.riskScore >= 30);
    assert.ok(hasDriver(result, "Disease-conducive conditions"));
    assert.ok(hasRecommendation(result, "Increase scouting for foliar disease symptoms"));
    assert.ok(hasRecommendation(result, "Improve canopy airflow"));
    assert.ok(!hasRecommendation(result, "Protect pollination and grain fill from heat stress"));
});

test("irrigation buffers otherwise dry reproductive conditions", () => {
    const withoutIrrigation = getMaizeInsights(
        maizeScenarios.dryReproductiveNoIrrigation.weather,
        maizeScenarios.dryReproductiveNoIrrigation.crop
    );
    const withIrrigation = getMaizeInsights(
        maizeScenarios.dryReproductiveWithIrrigation.weather,
        maizeScenarios.dryReproductiveWithIrrigation.crop,
        {},
        maizeScenarios.dryReproductiveWithIrrigation.irrigation
    );

    assert.ok(
        withIrrigation.riskDetail.components.water.adjustedRainfallRisk
        < withoutIrrigation.riskDetail.components.water.adjustedRainfallRisk
    );
    assert.ok(
        withIrrigation.riskScore < withoutIrrigation.riskScore
    );
    assert.ok(hasRecommendation(withIrrigation, "Activate irrigation system within 48 hours"));
    assert.ok(!hasRecommendation(withIrrigation, "Irrigation recommended within 48 hours"));
});

test("planting date can derive stage with lower confidence than explicit stage", () => {
    const derived = getMaizeInsights(
        maizeScenarios.derivedStage.weather,
        maizeScenarios.derivedStage.crop
    );
    const explicit = getMaizeInsights(
        maizeScenarios.derivedStage.weather,
        { growthStage: "Vegetative" }
    );

    assert.equal(derived.stage, "Vegetative");
    assert.equal(derived.stageSource, "derived");
    assert.equal(explicit.stageSource, "explicit");
    assert.ok(derived.confidenceScore < explicit.confidenceScore);
});

test("missing stage falls back to Unknown without breaking the engine", () => {
    const { weather, crop } = maizeScenarios.unknownStage;
    const result = getMaizeInsights(weather, crop);

    assert.equal(result.stage, "Unknown");
    assert.equal(result.stageSource, "unknown");
    assert.ok(Number.isInteger(result.riskScore));
    assert.ok(result.confidenceScore < 70);
    assert.match(result.explanation, /Unknown stage/);
});
