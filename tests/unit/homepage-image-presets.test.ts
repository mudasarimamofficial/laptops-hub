import assert from "node:assert/strict";
import {
  HERO_IMAGE_PRESETS,
  HOMEPAGE_DEFAULT_HANDLES,
  STORY_ANGLE_PRESETS,
  resolveHeroPresentationImage,
  resolveStoryAngleImage,
} from "../../src/lib/content/homepage-image-presets";

const dell = resolveHeroPresentationImage({
  slot: "main",
  productHandle: HOMEPAGE_DEFAULT_HANDLES.dell,
  catalogImageUrl: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_c562a7e7-4615-4268-b232-b0e421758b28.jpg",
});
assert.equal(dell.source, "preset");
assert.equal(dell.src, HERO_IMAGE_PRESETS.main.imageUrl);
assert.ok(!dell.src?.includes("01-main_c562a7e7"), "must not prefer old catalog/cutout for default Dell");

const hp = resolveHeroPresentationImage({
  slot: "side1",
  productHandle: HOMEPAGE_DEFAULT_HANDLES.hp,
});
assert.equal(hp.src, HERO_IMAGE_PRESETS.side1.imageUrl);

const lenovo = resolveHeroPresentationImage({
  slot: "side2",
  productHandle: HOMEPAGE_DEFAULT_HANDLES.lenovo,
});
assert.equal(lenovo.src, HERO_IMAGE_PRESETS.side2.imageUrl);

const override = resolveHeroPresentationImage({
  slot: "main",
  productHandle: HOMEPAGE_DEFAULT_HANDLES.dell,
  settings: { mainImageUrl: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/custom.webp" },
});
assert.equal(override.source, "override");
assert.ok(override.src?.includes("custom.webp"));

const otherProduct = resolveHeroPresentationImage({
  slot: "main",
  productHandle: "some-other-laptop",
  catalogImageUrl: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/other.jpg",
});
assert.equal(otherProduct.source, "catalog");
assert.equal(otherProduct.src, "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/other.jpg");
assert.notEqual(otherProduct.src, HERO_IMAGE_PRESETS.main.imageUrl, "wrong brand preset must not stick");

for (const angle of ["front", "left", "right", "rear"] as const) {
  const r = resolveStoryAngleImage({
    angle,
    productHandle: STORY_ANGLE_PRESETS.handle,
  });
  assert.equal(r.source, "preset");
  assert.equal(r.src, STORY_ANGLE_PRESETS[angle].imageUrl);
}

assert.ok(STORY_ANGLE_PRESETS.front.imageUrl.includes("front"));
assert.ok(STORY_ANGLE_PRESETS.left.imageUrl.includes("left"));
assert.ok(STORY_ANGLE_PRESETS.right.imageUrl.includes("right"));
assert.ok(STORY_ANGLE_PRESETS.rear.imageUrl.includes("rear"));

console.log("homepage-image-presets.test.ts: ok");
