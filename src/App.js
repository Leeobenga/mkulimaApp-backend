import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/healthRoutes.js";
import requestLogger from "./middleware/requestLogger.js";

const app = express();

//1. Early middleware (logs every request)
app.use(requestLogger);

//2. Body parsing
app.use(express.json());

//3. Cors
app.use(cors());

//4. Routes
app.use("/auth", authRoutes);
app.use("/", healthRoutes);

export default app;