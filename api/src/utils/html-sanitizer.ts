import sanitizeHtml from "sanitize-html";

/**
 * Secure HTML sanitization configuration
 * Prevents XSS attacks while allowing safe HTML formatting
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "title", "width", "height"],
  },
  // Only allow HTTPS for image sources to prevent mixed content
  allowedSchemes: ["https"],
  allowedSchemesByTag: {
    img: ["https"],
  },
  // Disallow data URIs and javascript: URLs
  allowedSchemesAppliedToAttributes: ["src", "href"],
  // Remove any script-like attributes
  disallowedTagsMode: "discard",
  // Transform relative URLs to absolute
  transformTags: {
    img: (tagName, attribs) => {
      // Remove any event handlers (onclick, onerror, etc.)
      const safeAttribs: Record<string, string> = {};
      const allowedAttrs = ["src", "alt", "title", "width", "height"];

      for (const attr of allowedAttrs) {
        if (attribs[attr]) {
          safeAttribs[attr] = attribs[attr];
        }
      }

      return {
        tagName,
        attribs: safeAttribs,
      };
    },
  },
};

/**
 * Sanitize HTML content for community descriptions
 *
 * Security features:
 * - Removes all script tags and event handlers
 * - Only allows HTTPS images
 * - Strips data URIs and javascript: URLs
 * - Whitelists safe HTML tags and attributes
 *
 * @param html - Raw HTML content
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeCommunityDescription(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Sanitize HTML content with custom options
 */
export function sanitizeHtmlContent(
  html: string,
  options?: sanitizeHtml.IOptions,
): string {
  return sanitizeHtml(html, options || SANITIZE_OPTIONS);
}
