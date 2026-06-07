import pool from "../config/db.js";

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
