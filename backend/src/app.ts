import express from "express";
import { corsMiddleware } from "../middleware/cors.middleware.js";
import { jsonMiddleware } from "../middleware/json.middleware.js";

const app = express();

//middlewares
app.use(corsMiddleware);
app.use(jsonMiddleware);

//routes
import pingRoutes from "../routes/ping.routes.js";
app.use("/api", pingRoutes);

export default app;