export const INGREDIENT_IMAGE_BUCKET = "ingredient-images";
export const INGREDIENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const INGREDIENT_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Default exclusions for role-management UIs (system-managed rows). */
export const SYSTEM_INGREDIENT_FILTER = { isSystem: false };