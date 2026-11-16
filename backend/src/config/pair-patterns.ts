/**
 * Pair patterns are tested against `${key}=${value}`. Purely literal anchored
 * pairs can use one lowercase Set lookup; everything else keeps a regex.
 */
export interface SplitPairPatterns {
  pairExact: string[];
  pairPatterns: string[];
}

const LITERAL_PAIR =
  /^\^([A-Za-z0-9_%.-]+)=([A-Za-z0-9_%.-]+)\$$/;

export const splitPairPatterns = (
  patterns: readonly string[]
): SplitPairPatterns => {
  const exact: string[] = [];
  const regex: string[] = [];

  for (const pattern of patterns) {
    const match = pattern.match(LITERAL_PAIR);

    if (match) {
      exact.push(`${match[1]}=${match[2]}`.toLowerCase());
    } else {
      regex.push(pattern);
    }
  }

  return {
    pairExact: [...new Set(exact)].sort(),
    pairPatterns: [...new Set(regex)].sort(),
  };
};
