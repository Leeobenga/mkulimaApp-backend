import express from "express";
import pool from "../config/db.js";

const router = express.Router();

//checks server readiness
router.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});


//checks db-readiness
router.get("/db-health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.status(200).json({db: "ok"});
    } catch (err) {
        res.status(500).json({db: "down"});
    }
});

export default router;