import {
  BLANK_PROJECT_DATA,
  DEFAULT_PARAMS,
  DEFAULT_PROJECTION,
  buildBlankProjectData,
  normalizeProjectData,
} from "./calcEngine.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export { BLANK_PROJECT_DATA, DEFAULT_PARAMS, DEFAULT_PROJECTION, buildBlankProjectData, normalizeProjectData };

export function sanitizeProjectFilename(name = "project") {
  return String(name).replace(/[<>:"/\\|?*]+/g, "-").trim() || "project";
}

export function slugifyProjectName(name = "project") {
  const base = String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `project-${Date.now()}`;
}

export function serializeProjectPayload(data, name) {
  const normalized = normalizeProjectData({ ...data, projectName: name || data?.projectName });
  const minParams = {};
  for (const [key, value] of Object.entries(normalized.params || {})) {
    if (value !== DEFAULT_PARAMS[key]) minParams[key] = value;
  }

  const minProducts = (normalized.products || []).map((product) => {
    const compact = {};
    for (const [key, value] of Object.entries(product || {})) {
      if (value !== 0 && value !== "" && value != null) compact[key] = value;
    }
    return compact;
  });

  const compact = {
    p: minParams,
    pr: minProducts,
    pj: normalized.projection,
    projectName: normalized.projectName || name || "未命名项目",
  };
  if (Object.keys(normalized.scheduleStore || {}).length) compact.ss = normalized.scheduleStore;
  if (Object.keys(normalized.priceScheduleStore || {}).length) compact.ps = normalized.priceScheduleStore;
  if (Object.keys(normalized.restockStore || {}).length) compact.rs = normalized.restockStore;
  if (normalized.withdrawalStore?.amounts?.some((value) => value > 0)) compact.ws = normalized.withdrawalStore;
  if (normalized.projectMeta && Object.keys(normalized.projectMeta).length) compact.pm = normalized.projectMeta;

  return compact;
}

function encodeBytesToBase64(bytes) {
  let binStr = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binStr += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binStr);
}

function decodeBase64ToBytes(input) {
  const bin = atob(input);
  return Uint8Array.from(bin, (char) => char.charCodeAt(0));
}

export async function buildEmbeddedSharePayload(data, name) {
  const compact = serializeProjectPayload(data, name);
  const json = JSON.stringify(compact);
  const plainBase64 = encodeBytesToBase64(textEncoder.encode(json));
  let sharePayload = `plain:${plainBase64}`;

  if (plainBase64.length > 6000 && typeof CompressionStream === "function") {
    const blob = new Blob([json]);
    const cs = new CompressionStream("gzip");
    const compressedBlob = await new Response(blob.stream().pipeThrough(cs)).blob();
    const buf = await compressedBlob.arrayBuffer();
    sharePayload = `gz:${encodeBytesToBase64(new Uint8Array(buf))}`;
  }

  return sharePayload;
}

export async function buildEmbeddedShareUrl(data, name, pathname = window.location.pathname) {
  const payload = await buildEmbeddedSharePayload(data, name);
  return `${window.location.origin}${pathname}#share=${encodeURIComponent(payload)}`;
}

export async function parseEmbeddedSharePayload(rawHashToken) {
  const token = decodeURIComponent(rawHashToken || "");
  if (!token) throw new Error("Empty share token");

  let json = "";
  if (token.startsWith("plain:")) {
    json = textDecoder.decode(decodeBase64ToBytes(token.slice(6)));
  } else {
    const compressed = token.startsWith("gz:") ? token.slice(3) : token;
    if (typeof DecompressionStream !== "function") {
      throw new Error("Compressed share links are not supported in this browser");
    }
    const bytes = decodeBase64ToBytes(compressed);
    const ds = new DecompressionStream("gzip");
    const decompressed = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    json = await decompressed.text();
  }

  return normalizeProjectData(JSON.parse(json));
}

export function buildProjectExportJson(data, name) {
  return JSON.stringify({ projectName: name, ...normalizeProjectData({ ...data, projectName: name }) }, null, 2);
}
