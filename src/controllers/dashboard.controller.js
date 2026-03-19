import pool from "../config/db.js";

export const getDashboard = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }
        const query = `
        SELECT
            fp.id AS farmer_profile_id,
            fp.user_id,
            fp.county AS farmer_county,
            fp.subcounty AS farmer_subcounty,
            fp.farming_type,

            f.id AS farm_id,
            f.farm_name,
            f.county AS farm_county,
            f.subcounty AS farm_subcounty,
            f.total_size,
            f.size_unit,
            f.water_source,
            f.water_availability,
            f.water_distance,
            f.currently_irrigating,
            f.created_at AS farm_created_at,

            c.id AS crop_id,
            c.crop_type,
            c.acreage,
            c.planting_date,
            c.growth_stage

        FROM farmer_profiles fp
        JOIN farms f ON f.farmer_profile_id = fp.id
        LEFT JOIN crops c ON c.farm_id = f.id
        WHERE fp.user_id = $1
        ORDER BY f.id, c.id
        `;

        const result = await pool.query(query, [userId]);

        //transform rows into nested structure: farms -> crops
        const farmsMap = new Map();

        for (const row of result.rows) {
            if(!farmsMap.has(row.farm_id)) {
                farmsMap.set(row.farm_id, {
                    id: row.farm_id,
                    name: row.farm_name ?? "Unnamed Farm",
                    county: row.farm_county,
                    subcounty: row.farm_subcounty,
                    total_size: row.total_size,
                    size_unit: row.size_unit,
                    water_source: row.water_source,
                    water_availability: row.water_availability,
                    water_distance: row.water_distance,
                    currently_irrigating: row.currently_irrigating,
                    created_at: row.farm_created_at,
                    crops: []
                });
            }
            if (row.crop_id) {
                farmsMap.get(row.farm_id).crops.push({
                    id: row.crop_id,
                    type: row.crop_type,
                    acreage: row.acreage,
                    planting_date: row.planting_date,
                    growth_stage: row.growth_stage
                })
            }
        }

        return res.json({
            success: true,
            farmer: {
                id: result.rows[0]?.farmer_profile_id,
                user_id: result.rows[0]?.user_id,
                county: result.rows[0]?.farmer_county,
                subcounty: result.rows[0]?.farmer_subcounty,
                farmingType: result.rows[0]?.farming_type
            },
            farms: Array.from(farmsMap.values())
        });
    } catch(error) {
        console.error("Dashboard fetch error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
