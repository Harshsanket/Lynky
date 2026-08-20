/**
 * Shared typography style tokens.
 *
 * The design system uses three font stacks defined as CSS variables in
 * `src/index.css`. These objects are spread into inline `style` props across
 * the site; centralising them avoids repeating the same three literals in
 * every page/component.
 */

export const mono = { fontFamily: "var(--font-mono)" };
export const body = { fontFamily: "var(--font-body)" };
export const display = { fontFamily: "var(--font-display)" };