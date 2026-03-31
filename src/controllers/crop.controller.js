import pool from "../config/db.js";
import { generateCropInsights } from "../services/cropService.js";
import { getWeatherForLocation } from "../services/weather.service.js";

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

        res.json({
            success: true,
            county: profile.county,
            subcounty: profile.subcounty,
            weather: weatherData,
            data: insights
        });
    } catch (error) {
        console.error("Error generating crop insights:", error);
        res.status(500).json({ success: false, message: "Failed to generate crop insights" });
    }
};
