/**
 * Pure hostname helpers shared by the config validator/compiler and the
 * runtime artifact assertions. Deliberately free of zod, ipaddr.js, tldts, or
 * environment imports.
 */

const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const isValidHostname = (value: string): boolean => {
  if (
    value.length === 0 ||
    value.length > 253 ||
    value.includes("%") ||
    value.endsWith(".")
  ) {
    return false;
  }

  return value
    .split(".")
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        HOSTNAME_LABEL.test(label)
    );
};

/** Hosts hints may be stems, so a single label is valid. */
export const isValidHostHint = (value: string): boolean => {
  if (!value || value.length > 253 || value.includes("%")) {
    return false;
  }

  return value
    .split(".")
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        HOSTNAME_LABEL.test(label)
    );
};

export const normalizeHostname = (value: string): string =>
  value.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
