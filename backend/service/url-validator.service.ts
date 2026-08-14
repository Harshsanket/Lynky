export const validateUrl = (inputUrl: string): URL => {
  if (
    !inputUrl ||
    typeof inputUrl !== "string" ||
    !inputUrl.trim()
  ) {
    throw new Error("URL is required");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(inputUrl.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are allowed"
    );
  }

  return parsedUrl;
};