import { hash as cryptoHash } from "node:crypto";

/**
 * One SHA-256 pass yields the two bucket/slot hashes and the 64-bit
 * verification value. Using a vetted hash keeps the build-time MPHF generator
 * and runtime lookup in exact agreement without hand-rolled hash math.
 */
export interface KeyHash {
  h1: number;
  h2: number;
  lo: number;
  hi: number;
}

export const hashKey = (key: string, seed: number): KeyHash => {
  const digest = cryptoHash(
    "sha256",
    `${seed}:${key}`,
    "buffer"
  ) as Buffer;

  return {
    h1: digest.readUInt32LE(0),
    h2: digest.readUInt32LE(4),
    lo: digest.readUInt32LE(8),
    hi: digest.readUInt32LE(12),
  };
};
