import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "../database/index.database.js";
import { env } from "./config/env.js";

/**
 * Bootstrap: connect to MongoDB, then start the HTTP server.
 */
const startServer = async () => {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
};

startServer();