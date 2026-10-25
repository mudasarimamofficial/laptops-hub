/**
 * Approved default presentation images for homepage Hero + Product Story.
 * Homepage-only — does not alter product_media / PDP galleries / CSV mappings.
 */

export const HOMEPAGE_DEFAULT_HANDLES = {
  dell: "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
  hp: "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage",
  lenovo: "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
} as const;

/** Cinematic Hero defaults — keyed by brand/slot, not array index. */
export const HERO_IMAGE_PRESETS = {
  main: {
    handle: HOMEPAGE_DEFAULT_HANDLES.dell,
    brand: "Dell",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-dell-lap.webp?v=1792934111",
    alt: "Dell Latitude laptop — Laptops HUB hero",
    replaces:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_c562a7e7-4615-4268-b232-b0e421758b28.jpg",
  },
  side1: {
    handle: HOMEPAGE_DEFAULT_HANDLES.hp,
    brand: "HP",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-hp-lap.webp?v=1792934111",
    alt: "HP ProBook laptop — Laptops HUB hero",
    replaces:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_70e4489b-4e0c-4f24-b6ce-e134b90b3e7b.jpg",
  },
  side2: {
    handle: HOMEPAGE_DEFAULT_HANDLES.lenovo,
    brand: "Lenovo",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-lenovo-lap.webp?v=1792934111",
    alt: "Lenovo ThinkPad laptop — Laptops HUB hero",
    replaces:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_1f07e66c-0883-4af3-b805-2c35e3d3b63e.jpg",
  },
} as const;

/** Product Story angles — semantic order front → left → right → rear. */
export const STORY_ANGLE_PRESETS = {
  handle: HOMEPAGE_DEFAULT_HANDLES.dell,
  front: {
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-front.webp?v=1792935242",
    alt: "Dell Latitude — front view",
    replaces:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_c562a7e7-4615-4268-b232-b0e421758b28.jpg",
  },
  left: {
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-left.webp?v=1792935243",
    alt: "Dell Latitude — left view",
    replaces:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/02-alt02_11a68162-a7c1-4de7-979a-f09ebdf5d57d.jpg",
  },
  right: {
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-right.webp?v=1792935242",
    alt: "Dell Latitude — right view",
    replaces:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/03-alt03_df3f7a78-8df5-4cdd-b20e-d1fd00f15319.jpg",
  },
  rear: {
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-rear.webp?v=1792935243",
    alt: "Dell Latitude — rear view",
    replaces:
      "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/04-alt04_328bc2fc-527a-4c68-b1ac-1372ad11a95e.jpg",
  },
} as const;

export type HeroSlot = keyof typeof HERO_IMAGE_PRESETS;
export type StoryAngle = "front" | "left" | "right" | "rear";

function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^https:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Resolve presentation image:
 * published/draft merchant override → approved preset (only if handle still matches slot default) → catalog fallback.
 * Never lets cutoutUrl override an explicit merchant or approved preset URL.
 */
export function resolveHeroPresentationImage(opts: {
  slot: HeroSlot;
  productHandle: string;
  settings?: Record<string, unknown> | null;
  catalogImageUrl?: string | null;
}): { src: string | null; alt: string; source: "override" | "preset" | "catalog" | "none"; cutout: boolean } {
  const preset = HERO_IMAGE_PRESETS[opts.slot];
  const key =
    opts.slot === "main" ? "mainImageUrl" : opts.slot === "side1" ? "side1ImageUrl" : "side2ImageUrl";
  const altKey =
    opts.slot === "main" ? "mainImageAlt" : opts.slot === "side1" ? "side1ImageAlt" : "side2ImageAlt";

  const override = httpsUrl(opts.settings?.[key]);
  if (override) {
    const alt = typeof opts.settings?.[altKey] === "string" ? String(opts.settings[altKey]) : preset.alt;
    return { src: override, alt, source: "override", cutout: true };
  }

  if (opts.productHandle === preset.handle) {
    return { src: preset.imageUrl, alt: preset.alt, source: "preset", cutout: true };
  }

  if (opts.catalogImageUrl) {
    return { src: opts.catalogImageUrl, alt: preset.brand, source: "catalog", cutout: false };
  }

  return { src: null, alt: preset.alt, source: "none", cutout: false };
}

export function resolveStoryAngleImage(opts: {
  angle: StoryAngle;
  productHandle: string;
  settings?: Record<string, unknown> | null;
  catalogImageUrl?: string | null;
}): { src: string | null; alt: string; source: "override" | "preset" | "catalog" | "none"; cutout: boolean } {
  const preset = STORY_ANGLE_PRESETS[opts.angle];
  const angles = (opts.settings?.angleImages as Record<string, unknown> | undefined) || {};
  const override = httpsUrl(angles[opts.angle] ?? opts.settings?.[`angle_${opts.angle}`]);
  const altOverride =
    typeof angles[`${opts.angle}Alt`] === "string"
      ? String(angles[`${opts.angle}Alt`])
      : typeof opts.settings?.[`angle_${opts.angle}_alt`] === "string"
        ? String(opts.settings[`angle_${opts.angle}_alt`])
        : preset.alt;

  if (override) {
    return { src: override, alt: altOverride, source: "override", cutout: true };
  }

  if (opts.productHandle === STORY_ANGLE_PRESETS.handle) {
    return { src: preset.imageUrl, alt: preset.alt, source: "preset", cutout: true };
  }

  if (opts.catalogImageUrl) {
    return { src: opts.catalogImageUrl, alt: altOverride, source: "catalog", cutout: false };
  }

  return { src: null, alt: preset.alt, source: "none", cutout: false };
}

/** Default section settings embedded in theme seed / code defaults. */
export function defaultHeroSectionSettings(): Record<string, unknown> {
  return {
    productHandles: [
      HERO_IMAGE_PRESETS.main.handle,
      HERO_IMAGE_PRESETS.side1.handle,
      HERO_IMAGE_PRESETS.side2.handle,
    ],
    mainImageUrl: HERO_IMAGE_PRESETS.main.imageUrl,
    mainImageAlt: HERO_IMAGE_PRESETS.main.alt,
    side1ImageUrl: HERO_IMAGE_PRESETS.side1.imageUrl,
    side1ImageAlt: HERO_IMAGE_PRESETS.side1.alt,
    side2ImageUrl: HERO_IMAGE_PRESETS.side2.imageUrl,
    side2ImageAlt: HERO_IMAGE_PRESETS.side2.alt,
  };
}

export function defaultStorySectionSettings(): Record<string, unknown> {
  return {
    productHandle: STORY_ANGLE_PRESETS.handle,
    angleImages: {
      front: STORY_ANGLE_PRESETS.front.imageUrl,
      left: STORY_ANGLE_PRESETS.left.imageUrl,
      right: STORY_ANGLE_PRESETS.right.imageUrl,
      rear: STORY_ANGLE_PRESETS.rear.imageUrl,
      frontAlt: STORY_ANGLE_PRESETS.front.alt,
      leftAlt: STORY_ANGLE_PRESETS.left.alt,
      rightAlt: STORY_ANGLE_PRESETS.right.alt,
      rearAlt: STORY_ANGLE_PRESETS.rear.alt,
    },
  };
}

/** Merge approved image defaults into existing section settings without wiping unrelated keys. */
export function mergeHomepageImageDefaults(settings: Record<string, unknown>, type: string): Record<string, unknown> {
  if (type === "v5_cinematic_hero") {
    const d = defaultHeroSectionSettings();
    return {
      ...d,
      ...settings,
      mainImageUrl: httpsUrl(settings.mainImageUrl) || d.mainImageUrl,
      side1ImageUrl: httpsUrl(settings.side1ImageUrl) || d.side1ImageUrl,
      side2ImageUrl: httpsUrl(settings.side2ImageUrl) || d.side2ImageUrl,
      productHandles: Array.isArray(settings.productHandles) && settings.productHandles.length
        ? settings.productHandles
        : d.productHandles,
    };
  }
  if (type === "v5_product_story") {
    const d = defaultStorySectionSettings();
    const existingAngles = (settings.angleImages as Record<string, unknown> | undefined) || {};
    const defaults = d.angleImages as Record<string, string>;
    return {
      ...d,
      ...settings,
      productHandle:
        typeof settings.productHandle === "string" && settings.productHandle
          ? settings.productHandle
          : d.productHandle,
      angleImages: {
        ...defaults,
        ...existingAngles,
        front: httpsUrl(existingAngles.front) || defaults.front,
        left: httpsUrl(existingAngles.left) || defaults.left,
        right: httpsUrl(existingAngles.right) || defaults.right,
        rear: httpsUrl(existingAngles.rear) || defaults.rear,
      },
    };
  }
  return settings;
}
