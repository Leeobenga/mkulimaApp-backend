import pool from "../config/db.js";

export const getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const {rows} = await pool.query(
            `SELECT id, email, username, has_completed_setup FROM users
            WHERE id = $1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = rows[0];

        return res.status(200).json(user);
    } catch (error) {
        console.error("Error in getMe:", error);
        return res.status(500).json({ message: "Server error retrieving user" });
    }
};

export const completeOnboarding = async (req, res) => {
    const userId = req.user.id;

    const { 
        location,
        farming,
        waterAccess
    } = req.body;

    if (!location || !farming || !waterAccess)
        return res.status(400).json({ error: "Incomplete onboarding data" });

    const { county, subcounty } = location;

    const { farmSize, crops = [], livestock= [] } = farming;

    const farmingType = farming.farmingType.toLowerCase().trim();
    const waterSource = waterAccess.source.toLowerCase().trim();
    const waterAvailability = waterAccess.availability.toLowerCase().trim();
    const waterDistance = waterAccess.distance.toLowerCase().trim();
    const currentlyIrrigating = waterAccess.irrigating;
    const interestedInIrrigation = waterAccess.interestedInIrrigation;

    const allowedSources = ['borehole', 'well', 'river', 'dam', 'rainfed', 'municipal', 'lake', 'other'];
    const allowedAvailability = ['year_round', 'seasonal', 'unknown'];
    const allowedDistance = ['on_farm', 'near', 'medium', 'far']

    if(!county || !subcounty) 
        return res.status(400).json({ error: "Location required" });

    if (!["crop", "livestock", "mixed"].includes(farmingType))
        return res.status(400).json({ error: "Invalid farming type" });
    
    if(!farmingType)
        return res.status(400).json({ error: "Farming type required" });

    if (!farmSize || Number(farmSize) <= 0) 
        return res.status(400).json({ error: "Invalid farm size" });


        //water access checks

    if (!allowedSources.includes(waterSource))
        return res.status(400).json({
            error: "Invalid water source"
        });
    
    if (!allowedAvailability.includes(waterAvailability))
        return res.status(400).json({
            error: "Invalid water availability"
        });
    
    if (!allowedDistance.includes(waterDistance))
        return res.status(400).json({
            error: "Invalid water distance"
        });

    if (typeof currentlyIrrigating !== "boolean")
        return res.status(400).json({
            error: "Invalid irrigation flag"
        });

    if (currentlyIrrigating === false && typeof interestedInIrrigation !== 'boolean')
        return res.status(400).json({
            error: "Must indicate interest in irrigation" 
        });

    
    //logical consistence checks
    if (farmingType === "crop" && livestock.length > 0) {
        return res.status(400).json({ 
            error: "Livestock cannot be provided for crop-only farmers"
        });
    }

    if (farmingType === "livestock" && crops.length > 0) {
        return res.status(400).json({
            error: "Crops cannot be provided for livestock-only farmers",
        });
    }

    if (farmingType !== "crop" && livestock.length === 0 && farmingType === "mixed") {
        return res.status(400).json({
            error: " Mixed farming must include livestock"
        })
    }


    try{
        const farmerProfileQuery = `
        INSERT INTO farmer_profiles (user_id, county, subcounty, farming_type, interested_in_irrigation, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT(user_id)
        DO UPDATE SET
            county = EXCLUDED.county,
            subcounty = EXCLUDED.subcounty,
            farming_type = EXCLUDED.farming_type,
            interested_in_irrigation = EXCLUDED.interested_in_irrigation
        RETURNING id, user_id, county, subcounty, farming_type, interested_in_irrigation;
        `;

        const farmerProfileValues = [
            userId,
            county,
            subcounty,
            farmingType,
            interestedInIrrigation            
        ];

        const farmerProfileResult = await pool.query(farmerProfileQuery, farmerProfileValues);

        if (!farmerProfileResult.rows.length) {
            throw new Error("Failed to insert or update farmer profile");
        }

        const farmerProfile = farmerProfileResult.rows[0];

        const farmQuery = `
        INSERT INTO farms (farmer_profile_id, county, subcounty, total_size, size_unit,
                water_source, water_availability, water_distance, currently_irrigating, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (farmer_profile_id)
        DO UPDATE SET
            county = EXCLUDED.county,
            subcounty = EXCLUDED.subcounty,
            total_size = EXCLUDED.total_size,
            size_unit = EXCLUDED.size_unit,
            water_source = EXCLUDED.water_source,
            water_availability = EXCLUDED.water_availability,
            water_distance = EXCLUDED.water_distance,
            currently_irrigating = EXCLUDED.currently_irrigating
        RETURNING id, county, subcounty, total_size, size_unit, water_source,
                water_availability, water_distance, currently_irrigating;
        `;

        const farmValues = [
            farmerProfile.id,            
            county,
            subcounty,
            farmSize,
            "acres",
            waterSource,
            waterAvailability,
            waterDistance,
            currentlyIrrigating
        ];

        const farmResult = await pool.query(farmQuery, farmValues);

        if (!farmResult.rows.length) {
            throw new Error("Failed to insert farm details");
        }

        const farm = farmResult.rows[0];

        if (crops.length > 0) {
            const cropsInsertQuery = `
            INSERT INTO crops (farm_id, crop_type, acreage, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (farmer_id, crop_type)
            DO UPDATE SET acreage = EXCLUDE.acreage
            `;
            
            for (const crop of crops) {
                await pool.query(cropsInsertQuery, [farm.id, crop.name, crop.acreage]);
            }
        }

        await pool.query(
            `UPDATE users
            SET has_completed_setup = TRUE
            WHERE id = $1`,
            [userId]
        );

        return res.json({
            success: true,
            farmerProfile,
            farm
        });
    } catch (error) {
        console.error("Onboarding error:", error)
        res.status(500).json({ error: "Onboarding failed" });
    }
    
};