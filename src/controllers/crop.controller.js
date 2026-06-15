import pool from "../config/db.js";
import { GROWTH_STAGES } from "../intelligence/cropStage.js";
import { generateCropInsights } from "../services/cropService.js";
import {
    getCropIntelligenceHistoryEntries,
    persistCropIntelligenceHistory
} from "../services/cropIntelligenceHistory.service.js";
import { getWeatherForLocation } from "../services/weather.service.js";

const mapHistoryEntry = (entry) => ({
    id: entry.id,
    runGroupId: entry.run_group_id,
    userId: entry.user_id,
    cropId: entry.crop_id,
    farmId: entry.farm_id,
    cropType: entry.crop_type,
    stage: entry.stage,
    stageSource: entry.stage_source,
    county: entry.county,
    subcounty: entry.subcounty,
    riskScore: entry.risk_score,
    confidenceScore: entry.confidence_score,
    modelVersion: entry.model_version,
    drivers: entry.drivers,
    risks: entry.risks,
    recommendations: entry.recommendations,
    cropInput: entry.crop_input,
    requestContext: entry.request_context,
    weather: entry.weather_snapshot,
    result: entry.result_snapshot,
    createdAt: entry.created_at
});

const getFarmerProfile = async (userId) => {
    const profileResult = await pool.query(
        `SELECT county, subcounty
         FROM farmer_profiles
         WHERE user_id = $1`,
        [userId]
    );

    return profileResult.rowCount > 0 ? profileResult.rows[0] : null;
};

const getSavedCropsContext = async (userId) => {
    const result = await pool.query(
        `SELECT
            fp.county AS farmer_county,
            fp.subcounty AS farmer_subcounty,
            f.id AS farm_id,
            f.water_source,
            f.water_availability,
            f.water_distance,
            f.currently_irrigating,
            c.id AS crop_id,
            c.crop_type,
            c.acreage,
            c.planting_date,
            c.growth_stage
        FROM farmer_profiles fp
        LEFT JOIN farms f ON f.farmer_profile_id = fp.id
        LEFT JOIN crops c ON c.farm_id = f.id
        WHERE fp.user_id = $1
        ORDER BY f.id, c.id`,
        [userId]
    );

    if (result.rowCount === 0) {
        return {
            profile: null,
            crops: [],
            farmCount: 0
        };
    }

    const farmIds = new Set();
    const crops = result.rows
        .filter((row) => row.crop_id)
        .map((row) => {
            if (row.farm_id) {
                farmIds.add(String(row.farm_id));
            }

            return {
                id: row.crop_id,
                farm_id: row.farm_id,
                crop_type: row.crop_type,
                acreage: row.acreage,
                planting_date: row.planting_date,
                growth_stage: row.growth_stage,
                irrigation: {
                    available: row.currently_irrigating,
                    source: row.water_source,
                    availability: row.water_availability,
                    distance: row.water_distance
                }
            };
        });

    return {
        profile: {
            county: result.rows[0].farmer_county,
            subcounty: result.rows[0].farmer_subcounty
        },
        crops,
        farmCount: farmIds.size
    };
};

const saveIntelligenceHistorySafely = async ({
    userId,
    profile,
    weatherData,
    crops,
    insights,
    requestedDays,
    irrigation = null,
    calibration = null
}) => {
    let historyEntries = [];
    let historySaved = false;

    try {
        historyEntries = await persistCropIntelligenceHistory({
            userId,
            profile,
            weatherData,
            crops,
            insights,
            requestedDays,
            irrigation,
            calibration
        });
        historySaved = historyEntries.length === insights.length;
    } catch (historyError) {
        console.error("Crop intelligence history save error:", historyError);
    }

    return {
        historyEntries,
        historySaved
    };
};

const respondWithCropIntelligence = async ({
    res,
    userId,
    profile,
    crops,
    requestedDays,
    irrigation = null,
    calibration = null,
    extraResponse = {}
}) => {
    const weatherData = await getWeatherForLocation({
        county: profile.county,
        subcounty: profile.subcounty,
        days: requestedDays
    });

    if (!weatherData.available) {
        return res.status(502).json({
            success: false,
            message: "Unable to fetch weather for crop intelligence",
            county: profile.county,
            subcounty: profile.subcounty,
            weather: weatherData
        });
    }

    const insights = await generateCropInsights({
        weatherData,
        crops,
        irrigation,
        calibration
    });
    const {
        historyEntries,
        historySaved
    } = await saveIntelligenceHistorySafely({
        userId,
        profile,
        weatherData,
        crops,
        insights,
        requestedDays,
        irrigation,
        calibration
    });

    const data = insights.map((insight, index) => {
        const crop = crops[index];
        return {
            cropId: crop?.id ?? null,
            farmId: crop?.farm_id ?? null,
            acreage: crop?.acreage ?? null,
            planting_date: crop?.planting_date ?? null,
            ...insight
        };
    });

    return res.json({
        success: true,
        county: profile.county,
        subcounty: profile.subcounty,
        weather: weatherData,
        data,
        historySaved,
        historyCount: historyEntries.length,
        historyRunGroupId: historyEntries[0]?.run_group_id ?? null,
        ...extraResponse
    });
};

export const getCropIntelligence = async (req, res) => {
    try {
        const userId = req.user?.id;
        const {
            crops = [],
            irrigation = null,
            calibration = null
        } = req.body;
        const requestedDays = req.query?.days;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        if (!Array.isArray(crops) || crops.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one crop is required"
            });
        }

        const profile = await getFarmerProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Farmer profile not found"
            });
        }

        return respondWithCropIntelligence({
            res,
            userId,
            profile,
            crops,
            requestedDays,
            irrigation,
            calibration
        });
    } catch (error) {
        console.error("Error generating crop insights:", error);
        res.status(500).json({ success: false, message: "Failed to generate crop insights" });
    }
};

export const getCurrentCropIntelligence = async (req, res) => {
    try {
        const userId = req.user?.id;
        const requestedDays = req.query?.days;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        const {
            profile,
            crops,
            farmCount
        } = await getSavedCropsContext(userId);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Farmer profile not found"
            });
        }

        if (crops.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No saved crops found for this farmer"
            });
        }

        return respondWithCropIntelligence({
            res,
            userId,
            profile,
            crops,
            requestedDays,
            extraResponse: {
                source: "saved_crops",
                savedCropsCount: crops.length,
                farmCount
            }
        });
    } catch (error) {
        console.error("Error generating crop intelligence from saved crops:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate crop intelligence from saved crops"
        });
    }
};

export const getCropIntelligenceHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        const {
            entries,
            filters
        } = await getCropIntelligenceHistoryEntries({
            userId,
            limit: req.query?.limit,
            cropType: req.query?.cropType ?? req.query?.crop_type
        });

        return res.json({
            success: true,
            count: entries.length,
            filters,
            history: entries.map(mapHistoryEntry)
        });
    } catch (error) {
        if (error.code === "42P01") {
            return res.status(503).json({
                success: false,
                message: "Crop intelligence history is not ready"
            });
        }

        console.error("Error fetching crop intelligence history:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch crop intelligence history"
        });
    }
};

export const updateCrop = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { cropId } = req.params;
        const { acreage, planting_date, growth_stage } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        if (acreage !== undefined && (typeof acreage !== "number" || acreage <= 0)) {
            return res.status(400).json({ success: false, message: "Acreage must be a positive number" });
        }

        if (planting_date !== undefined) {
            const parsed = new Date(planting_date);
            if (isNaN(parsed.getTime())) {
                return res.status(400).json({ success: false, message: "Invalid planting date" });
            }
        }

        const validStages = GROWTH_STAGES.filter((s) => s !== "Unknown");
        if (growth_stage !== undefined && !validStages.includes(growth_stage)) {
            return res.status(400).json({
                success: false,
                message: `Invalid growth stage. Must be one of: ${validStages.join(", ")}`
            });
        }

        if (acreage === undefined && planting_date === undefined && growth_stage === undefined) {
            return res.status(400).json({ success: false, message: "No fields to update" });
        }

        const fields = [];
        const values = [];
        let idx = 1;

        if (acreage !== undefined)      { fields.push(`c.acreage = $${idx++}`);       values.push(acreage); }
        if (planting_date !== undefined) { fields.push(`c.planting_date = $${idx++}`); values.push(planting_date); }
        if (growth_stage !== undefined)  { fields.push(`c.growth_stage = $${idx++}`);  values.push(growth_stage); }

        values.push(cropId, userId);

        const { rows } = await pool.query(
            `UPDATE crops c
             SET ${fields.join(", ")}
             FROM farms f
             JOIN farmer_profiles fp ON fp.id = f.farmer_profile_id
             WHERE c.id = $${idx++}
               AND c.farm_id = f.id
               AND fp.user_id = $${idx}
             RETURNING c.id, c.crop_type, c.acreage, c.planting_date, c.growth_stage`,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Crop not found" });
        }

        return res.json({ success: true, crop: rows[0] });
    } catch (error) {
        console.error("updateCrop error:", error);
        return res.status(500).json({ success: false, message: "Server error updating crop" });
    }
};

export const deleteCrop = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { cropId } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        const { rowCount } = await pool.query(
            `DELETE FROM crops c
             USING farms f
             JOIN farmer_profiles fp ON fp.id = f.farmer_profile_id
             WHERE c.id = $1
               AND c.farm_id = f.id
               AND fp.user_id = $2`,
            [cropId, userId]
        );

        if (rowCount === 0) {
            return res.status(404).json({ success: false, message: "Crop not found" });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("deleteCrop error:", error);
        return res.status(500).json({ success: false, message: "Server error deleting crop" });
    }
};
