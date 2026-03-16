import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { hashPassword, comparePassword} from "../utils/hash.js";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "1h";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";

const parseDurationToMs = (value) => {
    if (typeof value === "number") {
        return value * 1000;
    }
    if (typeof value !== "string") {
        throw new Error("Invalid duration type");
    }
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
        return Number(trimmed) * 1000;
    }
    const match = /^(\d+)([smhd])$/i.exec(trimmed);
    if (!match) {
        throw new Error(`Invalid duration format: ${value}`);
    }
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return amount * multipliers[unit];
};

const createAccessToken = (user) =>
    jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const createRefreshToken = () => crypto.randomBytes(64).toString("hex");
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const getRefreshExpiry = () => new Date(Date.now() + parseDurationToMs(REFRESH_TOKEN_TTL));


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

    try {
        if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
            return res.status(400).json({ error: "Missing credentials" });
        }

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

        const token = createAccessToken(user);
        const refreshToken = createRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);
        const refreshExpiresAt = getRefreshExpiry();

        await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [user.id]);
        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
            [user.id, refreshTokenHash, refreshExpiresAt]
        );

        return res.json({token, refreshToken});
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Server error during login" });
    }
};

export const refresh = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        if (typeof refreshToken !== "string" || !refreshToken.trim()) {
            return res.status(400).json({ error: "Missing refresh token" });
        }

        const refreshTokenHash = hashToken(refreshToken);
        const tokenResult = await pool.query(
            "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1",
            [refreshTokenHash]
        );

        if (tokenResult.rowCount === 0) {
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        const tokenRow = tokenResult.rows[0];
        if (tokenRow.revoked_at || new Date(tokenRow.expires_at) <= new Date()) {
            return res.status(401).json({ error: "Refresh token expired" });
        }

        const userResult = await pool.query("SELECT id, role FROM users WHERE id = $1", [tokenRow.user_id]);
        if (userResult.rowCount === 0) {
            return res.status(401).json({ error: "User not found" });
        }

        const user = userResult.rows[0];
        const newAccessToken = createAccessToken(user);
        const newRefreshToken = createRefreshToken();
        const newRefreshTokenHash = hashToken(newRefreshToken);
        const newRefreshExpiresAt = getRefreshExpiry();

        await pool.query(
            "UPDATE refresh_tokens SET token_hash = $1, expires_at = $2, revoked_at = NULL WHERE id = $3",
            [newRefreshTokenHash, newRefreshExpiresAt, tokenRow.id]
        );

        return res.json({ token: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
        console.error("Refresh error:", error);
        return res.status(500).json({ error: "Server error during refresh" });
    }
};

export const logout = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        if (typeof refreshToken !== "string" || !refreshToken.trim()) {
            return res.status(200).json({ success: true });
        }

        const refreshTokenHash = hashToken(refreshToken);
        await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1", [refreshTokenHash]);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ error: "Server error during logout" });
    }
};
