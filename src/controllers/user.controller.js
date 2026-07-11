import pool from "../config/db.js";
import cloudinary from "../config/cloudinary.js";

export const getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const {rows} = await pool.query(
            `SELECT
                u.id,
                u.email,
                u.username,
                u.phone,
                u.photo,
                u.has_completed_setup,
                fp.county,
                fp.subcounty
             FROM users u
             LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = rows[0];

        return res.status(200).json({
            id: user.id,
            email: user.email,
            username: user.username,
            phone: user.phone,
            photo_url: user.photo ?? null,
            has_completed_setup: user.has_completed_setup,
            location: user.county || user.subcounty
                ? {
                    county: user.county,
                    subcounty: user.subcounty
                }
                : null
        });
    } catch (error) {
        console.error("Error in getMe:", error);
        return res.status(500).json({ message: "Server error retrieving user" });
    }
};

export const updateMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const { username, phone, location } = req.body;

        if (username !== undefined && (typeof username !== "string" || !username.trim())) {
            return res.status(400).json({ error: "Invalid username" });
        }

        if (phone !== undefined && (typeof phone !== "string" || !phone.trim())) {
            return res.status(400).json({ error: "Invalid phone number" });
        }

        if (location !== undefined) {
            const { county, subcounty } = location;
            if (!county || !subcounty) {
                return res.status(400).json({ error: "Location requires both county and subcounty" });
            }
        }

        if (username === undefined && phone === undefined && location === undefined) {
            return res.status(400).json({ error: "No fields to update" });
        }

        let updatedUser = null;

        if (username !== undefined || phone !== undefined) {
            const fields = [];
            const values = [];
            let idx = 1;

            if (username !== undefined) { fields.push(`username = $${idx++}`); values.push(username.trim()); }
            if (phone !== undefined)    { fields.push(`phone = $${idx++}`);    values.push(phone.trim()); }

            values.push(userId);
            const { rows } = await pool.query(
                `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, email, username, phone, has_completed_setup`,
                values
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            updatedUser = rows[0];
        }

        let updatedLocation = null;

        if (location !== undefined) {
            const { county, subcounty } = location;
            const { rows } = await pool.query(
                `UPDATE farmer_profiles
                 SET county = $1, subcounty = $2
                 WHERE user_id = $3
                 RETURNING county, subcounty`,
                [county, subcounty, userId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "Farmer profile not found — complete onboarding first" });
            }

            updatedLocation = rows[0];
        }

        return res.json({ success: true, user: updatedUser, location: updatedLocation });
    } catch (error) {
        console.error("updateMe error:", error);
        return res.status(500).json({ error: "Server error updating profile" });
    }
};


export const uploadPhoto = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No photo file provided" });
    }

    try {
        const photoUrl = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder:         "mkulima/profile_photos",
                    public_id:      `user_${req.user.id}`,
                    overwrite:      true,
                    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }]
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                }
            );
            stream.end(req.file.buffer);
        });

        const { rows } = await pool.query(
            `UPDATE users SET photo = $1 WHERE id = $2 RETURNING photo`,
            [photoUrl, req.user.id]
        );

        return res.json({ photo_url: rows[0].photo });
    } catch (error) {
        console.error("uploadPhoto error:", error);
        return res.status(500).json({ error: "Failed to upload photo" });
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
            INSERT INTO crops (farm_id, crop_type, acreage, planting_date, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (farm_id, crop_type)
            DO UPDATE SET
                acreage = EXCLUDED.acreage,
                planting_date = EXCLUDED.planting_date
            `;

            for (const crop of crops) {
                const rawDate = crop.plantingDate ?? crop.planting_date ?? null;
                const plantingDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? rawDate : null;
                await pool.query(cropsInsertQuery, [farm.id, crop.name, crop.acreage, plantingDate]);
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
