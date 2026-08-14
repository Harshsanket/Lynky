export const TRACKING_PATTERNS = [
  /^utm_/i,

  // Google Analytics linker params
  /^_ga(?:_|$)/i,

  // HubSpot CTA
  /^hsctatracking$/i,

  // Adobe
  /^s_(?:cid|kwcid)$/i,
];