import { normalizePath, type App } from "obsidian";

export async function loadImageAsBlobUrl(
  app: App,
  vaultPath: string,
): Promise<string> {
  const file = app.vault.getFileByPath(normalizePath(vaultPath));
  if (!file) {
    throw new Error(`Map image not found: ${vaultPath}`);
  }
  const arrayBuffer = await app.vault.readBinary(file);
  const blob = new Blob([arrayBuffer], { type: "image/png" });
  return URL.createObjectURL(blob);
}

export function getImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("Failed to load image for dimension detection"));
    };
    img.src = url;
  });
}
