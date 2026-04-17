import pool from "../config/db.js";
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

        const profileResult = await pool.query(
            `SELECT county, subcounty
             FROM farmer_profiles
             WHERE user_id = $1`,
            [userId]
        );

        if (profileResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Farmer profile not found"
            });
        }

        const profile = profileResult.rows[0];
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

        res.json({
            success: true,
            county: profile.county,
            subcounty: profile.subcounty,
            weather: weatherData,
            data: insights,
            historySaved,
            historyCount: historyEntries.length,
            historyRunGroupId: historyEntries[0]?.run_group_id ?? null
        });
    } catch (error) {
        console.error("Error generating crop insights:", error);
        res.status(500).json({ success: false, message: "Failed to generate crop insights" });
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
