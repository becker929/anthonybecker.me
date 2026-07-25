// R2 content-addressed blob storage (§9). Every object lives at
// `blob/<sha256-hex>` and is immutable — a new version is a new hash, never
// an overwrite. That's what makes duplicate uploads free and cached
// responses safe to serve with permanent cache headers.

const MAX_BLOB_BYTES = 20_000_000;

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Chunked to avoid blowing the call stack on String.fromCharCode(...bytes)
// for anything image-sized.
export function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Stores `data` (base64) under its content hash if not already present.
// Returns the hash. Idempotent and safe to retry.
export async function putBlob(bucket, { mimeType, data }) {
  if (typeof mimeType !== "string" || !mimeType) {
    throw new Error("mimeType is required.");
  }
  if (typeof data !== "string" || !data) {
    throw new Error("data (base64) is required.");
  }
  const bytes = base64ToBytes(data);
  if (bytes.byteLength > MAX_BLOB_BYTES) {
    throw new Error("Blob is too large.");
  }
  const hash = await sha256Hex(bytes);
  const key = `blob/${hash}`;
  const existing = await bucket.head(key);
  if (!existing) {
    await bucket.put(key, bytes, { httpMetadata: { contentType: mimeType } });
  }
  return hash;
}

const HASH_RE = /^[0-9a-f]{64}$/;

export function isValidHash(hash) {
  return HASH_RE.test(hash);
}

export async function getBlob(bucket, hash) {
  if (!isValidHash(hash)) return null;
  return bucket.get(`blob/${hash}`);
}

// Convenience for feeding a stored blob back into a model call as an
// inline reference image.
export async function getBlobAsBase64(bucket, hash) {
  const obj = await getBlob(bucket, hash);
  if (!obj) return null;
  const bytes = new Uint8Array(await obj.arrayBuffer());
  return {
    mimeType: obj.httpMetadata?.contentType || "application/octet-stream",
    data: bytesToBase64(bytes),
  };
}
