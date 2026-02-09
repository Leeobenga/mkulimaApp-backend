import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        token = req.headers.authorization.split(" ")[1]
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

       const result = await pool.query(
        "SELECT id, email, username FROM users WHERE id = $1",
        [decoded.id]
       );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "User not found" })
        }

        req.user = result.rows[0];

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token Expired" })
        }

        return res.status(401).json({message:"Invalid token"})
    }

    
    
}