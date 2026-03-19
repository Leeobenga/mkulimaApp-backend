import pool from "../config/db.js";
import { getWeatherForLocation } from "../services/weather.service.js";

export const getMyWeather = async (req, res) => {
    try {
        const userId = req.user?.id;
        const requestedDays = req.query?.days;
        const parsedRequestedDays = Number(requestedDays);
        const normalizedRequestedDays =
            Number.isInteger(parsedRequestedDays) && parsedRequestedDays > 0
                ? parsedRequestedDays
                : undefined;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
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
        const weather = await getWeatherForLocation({
            county: profile.county,
            subcounty: profile.subcounty,
            days: requestedDays
        });

        return res.json({
            success: true,
            county: profile.county,
            subcounty: profile.subcounty,
            requested_days: normalizedRequestedDays,
            weather
        });
    } catch (error) {
        console.error("Weather controller error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
