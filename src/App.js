import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import cropRoutes from "./routes/cropRoutes.js";
import userRoutes from "./routes/user.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import weatherRoutes from "./routes/weather.routes.js";
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
app.use("/crops", cropRoutes);
app.use("/users", userRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/weather", weatherRoutes);
app.use("/", healthRoutes);

export default app;
