import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDatabase } from "../database/index.database.js";
import { env } from "./config/env.js";

/**
 * Bootstrap: connect to MongoDB, start the HTTP server, and shut down cleanly
 * on SIGTERM/SIGINT (draining in-flight requests before disconnecting).
 */
const startServer = async () => {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log(`${signal} received, shutting down...`);

    const forceExit = setTimeout(() => {
      console.error("Shutdown timed out; forcing exit.");
      process.exit(1);
    }, 10_000);

    forceExit.unref();

    server.close(async (error) => {
      clearTimeout(forceExit);

      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        console.error(
          "MongoDB disconnect failed during shutdown:",
          disconnectError
        );
      }

      process.exit(error ? 1 : 0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});
