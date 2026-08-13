import express from "express";
import { corsMiddleware } from "../middleware/cors.middleware.js";
import { jsonMiddleware } from "../middleware/json.middleware.js";
import { databaseConnectionMiddleware } from "../middleware/database.middleware.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { linkRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";


const app = express();

app.set("trust proxy", 1);
//middlewares
app.use(corsMiddleware);
app.use(jsonMiddleware);
app.use(rateLimitMiddleware);

//routes
import pingRoutes from "../routes/ping.routes.js";
app.use("/api/v1", pingRoutes);

import urlRoutes from "../routes/url.routes.js"
app.use("/api/v1", linkRateLimitMiddleware, databaseConnectionMiddleware, urlRoutes);

import redirect from "../routes/redirect.routes.js"
app.use("/", databaseConnectionMiddleware, redirect);

export default app;