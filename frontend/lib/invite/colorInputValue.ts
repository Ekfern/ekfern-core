/**
 * HTML <input type="color" /> requires a valid hex. When the model allows an empty
 * or invalid string (user clearing the hex text field), use a fallback for the swatch only.
 */
export function colorInputValue(hex: string | undefined | null, fallback: string): string {
  if (hex && /^#[0-9A-Fa-f]{6}$/i.test(hex)) return hex
  return fallback
}
