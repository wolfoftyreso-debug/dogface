export function storyFilename(breed: string): string {
  const slug = breed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  return `doggstyle-${slug || "story"}.jpg`;
}

/** Never include `url` — an empty url shares this page (the OG card). */
export function imageShareData(file: File): { files: File[] } {
  return { files: [file] };
}

export function isShareableJpeg(file: File): boolean {
  return (
    file.size > 32 &&
    file.size < 8_000_000 &&
    (file.type === "image/jpeg" || file.type === "image/jpg") &&
    /\.jpe?g$/i.test(file.name)
  );
}
