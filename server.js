import dotenv from "dotenv";

dotenv.config();

import app from "./src/App.js";
import pool from "./src/config/db.js";

// Log env variables to check dotenv
console.log("ENV CHECK:", {
    PORT: process.env.PORT,
    DB_URL: !!process.env.DB_URL,
    JWT_SECRET: !!process.env.JWT_SECRET
});

async function startServer() {
    try {
        await pool.query("SELECT 1");
        console.log("Database connected");

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
        console.log(`Server running  on port ${PORT}`);
        });
    } catch (err) {
        console.error("Database connection failed");
        process.exit(1);
    }    
};

startServer();





