import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import { hashPassword, comparePassword} from "../utils/hash.js";


export const register = async (req, res) => {
    const { username, email, password } = req.body;

    try {        

        if (!username?.trim() || !email?.trim() || !password?.trim()) {
            return res.status(400).json({ message: "Missing fields" });
        };

        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email = $1 ",
            [email]
        );

        if (existingUser.rows.length > 0) {            
            return res.status(409).json({ message: "User already exists" });
        };
        
        const passwordHash = await hashPassword(password);

        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, role",
            [username, email, passwordHash]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: "Server Error!"});
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
    );
   
    if (result.rowCount === 0) {
        return res.status(401).json({error: "Invalid credentials"});
    }

    const user = result.rows[0];

    const valid = await comparePassword(password, user.password_hash);
    

    if (!valid) {
        return res.status(401).json({error: "Invalid credentials"});
    }


    const token = jwt.sign(
        {id: user.id, role: user.role},
        process.env.JWT_SECRET,
        {expiresIn: "1h"}
    );

    res.json({token});
};

export const getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const {rows} = await pool.query(
            `SELECT id, email, has_completed_setup FROM users
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

    const { county, 
        subcounty, 
        farmSize, 
        waterSource, 
        crops = [], 
        livestock = [], 
        farmingType 
    } = req.body;


    if(!county || subcounty) 
        return res.status(400).json({ error: "Location required" });

    if (!["crop", "livestock", "mixed"].includes(farmingType))
        return res.status(400).json({ error: "Invalid farming type" });
    
    if(!farmingType)
        return res.status(400).json({ error: "Farming type required" });

    if (!farmSize || farmSize <= 0) 
        return res.status(400).json({ error: "Invalid farm size" });

    if (!waterSource)
        return res.status(400).json({ error: "water source required" })

    try{
        await pool.query(
            `
            INSERT INTO farmer_profiles (user_id, county, subcounty, farming_type, livestock, crops, farm_size, water_source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)

            ON CONFLICT (user_id)
            DO UPDATE SET
                county = EXCLUDED.county,
                subcounty = EXCLUDED.subcounty, 
                farming_type = EXCLUDED.farming_type,              
                livestock = EXCLUDED.livestock,
                crops = EXCLUDED.crops,                
                farm_size = EXCLUDED.farm_size,
                water_source = EXCLUDED.water_source
            `,
            [userId, county, subcounty, farmingType, livestock, crops, farmSize, waterSource]
        );

        await pool.query(
            `UPDATE users
            SET has_completed_setup = TRUE
            WHERE id = $1`,
            [userId]
        );

        return res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Onboarding failed" });
    }
    
};