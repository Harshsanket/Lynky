export const BLOCKLIST_FORMATS = [
  "domains",
  "wildcard-domains",
  "hosts-file",
  "adblock",
  "full-urls",
  "auto",
] as const;

export type BlocklistFormat = (typeof BLOCKLIST_FORMATS)[number];
