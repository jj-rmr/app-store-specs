export async function fileToThumbnailDataUrl(file: File, maxDim = 800): Promise<string> {
  const kind = (file.type || "").toLowerCase();
  if (kind.includes("heic") || kind.includes("heif")) {
    throw new Error("iPhone HEIC photos can't be read here yet. Convert to JPEG/PNG first.");
  }
  // Some gallery/camera apps report an empty MIME type for valid photos,
  // so only reject when a type IS present and is definitely not an image.
  if (kind && !kind.startsWith("image/")) {
    throw new Error("Pick an image file from your gallery.");
  }
  if (file.size > 8_000_000) throw new Error("That file is too big. Pick one under 8MB.");

  const bitmap = await createImageBitmap(file).catch(async () => {
    // Fallback for browsers without createImageBitmap file support.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  const width = bitmap.width || (bitmap as HTMLImageElement).width;
  const height = bitmap.height || (bitmap as HTMLImageElement).height;
  if (!width || !height) throw new Error("Could not read that image.");
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap && typeof (bitmap as ImageBitmap).close === "function") {
    (bitmap as ImageBitmap).close();
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}
