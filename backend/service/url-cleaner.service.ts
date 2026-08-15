import { isTrackingParameter } from "./tracking-checker.service.js";
import { CLEARURLS_PROVIDERS } from "./tracking-rules.loader.service.js";

export const cleanUrl = (
  inputUrl: string
): string => {
  const originalUrlString = inputUrl.trim();

  let url = new URL(originalUrlString);

  // 1. Remove global tracking parameters
  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParameter(key)) {
      url.searchParams.delete(key);
    }
  }

  // 2. Apply ClearURLs provider-specific rules
  for (const provider of CLEARURLS_PROVIDERS) {
    if (!provider.urlPattern.test(originalUrlString)) {
      continue;
    }

    // Don't clean URLs explicitly excluded by this provider
    const isException = provider.exceptions.some(
      (exception) => exception.test(originalUrlString)
    );

    if (isException) {
      continue;
    }

    // Remove all query parameters if required
    if (provider.completeProvider) {
      for (const key of [...url.searchParams.keys()]) {
        url.searchParams.delete(key);
      }
    } else {
      // Remove provider-specific query parameters
      for (const key of [...url.searchParams.keys()]) {
        for (const rule of provider.rules) {
          if (rule.test(key)) {
            url.searchParams.delete(key);
            break;
          }
        }
      }
    }

    // 3. Apply raw URL rules
    //
    // Example Amazon:
    // /ref=sr_1_3
    if (provider.rawRules.length > 0) {
      let cleanedUrlString = url.toString();

      for (const rawRule of provider.rawRules) {
        cleanedUrlString = cleanedUrlString.replace(
          rawRule,
          ""
        );
      }

      // Convert the modified string back into URL
      // so the rest of the cleaner can continue normally.
      url = new URL(cleanedUrlString);
    }

    break;
  }

  // 4. Normalize standard ports
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  // Keep fragments because they may be functional.

  return url.toString();
};