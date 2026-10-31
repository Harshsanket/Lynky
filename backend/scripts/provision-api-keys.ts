import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../database/index.database.js";
import { provisionApiKey } from "../service/api-key.service.js";

/**
 * CLI script: `npm run provision:keys -- <count>` (default 10).
 *
 * Creates API keys and prints each raw secret as soon as it is stored, so a
 * mid-run failure never leaves a key whose secret was never shown. Only the
 * sha256 hashes are stored; the secrets cannot be recovered afterwards.
 */
const requested = Number(process.argv[2]);
const count =
  Number.isFinite(requested) && requested > 0
    ? Math.floor(requested)
    : 10;

const run = async () => {
  let created = 0;

  try {
    await connectDatabase();

    console.log(
      "\nSecrets are stored as hashes. They are shown only once:\n"
    );

    for (let index = 1; index <= count; index++) {
      const secret = await provisionApiKey();

      created++;

      console.log(`${index}. ${secret}`);
    }

    console.log(
      `\nProvisioned ${created} API key(s). Distribute them securely. Do not commit or share them.\n`
    );
  } catch (error) {
    console.error(
      `Provisioning failed after ${created} key(s):`,
      error
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
