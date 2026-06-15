import pool from "../config/db.js";
import { GROWTH_STAGES } from "../intelligence/cropStage.js";

const getRequestedFarmName = (body) => {
    if (!body || typeof body !== "object") {
        return undefined;
    }

    return body.name ?? body.farmName ?? body.farm_name;
};

export const updateFarm = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { farmId } = req.params;
        const farmName = getRequestedFarmName(req.body);

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        if (!farmId) {
            return res.status(400).json({ success: false, message: "Farm id is required" });
        }

        if (typeof farmName !== "string" || farmName.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Farm name is required"
            });
        }

        const result = await pool.query(
            `UPDATE farms f
             SET farm_name = $1
             FROM farmer_profiles fp
             WHERE f.id = $2
               AND f.farmer_profile_id = fp.id
               AND fp.user_id = $3
             RETURNING
                f.id,
                f.farm_name,
                f.county,
                f.subcounty,
                f.total_size,
                f.size_unit,
                f.water_source,
                f.water_availability,
                f.water_distance,
                f.currently_irrigating,
                f.created_at`,
            [farmName.trim(), farmId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Farm not found"
            });
        }

        const farm = result.rows[0];

        return res.json({
            success: true,
            farm: {
                id: farm.id,
                name: farm.farm_name ?? "Unnamed Farm",
                county: farm.county,
                subcounty: farm.subcounty,
                total_size: farm.total_size,
                size_unit: farm.size_unit,
                water_source: farm.water_source,
                water_availability: farm.water_availability,
                water_distance: farm.water_distance,
                currently_irrigating: farm.currently_irrigating,
                created_at: farm.created_at
            }
        });
    } catch (error) {
        console.error("Farm update error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const addCrop = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { farmId } = req.params;
        const { crop_type, acreage, planting_date, growth_stage } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        if (typeof crop_type !== "string" || !crop_type.trim()) {
            return res.status(400).json({ success: false, message: "crop_type is required" });
        }

        if (acreage !== undefined && (typeof acreage !== "number" || acreage <= 0)) {
            return res.status(400).json({ success: false, message: "Acreage must be a positive number" });
        }

        if (planting_date !== undefined && isNaN(new Date(planting_date).getTime())) {
            return res.status(400).json({ success: false, message: "Invalid planting date" });
        }

        const validStages = GROWTH_STAGES.filter((s) => s !== "Unknown");
        if (growth_stage !== undefined && !validStages.includes(growth_stage)) {
            return res.status(400).json({
                success: false,
                message: `Invalid growth stage. Must be one of: ${validStages.join(", ")}`
            });
        }

        const { rows } = await pool.query(
            `WITH owned_farm AS (
                SELECT f.id
                FROM farms f
                JOIN farmer_profiles fp ON fp.id = f.farmer_profile_id
                WHERE f.id = $1 AND fp.user_id = $2
            )
            INSERT INTO crops (farm_id, crop_type, acreage, planting_date, growth_stage, created_at)
            SELECT $1, $3, $4, $5, $6, NOW()
            FROM owned_farm
            RETURNING id, farm_id, crop_type, acreage, planting_date, growth_stage`,
            [farmId, userId, crop_type.trim(), acreage ?? null, planting_date ?? null, growth_stage ?? null]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Farm not found" });
        }

        return res.status(201).json({ success: true, crop: rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "This crop type already exists on the farm" });
        }

        console.error("addCrop error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
