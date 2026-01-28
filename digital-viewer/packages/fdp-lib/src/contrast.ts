/**
 * WCAG Contrast Validation
 *
 * Per SRS-001 SYS-FDP-005: Focus announcement shall have contrast ratio of at least 4.5:1 (WCAG AA)
 */

/** RGB color values */
export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to relative luminance
 * Per WCAG 2.0 definition
 */
export function getLuminance(rgb: RGB): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * Per WCAG 2.0 definition
 *
 * @returns Contrast ratio (1 to 21)
 */
export function getContrastRatio(color1: RGB, color2: RGB): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA requirement (4.5:1 for normal text)
 */
export function meetsWcagAA(foreground: string, background: string): boolean {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    console.warn('Invalid color format for WCAG check');
    return false;
  }

  const ratio = getContrastRatio(fgRgb, bgRgb);
  return ratio >= 4.5;
}

/**
 * Check if contrast ratio meets WCAG AAA requirement (7:1 for normal text)
 */
export function meetsWcagAAA(foreground: string, background: string): boolean {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    console.warn('Invalid color format for WCAG check');
    return false;
  }

  const ratio = getContrastRatio(fgRgb, bgRgb);
  return ratio >= 7;
}

/**
 * Get contrast ratio between two hex colors
 */
export function getContrastRatioHex(foreground: string, background: string): number | null {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) return null;

  return getContrastRatio(fgRgb, bgRgb);
}

/**
 * Suggest a foreground color that meets WCAG AA contrast
 */
export function suggestAccessibleColor(
  background: string,
  preferLight = true
): string {
  const bgRgb = hexToRgb(background);
  if (!bgRgb) return preferLight ? '#ffffff' : '#000000';

  const bgLuminance = getLuminance(bgRgb);

  // If background is dark, suggest white; if light, suggest black
  const whiteRatio = (1 + 0.05) / (bgLuminance + 0.05);
  const blackRatio = (bgLuminance + 0.05) / (0 + 0.05);

  if (preferLight) {
    return whiteRatio >= 4.5 ? '#ffffff' : '#000000';
  } else {
    return blackRatio >= 4.5 ? '#000000' : '#ffffff';
  }
}

/**
 * Validate FDP colors meet WCAG AA requirement
 * Per SRS SYS-FDP-005
 */
export function validateFdpColors(config: {
  backgroundColor: string;
  textColor: string;
  secondaryTextColor?: string;
}): {
  valid: boolean;
  primaryRatio: number;
  secondaryRatio?: number;
  issues: string[];
} {
  const issues: string[] = [];

  const primaryRatio = getContrastRatioHex(config.textColor, config.backgroundColor);
  const secondaryRatio = config.secondaryTextColor
    ? getContrastRatioHex(config.secondaryTextColor, config.backgroundColor)
    : undefined;

  if (!primaryRatio) {
    issues.push('Invalid primary color format');
  } else if (primaryRatio < 4.5) {
    issues.push(
      `Primary text contrast ratio ${primaryRatio.toFixed(2)}:1 does not meet WCAG AA (4.5:1 required)`
    );
  }

  if (config.secondaryTextColor) {
    if (!secondaryRatio) {
      issues.push('Invalid secondary color format');
    } else if (secondaryRatio < 4.5) {
      issues.push(
        `Secondary text contrast ratio ${secondaryRatio.toFixed(2)}:1 does not meet WCAG AA (4.5:1 required)`
      );
    }
  }

  return {
    valid: issues.length === 0,
    primaryRatio: primaryRatio || 0,
    secondaryRatio,
    issues,
  };
}

/** WCAG AA minimum contrast ratio */
export const WCAG_AA_MIN_CONTRAST = 4.5;

/** WCAG AAA minimum contrast ratio */
export const WCAG_AAA_MIN_CONTRAST = 7.0;

/** WCAG AA large text minimum contrast ratio */
export const WCAG_AA_LARGE_TEXT_MIN_CONTRAST = 3.0;
