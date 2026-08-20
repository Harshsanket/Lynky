import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../database/index.database.js";
import { provisionApiKeys } from "../service/api-key.service.js";

/**
 * CLI script: `npm run provision:keys -- <count>` (default 10).
 *
 * Creates API keys and prints the raw secrets exactly once. Only the sha256
 * hashes are stored; the secrets cannot be recovered afterwards.
 */
const count = Math.max(
  1,
  Number(process.argv[2]) || 10
);

const run = async () => {
  try {
    await connectDatabase();

    const secrets = await provisionApiKeys(count);

    console.log(
      `\nProvisioned ${secrets.length} API key(s).`
    );

    console.log(
      "\nSecrets are stored as hashes. They are shown only once:\n"
    );

    secrets.forEach((secret, index) => {
      console.log(`${index + 1}. ${secret}`);
    });

    console.log(
      "\nDistribute these securely. Do not commit or share them.\n"
    );
  } catch (error) {
    console.error("Provisioning failed:", error);

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
