

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

function linearRgbToOklab(rgb) {
  const toLinear = (c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToOklch(lab) {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab.L, c: c, h: h };
}

function hexToOklch(hex) {
  return oklabToOklch(linearRgbToOklab(hexToRgb(hex)));
}

function formatOklch(oklch, alpha) {
  const l = oklch.l.toFixed(3);
  const c = oklch.c.toFixed(3);
  const h = Math.round(oklch.h);
  return alpha !== undefined
    ? `oklch(${l} ${c} ${h} / ${alpha})`
    : `oklch(${l} ${c} ${h})`;
}

function generatePalette(hex, prefix = 'primary') {
  const base = hexToOklch(hex);
  const shades = {
    '50': 0.98, '100': 0.95, '200': 0.90, '300': 0.82, '400': 0.70,
    '500': 0.55, '600': 0.48, '700': 0.40, '800': 0.32, '900': 0.24, '950': 0.18,
  };
  const palette = {};
  for (const [shade, lightness] of Object.entries(shades)) {
    let chroma = base.c;
    if (lightness > 0.85 || lightness < 0.25) chroma = base.c * 0.3;
    else if (lightness > 0.75 || lightness < 0.35) chroma = base.c * 0.6;
    else if (lightness > 0.65 || lightness < 0.45) chroma = base.c * 0.85;
    palette[`--${prefix}-${shade}`] = formatOklch({ l: lightness, c: Math.min(chroma, 0.15), h: base.h });
  }
  return palette;
}

function generateDarkPalette(hex, prefix = 'primary') {
  const base = hexToOklch(hex);
  const shades = {
    '50': 0.20, '100': 0.25, '200': 0.32, '300': 0.42, '400': 0.55,
    '500': 0.65, '600': 0.72, '700': 0.80, '800': 0.88, '900': 0.94, '950': 0.97,
  };
  const palette = {};
  for (const [shade, lightness] of Object.entries(shades)) {
    let chroma = base.c;
    if (lightness > 0.85 || lightness < 0.25) chroma = base.c * 0.3;
    else if (lightness > 0.75 || lightness < 0.35) chroma = base.c * 0.6;
    else if (lightness > 0.65 || lightness < 0.45) chroma = base.c * 0.85;
    palette[`--${prefix}-${shade}`] = formatOklch({ l: lightness, c: Math.min(chroma, 0.15), h: base.h });
  }
  return palette;
}

function generateGrayPalette(tintHex) {
  const tint = tintHex ? hexToOklch(tintHex) : { l: 0, c: 0, h: 0 };
  const hue = tint.h;
  const lightShades = {
    '50': { l: 0.99, c: 0.002 }, '100': { l: 0.97, c: 0.003 }, '200': { l: 0.93, c: 0.005 },
    '300': { l: 0.87, c: 0.008 }, '400': { l: 0.70, c: 0.010 }, '500': { l: 0.55, c: 0.012 },
    '600': { l: 0.45, c: 0.010 }, '700': { l: 0.35, c: 0.008 }, '800': { l: 0.25, c: 0.005 },
    '900': { l: 0.18, c: 0.003 }, '950': { l: 0.12, c: 0.002 },
  };
  const darkShades = {
    '50': { l: 0.13, c: 0.003 }, '100': { l: 0.17, c: 0.005 }, '200': { l: 0.22, c: 0.008 },
    '300': { l: 0.30, c: 0.010 }, '400': { l: 0.42, c: 0.012 }, '500': { l: 0.55, c: 0.010 },
    '600': { l: 0.65, c: 0.008 }, '700': { l: 0.75, c: 0.005 }, '800': { l: 0.85, c: 0.003 },
    '900': { l: 0.92, c: 0.002 }, '950': { l: 0.97, c: 0.001 },
  };
  const light = {};
  const dark = {};
  for (const [shade, values] of Object.entries(lightShades)) {
    light[`--gray-${shade}`] = formatOklch({ l: values.l, c: values.c, h: hue });
  }
  for (const [shade, values] of Object.entries(darkShades)) {
    dark[`--gray-${shade}`] = formatOklch({ l: values.l, c: values.c, h: hue });
  }
  return { light, dark };
}

export function generateThemeStyles(colors) {
  if (!colors || !colors.primary) return '';
  const primaryPalette = generatePalette(colors.primary, 'primary');
  const primaryDarkPalette = generateDarkPalette(colors.primary, 'primary');
  const grayPalettes = generateGrayPalette(colors.primary);

  let lightVars = Object.entries(primaryPalette).map(([k, v]) => `${k}: ${v};`).join('\n    ');
  lightVars += '\n    ' + Object.entries(grayPalettes.light).map(([k, v]) => `${k}: ${v};`).join('\n    ');

  let darkVars = Object.entries(primaryDarkPalette).map(([k, v]) => `${k}: ${v};`).join('\n    ');
  darkVars += '\n    ' + Object.entries(grayPalettes.dark).map(([k, v]) => `${k}: ${v};`).join('\n    ');

  const baseOklch = hexToOklch(colors.primary);
  const shadowVars = `
    --shadow-primary-sm: 0 2px 8px -2px ${formatOklch({ l: 0.55, c: 0.13, h: baseOklch.h }, 0.20)};
    --shadow-primary: 0 4px 16px -4px ${formatOklch({ l: 0.55, c: 0.13, h: baseOklch.h }, 0.25)};
    --shadow-primary-lg: 0 12px 32px -8px ${formatOklch({ l: 0.55, c: 0.13, h: baseOklch.h }, 0.30)};`;
  const darkShadowVars = `
    --shadow-primary-sm: 0 2px 8px -2px ${formatOklch({ l: 0.65, c: 0.13, h: baseOklch.h }, 0.30)};
    --shadow-primary: 0 4px 16px -4px ${formatOklch({ l: 0.65, c: 0.13, h: baseOklch.h }, 0.40)};
    --shadow-primary-lg: 0 12px 32px -8px ${formatOklch({ l: 0.65, c: 0.13, h: baseOklch.h }, 0.50)};`;

  return `
/* Generated Theme Styles */
:root {
    ${lightVars}
    ${shadowVars}
}

.dark {
    ${darkVars}
    ${darkShadowVars}
}`;
}
