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

// Helper to create a short verification token
const createVerificationToken = () => {
    return crypto.randomBytes(32).toString("hex");
};

const VERIFICATION_TTL = process.env.VERIFICATION_TTL || "1d";
const getVerificationExpiry = () => new Date(Date.now() + parseDurationToMs(VERIFICATION_TTL));

export const requestEmailVerification = async (req, res) => {
    const { userId, email } = req.body;

    if (!userId || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ message: "Missing parameters" });
    }

    try {
        const token = createVerificationToken();
        const tokenHash = hashToken(token);
        const expiresAt = getVerificationExpiry();

        // remove any existing email tokens for this user
        await pool.query("DELETE FROM verification_tokens WHERE user_id = $1 AND type = 'email'", [userId]);

        await pool.query(
            "INSERT INTO verification_tokens (user_id, token_hash, type, contact, expires_at) VALUES ($1, $2, 'email', $3, $4)",
            [userId, tokenHash, email, expiresAt]
        );

        // TODO: send email with token to user via email service. For now, return the token for client-side handling in development.
        return res.status(200).json({ success: true, token });
    } catch (error) {
        console.error("requestEmailVerification error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const requestPhoneVerification = async (req, res) => {
    const { userId, phone } = req.body;

    if (!userId || typeof phone !== "string" || !phone.trim()) {
        return res.status(400).json({ message: "Missing parameters" });
    }

    try {
        const token = createVerificationToken();
        const tokenHash = hashToken(token);
        const expiresAt = getVerificationExpiry();

        // remove any existing phone tokens for this user
        await pool.query("DELETE FROM verification_tokens WHERE user_id = $1 AND type = 'phone'", [userId]);

        await pool.query(
            "INSERT INTO verification_tokens (user_id, token_hash, type, contact, expires_at) VALUES ($1, $2, 'phone', $3, $4)",
            [userId, tokenHash, phone, expiresAt]
        );

        // TODO: send SMS to user with token via SMS provider. For now, return the token for client-side handling in development.
        return res.status(200).json({ success: true, token });
    } catch (error) {
        console.error("requestPhoneVerification error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const verifyEmail = async (req, res) => {
    const { userId, token } = req.body;

    if (!userId || typeof token !== "string") {
        return res.status(400).json({ message: "Missing parameters" });
    }

    try {
        const tokenHash = hashToken(token);
        const q = await pool.query(
            "SELECT id, user_id, type, expires_at FROM verification_tokens WHERE token_hash = $1 AND type = 'email'",
            [tokenHash]
        );

        if (q.rowCount === 0) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        const row = q.rows[0];
        if (row.user_id !== Number(userId) || new Date(row.expires_at) <= new Date()) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        await pool.query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
        await pool.query("DELETE FROM verification_tokens WHERE id = $1", [row.id]);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("verifyEmail error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const verifyPhone = async (req, res) => {
    const { userId, token, phone } = req.body;

    if (!userId || typeof token !== "string") {
        return res.status(400).json({ message: "Missing parameters" });
    }

    try {
        const tokenHash = hashToken(token);
        const q = await pool.query(
            "SELECT id, user_id, type, contact, expires_at FROM verification_tokens WHERE token_hash = $1 AND type = 'phone'",
            [tokenHash]
        );

        if (q.rowCount === 0) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        const row = q.rows[0];
        if (row.user_id !== Number(userId) || new Date(row.expires_at) <= new Date()) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Optionally verify phone matches the token record
        if (phone && row.contact && phone !== row.contact) {
            return res.status(400).json({ message: "Phone number mismatch" });
        }

        await pool.query("UPDATE users SET phone_verified = TRUE, phone = COALESCE($2, phone) WHERE id = $1", [userId, phone]);
        await pool.query("DELETE FROM verification_tokens WHERE id = $1", [row.id]);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("verifyPhone error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!user || !user.id) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword.trim() || !newPassword.trim()) {
        return res.status(400).json({ message: "Missing passwords" });
    }

    try {
        const q = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
        if (q.rowCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const valid = await comparePassword(currentPassword, q.rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        const newHash = await hashPassword(newPassword);
        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, user.id]);

        // Revoke all refresh tokens for the user to force re-login
        await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1", [user.id]);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("changePassword error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
