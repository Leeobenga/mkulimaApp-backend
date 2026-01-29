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