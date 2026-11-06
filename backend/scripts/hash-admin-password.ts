import {
  createPasswordHash,
  validateAdminPasswordFormat,
} from "../src/utils/admin-password.js";

/**
 * Generate `SYSADMIN_PASSWORD_HASH` outside the running app:
 *
 *   npm run admin:hash-password -- 'CorrectHorseBattery1!'
 *
 * The app never generates or stores this hash at runtime; it only verifies it.
 */
const password = process.argv[2] ?? process.env.SYSADMIN_PASSWORD;

if (!password) {
  console.error(
    "Usage: npm run admin:hash-password -- '<password>' (or set SYSADMIN_PASSWORD)"
  );
  process.exit(1);
}

if (!validateAdminPasswordFormat(password)) {
  console.error(
    "Password must be 12-128 characters and include upper, lower, digit, and symbol."
  );
  process.exit(1);
}

console.log(createPasswordHash(password));
