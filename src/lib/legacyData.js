import { findLegacyPublicProjectByFile, findLegacyPublicProjectBySlug } from "./legacyProjects.js";
import { normalizeProjectData } from "./projectData.js";

function sanitizeProjectFile(projectFile = "") {
  const safeFile = decodeURIComponent(projectFile || "").trim().replace(/^\.\/+/, "");
  if (
    !safeFile ||
    !safeFile.endsWith(".json") ||
    safeFile.includes("..") ||
    safeFile.includes("\\") ||
    safeFile.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(safeFile)
  ) {
    throw new Error("Invalid project file");
  }
  return safeFile;
}

export async function loadLegacyProjectFile(projectFile) {
  const safeFile = sanitizeProjectFile(projectFile);
  const basePath = import.meta.env.BASE_URL || "/";
  const response = await fetch(`${basePath}${safeFile}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Legacy project file not found: ${safeFile}`);
  }
  const parsed = await response.json();
  return {
    file: safeFile,
    meta: findLegacyPublicProjectByFile(safeFile),
    data: normalizeProjectData(parsed),
  };
}

export async function loadLegacyProjectBySlug(slug) {
  const meta = findLegacyPublicProjectBySlug(slug);
  if (!meta) return null;
  const loaded = await loadLegacyProjectFile(meta.file);
  return { ...loaded, meta };
}

export function mapLegacyProjectFileToSlug(projectFile) {
  return findLegacyPublicProjectByFile(projectFile)?.slug || null;
}
