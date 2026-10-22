/** The longest side a picture is sent at; larger photos are scaled down in the browser first. */
const MAX_SIDE = 1600;
/** A picture under this size and side is sent as it is. */
const KEEP_BYTES = 1_500_000;

/**
 * Prepares a picture for sending: a large photo is scaled down and saved as
 * JPEG, so a submission stays small and fast. Anything the browser cannot
 * read is passed on as it is, for the server to refuse with a reason.
 */
export async function preparePicture(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const side = Math.max(bitmap.width, bitmap.height);
  if (side <= MAX_SIDE && file.size <= KEEP_BYTES) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / side);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
}

/** A sample picture from `public/`, as a file. */
export async function samplePicture(path: string): Promise<File> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`could not load ${path}`);
  const blob = await res.blob();
  return new File([blob], path.split("/").pop() ?? "sample", { type: blob.type });
}
