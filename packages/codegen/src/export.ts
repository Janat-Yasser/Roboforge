import JSZip from "jszip";

/** Fixed timestamp so identical projects produce byte-identical archives. */
const FIXED_DATE = new Date("2020-01-01T00:00:00Z");

export interface ExportFile {
  path: string;
  content: string;
}

/**
 * Packs project files into a zip whose single top-level folder is the robot name, ready to
 * `git init` (a .gitignore is part of the generated set).
 */
export async function exportZip(rootFolder: string, files: ExportFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const root = zip.folder(rootFolder)!;
  for (const f of files) {
    if (f.path.includes("..") || f.path.startsWith("/")) throw new Error(`Refusing to export unsafe path '${f.path}'.`);
    root.file(f.path, f.content, { date: FIXED_DATE });
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
