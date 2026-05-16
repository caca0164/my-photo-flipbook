/**
 * Browser-only: scale down long edge and encode as JPEG.
 * Falls back to the original file when decoding fails (e.g. some HEIC).
 */
export async function compressImageFileForAlbum(
  file: File,
  maxLongEdge = 2048,
  quality = 0.82,
): Promise<{ blob: Blob; useJpegName: boolean }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return { blob: file, useJpegName: false };
  }

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxLongEdge / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { blob: file, useJpegName: false };
    }

    ctx.drawImage(bitmap, 0, 0, tw, th);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) return { blob: file, useJpegName: false };
    return { blob, useJpegName: true };
  } catch {
    return { blob: file, useJpegName: false };
  }
}
