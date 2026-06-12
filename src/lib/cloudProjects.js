import { buildBlankProjectData, normalizeProjectData } from "./projectData.js";
import { LEGACY_PUBLIC_PROJECTS } from "./legacyProjects.js";
import { loadLegacyProjectFile } from "./legacyData.js";
import { apiGet, apiPost, apiPut, buildQuery } from "./apiClient.js";

const MOCK_DB_KEY = "ru_calc_cloud_mock_v2";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function shouldUseMock(error) {
  return error?.status === undefined || error?.message?.includes("Failed to fetch");
}

function mapProjectRecord(project) {
  return {
    ...project,
    currentData: normalizeProjectData(project.currentData || project.current_data_json || {}),
    publishedData: project.publishedData ? normalizeProjectData(project.publishedData) : null,
    workspaceId: project.workspaceId || "default",
    publishedVersionId: project.publishedVersionId || project.published_version_id || null,
    legacyFilePath: project.legacyFilePath || project.legacy_file_path || null,
    createdBy: project.createdBy || project.created_by || "",
    updatedBy: project.updatedBy || project.updated_by || "",
    createdAt: project.createdAt || project.created_at || null,
    updatedAt: project.updatedAt || project.updated_at || null,
    hasAccessCode: Boolean(project.hasAccessCode),
  };
}

function mapShareRecord(row) {
  return {
    ...row,
    projectId: row.projectId || row.project_id || null,
    data: normalizeProjectData(row.data || row.snapshot_data_json || {}),
    expiresAt: row.expiresAt || row.expires_at || null,
    createdAt: row.createdAt || row.created_at || null,
    createdBy: row.createdBy || row.created_by || "",
    hasAccessCode: Boolean(row.hasAccessCode),
  };
}

function buildEmptyMockDb() {
  return {
    meta: { seeded: false, version: 2 },
    projects: [],
    project_versions: [],
    project_share_links: [],
  };
}

function readMockDb() {
  try {
    const raw = localStorage.getItem(MOCK_DB_KEY);
    return raw ? JSON.parse(raw) : buildEmptyMockDb();
  } catch {
    return buildEmptyMockDb();
  }
}

function writeMockDb(db) {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
}

function findPublishedVersion(db, project) {
  return db.project_versions.find((item) => item.id === project.publishedVersionId) || null;
}

async function ensureMockSeeded() {
  const db = readMockDb();
  if (db.meta?.seeded) return db;
  const seeded = buildEmptyMockDb();
  const createdAt = nowIso();
  for (const legacyProject of LEGACY_PUBLIC_PROJECTS) {
    try {
      const loaded = await loadLegacyProjectFile(legacyProject.file);
      const projectId = makeId("project");
      const versionId = makeId("version");
      seeded.projects.push({
        id: projectId,
        workspaceId: "default",
        name: loaded.data.projectName || legacyProject.name,
        slug: legacyProject.slug,
        description: legacyProject.desc || "",
        status: "active",
        visibility: "public",
        currentData: loaded.data,
        publishedVersionId: versionId,
        legacyFilePath: legacyProject.file,
        hasAccessCode: false,
        createdBy: "mock-admin",
        updatedBy: "mock-admin",
        createdAt,
        updatedAt: createdAt,
      });
      seeded.project_versions.push({
        id: versionId,
        projectId,
        versionKind: "published",
        data: loaded.data,
        createdBy: "mock-admin",
        createdAt,
      });
    } catch (error) {
      console.warn("Failed to seed legacy project into mock store:", legacyProject.file, error);
    }
  }
  seeded.meta.seeded = true;
  writeMockDb(seeded);
  return seeded;
}

async function withMockDb(mutator) {
  const db = await ensureMockSeeded();
  const result = await mutator(db);
  writeMockDb(db);
  return result;
}

function mockProjectOut(db, project) {
  const published = findPublishedVersion(db, project);
  return mapProjectRecord({
    ...project,
    publishedData: published?.data || null,
  });
}

export async function listProjects() {
  try {
    const rows = await apiGet("/projects");
    return (rows || []).map(mapProjectRecord);
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    const db = await ensureMockSeeded();
    return db.projects
      .slice()
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .map((project) => mockProjectOut(db, project));
  }
}

export async function getProjectById(projectId) {
  try {
    return mapProjectRecord(await apiGet(`/projects/${projectId}`));
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    const db = await ensureMockSeeded();
    const project = db.projects.find((item) => item.id === projectId);
    return project ? mockProjectOut(db, project) : null;
  }
}

export async function getProjectBySlug(slug, accessCode = "") {
  try {
    const payload = await apiGet(`/public/${encodeURIComponent(slug)}${buildQuery({ access_code: accessCode })}`);
    if (payload?.locked) return payload;
    return mapProjectRecord(payload);
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    const db = await ensureMockSeeded();
    const project = db.projects.find((item) => item.slug === slug && item.visibility === "public");
    return project ? mockProjectOut(db, project) : null;
  }
}

export async function unlockPublicProject(slug, accessCode) {
  return apiPost(`/public/${encodeURIComponent(slug)}/unlock`, { access_code: accessCode });
}

export async function findProjectByLegacyFile(_workspaceId, legacyFilePath) {
  const projects = await listProjects();
  return projects.find((project) => project.legacyFilePath === legacyFilePath) || null;
}

export async function seedLegacyProjects() {
  const existing = await listProjects();
  if (existing.length > 0) return existing;
  const created = [];
  for (const legacyProject of LEGACY_PUBLIC_PROJECTS) {
    try {
      const loaded = await loadLegacyProjectFile(legacyProject.file);
      const imported = await apiPost("/projects/legacy-import", {
        name: loaded.data.projectName || legacyProject.name,
        description: legacyProject.desc || "",
        slug: legacyProject.slug,
        legacy_file_path: legacyProject.file,
        data: loaded.data,
        access_code: "xhk2026",
      });
      created.push(mapProjectRecord(imported));
    } catch (error) {
      console.warn("Failed to seed legacy project:", legacyProject.file, error);
    }
  }
  return created;
}

export async function createProject({ name, description = "" }) {
  try {
    return mapProjectRecord(await apiPost("/projects", { name, description }));
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    const projectName = name?.trim() || "未命名项目";
    return withMockDb(async (db) => {
      const projectId = makeId("project");
      const row = {
        id: projectId,
        workspaceId: "default",
        name: projectName,
        slug: `${projectName}-${projectId.slice(-6)}`,
        description,
        status: "draft",
        visibility: "private",
        currentData: buildBlankProjectData(projectName),
        publishedVersionId: null,
        legacyFilePath: null,
        hasAccessCode: false,
        createdBy: "mock-admin",
        updatedBy: "mock-admin",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.projects.unshift(row);
      return mockProjectOut(db, row);
    });
  }
}

export async function saveProjectDraft({ projectId, name, description, data, expectedUpdatedAt, force = false }) {
  try {
    const result = await apiPut(`/projects/${projectId}`, {
      name,
      description,
      data: normalizeProjectData({ ...data, projectName: name || data?.projectName }),
      expected_updated_at: expectedUpdatedAt,
      force,
    });
    return { ...result, project: mapProjectRecord(result.project) };
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    return withMockDb(async (db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("Project not found");
      if (!force && expectedUpdatedAt && project.updatedAt !== expectedUpdatedAt) {
        return { conflict: true, project: mockProjectOut(db, project) };
      }
      project.name = name?.trim() || project.name;
      project.description = description ?? project.description;
      project.currentData = normalizeProjectData({ ...data, projectName: project.name });
      project.status = project.status === "archived" ? "archived" : "draft";
      project.updatedAt = nowIso();
      project.updatedBy = "mock-admin";
      db.project_versions.push({
        id: makeId("version"),
        projectId: project.id,
        versionKind: "draft",
        data: project.currentData,
        createdBy: "mock-admin",
        createdAt: project.updatedAt,
      });
      return { conflict: false, project: mockProjectOut(db, project) };
    });
  }
}

export async function publishProject({ projectId, name, description, slug, data, expectedUpdatedAt, force = false, accessCode }) {
  try {
    const result = await apiPost(`/projects/${projectId}/publish`, {
      name,
      description,
      slug,
      data: normalizeProjectData({ ...data, projectName: name || data?.projectName }),
      expected_updated_at: expectedUpdatedAt,
      force,
      access_code: accessCode,
    });
    return { ...result, project: mapProjectRecord(result.project) };
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    return withMockDb(async (db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("Project not found");
      if (!force && expectedUpdatedAt && project.updatedAt !== expectedUpdatedAt) {
        return { conflict: true, project: mockProjectOut(db, project) };
      }
      const versionId = makeId("version");
      project.name = name?.trim() || project.name;
      project.description = description ?? project.description;
      project.slug = slug || project.slug;
      project.currentData = normalizeProjectData({ ...data, projectName: project.name });
      project.visibility = "public";
      project.status = "active";
      project.publishedVersionId = versionId;
      project.hasAccessCode = Boolean(accessCode);
      project.updatedAt = nowIso();
      project.updatedBy = "mock-admin";
      db.project_versions.push({
        id: versionId,
        projectId: project.id,
        versionKind: "published",
        data: project.currentData,
        createdBy: "mock-admin",
        createdAt: project.updatedAt,
      });
      return { conflict: false, project: mockProjectOut(db, project) };
    });
  }
}

export async function updateProjectAccessCode(projectId, accessCode) {
  return mapProjectRecord(await apiPost(`/projects/${projectId}/access-code`, { access_code: accessCode }));
}

export async function createShareSnapshot({ projectId, data, expiresInHours = 72, accessCode = "" }) {
  try {
    return mapShareRecord(await apiPost(`/projects/${projectId}/share-links`, {
      data: normalizeProjectData(data),
      expires_in_hours: expiresInHours,
      access_code: accessCode,
    }));
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    return withMockDb(async (db) => {
      const row = {
        id: makeId("share_link"),
        token: makeId("share").replace(/^share_/, ""),
        projectId,
        data: normalizeProjectData(data),
        createdBy: "mock-admin",
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString(),
        hasAccessCode: Boolean(accessCode),
      };
      db.project_share_links.push(row);
      return mapShareRecord(row);
    });
  }
}

export async function getShareSnapshotByToken(token, accessCode = "") {
  try {
    const payload = await apiGet(`/share/${encodeURIComponent(token)}${buildQuery({ access_code: accessCode })}`);
    if (payload?.locked) return payload;
    return mapShareRecord(payload);
  } catch (error) {
    if (!shouldUseMock(error)) throw error;
    const db = await ensureMockSeeded();
    const row = db.project_share_links.find((item) => item.token === token);
    if (!row) return null;
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return null;
    return mapShareRecord(row);
  }
}

export async function unlockShareSnapshot(token, accessCode) {
  return apiPost(`/share/${encodeURIComponent(token)}/unlock`, { access_code: accessCode });
}

export async function listWorkspaceMembers() {
  return [];
}
