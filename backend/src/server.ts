import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "../database/index.database.js";

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();