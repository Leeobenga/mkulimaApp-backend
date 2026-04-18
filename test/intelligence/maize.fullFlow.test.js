import assert from "node:assert/strict";
import test from "node:test";
import pool from "../../src/config/db.js";
import {
    getCurrentCropIntelligence,
    getCropIntelligence,
    getCropIntelligenceHistory
} from "../../src/controllers/crop.controller.js";
import { generateCropInsights } from "../../src/services/cropService.js";
import { maizeFlowScenarios } from "../fixtures/maizeScenarios.js";

const hasRecommendation = (result, fragment) =>
    result.recommendations.some((message) => message.includes(fragment));

const createJsonResponse = (payload, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
        return payload;
    }
});

const createMockResponse = () => {
    let statusCode = 200;
    let body = null;

    return {
        res: {
            status(code) {
                statusCode = code;
                return this;
            },
            json(payload) {
                body = payload;
                return this;
            }
        },
        get statusCode() {
            return statusCode;
        },
        get body() {
            return body;
        }
    };
};

test("generateCropInsights carries a maize scenario through weather, crop, and irrigation normalization", async () => {
    const scenario = maizeFlowScenarios.hotDryReproductiveWithIrrigation;
    const [result] = await generateCropInsights({
        weatherData: scenario.weatherServiceData,
        crops: scenario.request.body.crops,
        irrigation: scenario.request.body.irrigation
    });

    assert.equal(result.crop, "maize");
    assert.equal(result.stage, "Reproductive");
    assert.equal(result.stageSource, "explicit");
    assert.equal(result.analysisWindow.basis, "current_plus_forecast");
    assert.equal(result.analysisWindow.days, 3);
    assert.equal(result.riskDetail.components.water.hasIrrigation, true);
    assert.equal(result.riskDetail.components.water.irrigationMitigatesRisk, true);
    assert.equal(result.confidence.irrigationContext.available, true);
    assert.ok(result.drivers.includes("Temperature stress"));
    assert.ok(result.drivers.includes("Water stress"));
    assert.ok(hasRecommendation(result, "Activate irrigation system within 48 hours"));
    assert.ok(hasRecommendation(result, "Protect pollination and grain fill from heat stress"));
    assert.ok(!hasRecommendation(result, "Irrigation recommended within 48 hours"));
});

test("getCropIntelligence runs a maize scenario from profile lookup to response payload", async (t) => {
    const scenario = maizeFlowScenarios.hotDryReproductiveWithIrrigation;
    const fetchCalls = [];
    const historyInserts = [];

    t.mock.method(pool, "query", async (queryText, params) => {
        if (/FROM farmer_profiles/i.test(queryText)) {
            assert.deepEqual(params, [42]);

            return {
                rowCount: 1,
                rows: [scenario.profile]
            };
        }

        if (/INSERT INTO crop_intelligence_history/i.test(queryText)) {
            historyInserts.push(params);
            return {
                rowCount: 1,
                rows: [
                    {
                        id: historyInserts.length,
                        run_group_id: "run-group-1",
                        crop_type: params[4],
                        created_at: "2026-04-18T08:00:00.000Z"
                    }
                ]
            };
        }

        throw new Error(`Unexpected query: ${queryText}`);
    });

    t.mock.method(global, "fetch", async (url) => {
        const requestUrl = new URL(url);
        fetchCalls.push(requestUrl);

        if (requestUrl.hostname === "geocoding-api.open-meteo.com") {
            return createJsonResponse(scenario.geocodingResponse);
        }

        if (requestUrl.hostname === "api.open-meteo.com") {
            return createJsonResponse(scenario.forecastResponse);
        }

        throw new Error(`Unexpected fetch URL: ${requestUrl.toString()}`);
    });

    const response = createMockResponse();

    await getCropIntelligence(
        {
            user: { id: 42 },
            body: scenario.request.body,
            query: scenario.request.query
        },
        response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[0].searchParams.get("name"), scenario.profile.subcounty);
    assert.equal(fetchCalls[1].searchParams.get("forecast_days"), scenario.request.query.days);
    assert.equal(response.body.success, true);
    assert.equal(response.body.county, scenario.profile.county);
    assert.equal(response.body.subcounty, scenario.profile.subcounty);
    assert.equal(response.body.weather.available, true);
    assert.equal(response.body.historySaved, true);
    assert.equal(response.body.historyCount, 1);
    assert.equal(response.body.historyRunGroupId, "run-group-1");
    assert.equal(historyInserts.length, 1);
    assert.equal(historyInserts[0][1], 42);
    assert.equal(historyInserts[0][4], "maize");

    const [result] = response.body.data;

    assert.equal(result.crop, "maize");
    assert.equal(result.stage, "Reproductive");
    assert.equal(result.stageSource, "explicit");
    assert.equal(result.riskDetail.forecast.summary.windowDays, 3);
    assert.equal(result.riskDetail.components.water.hasIrrigation, true);
    assert.ok(result.riskScore >= 60);
    assert.ok(result.drivers.includes("Temperature stress"));
    assert.ok(result.drivers.includes("Water stress"));
    assert.ok(hasRecommendation(result, "Activate irrigation system within 48 hours"));
    assert.ok(hasRecommendation(result, "Overall maize risk is high"));
});

test("getCurrentCropIntelligence uses the farmer's saved crops and farm water context automatically", async (t) => {
    const scenario = maizeFlowScenarios.hotDryReproductiveWithIrrigation;
    const fetchCalls = [];
    const historyInserts = [];

    t.mock.method(pool, "query", async (queryText, params) => {
        if (/LEFT JOIN farms/i.test(queryText) && /LEFT JOIN crops/i.test(queryText)) {
            assert.deepEqual(params, [42]);

            return {
                rowCount: 1,
                rows: [
                    {
                        farmer_county: scenario.profile.county,
                        farmer_subcounty: scenario.profile.subcounty,
                        farm_id: "farm-1",
                        water_source: "canal",
                        water_availability: "reliable",
                        water_distance: "near",
                        currently_irrigating: true,
                        crop_id: "crop-1",
                        crop_type: "MAIZE",
                        acreage: 2.5,
                        planting_date: null,
                        growth_stage: "reproductive"
                    }
                ]
            };
        }

        if (/INSERT INTO crop_intelligence_history/i.test(queryText)) {
            historyInserts.push(params);
            return {
                rowCount: 1,
                rows: [
                    {
                        id: historyInserts.length,
                        run_group_id: "run-group-current-1",
                        crop_type: params[4],
                        created_at: "2026-04-18T08:00:00.000Z"
                    }
                ]
            };
        }

        throw new Error(`Unexpected query: ${queryText}`);
    });

    t.mock.method(global, "fetch", async (url) => {
        const requestUrl = new URL(url);
        fetchCalls.push(requestUrl);

        if (requestUrl.hostname === "geocoding-api.open-meteo.com") {
            return createJsonResponse(scenario.geocodingResponse);
        }

        if (requestUrl.hostname === "api.open-meteo.com") {
            return createJsonResponse(scenario.forecastResponse);
        }

        throw new Error(`Unexpected fetch URL: ${requestUrl.toString()}`);
    });

    const response = createMockResponse();

    await getCurrentCropIntelligence(
        {
            user: { id: 42 },
            query: { days: "3" }
        },
        response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 2);
    assert.equal(response.body.success, true);
    assert.equal(response.body.source, "saved_crops");
    assert.equal(response.body.savedCropsCount, 1);
    assert.equal(response.body.farmCount, 1);
    assert.equal(response.body.historySaved, true);
    assert.equal(response.body.historyRunGroupId, "run-group-current-1");
    assert.equal(historyInserts.length, 1);
    assert.equal(historyInserts[0][1], 42);
    assert.equal(historyInserts[0][2], "crop-1");
    assert.equal(historyInserts[0][3], "farm-1");

    const [result] = response.body.data;

    assert.equal(result.crop, "maize");
    assert.equal(result.stage, "Reproductive");
    assert.equal(result.stageSource, "explicit");
    assert.equal(result.riskDetail.components.water.hasIrrigation, true);
    assert.equal(result.riskDetail.components.water.irrigationMitigatesRisk, true);
    assert.ok(result.drivers.includes("Water stress"));
    assert.ok(hasRecommendation(result, "Activate irrigation system within 48 hours"));
});

test("getCropIntelligenceHistory returns persisted crop intelligence runs for the authenticated user", async (t) => {
    t.mock.method(pool, "query", async (queryText, params) => {
        assert.match(queryText, /FROM crop_intelligence_history/i);
        assert.deepEqual(params, [42, "maize", 5]);

        return {
            rowCount: 1,
            rows: [
                {
                    id: 11,
                    run_group_id: "run-group-2",
                    user_id: 42,
                    crop_id: null,
                    farm_id: null,
                    crop_type: "maize",
                    stage: "Reproductive",
                    stage_source: "explicit",
                    county: "Trans Nzoia",
                    subcounty: "Kitale",
                    risk_score: 84,
                    confidence_score: 91,
                    model_version: "stage-threshold-v4",
                    drivers: ["Temperature stress", "Water stress"],
                    risks: ["Critical reproductive stage stress"],
                    recommendations: [
                        "Protect pollination and grain fill from heat stress with timely irrigation and midday moisture conservation."
                    ],
                    crop_input: { crop_type: "MAIZE", growth_stage: "reproductive" },
                    request_context: { requestedDays: 3 },
                    weather_snapshot: { available: true },
                    result_snapshot: { crop: "maize", riskScore: 84 },
                    created_at: "2026-04-18T08:00:00.000Z"
                }
            ]
        };
    });

    const response = createMockResponse();

    await getCropIntelligenceHistory(
        {
            user: { id: 42 },
            query: { limit: "5", cropType: "maize" }
        },
        response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.count, 1);
    assert.deepEqual(response.body.filters, {
        limit: 5,
        cropType: "maize"
    });
    assert.equal(response.body.history[0].runGroupId, "run-group-2");
    assert.equal(response.body.history[0].cropType, "maize");
    assert.equal(response.body.history[0].riskScore, 84);
    assert.deepEqual(response.body.history[0].drivers, ["Temperature stress", "Water stress"]);
    assert.deepEqual(response.body.history[0].requestContext, { requestedDays: 3 });
});
