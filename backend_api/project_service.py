import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from .config import settings
from .models import Project, ProjectShareLink, ProjectVersion
from .security import hash_secret, verify_secret


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def iso(value: datetime | None) -> str | None:
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def slugify(name: str) -> str:
    text = (name or "project").strip().lower()
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^a-z0-9\u4e00-\u9fff-]", "", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or f"project-{uuid.uuid4().hex[:8]}"


def unique_slug(db: Session, requested: str, project_id: str | None = None) -> str:
    base = slugify(requested)
    candidate = base
    counter = 2
    while True:
        query = db.query(Project).filter(Project.slug == candidate)
        if project_id:
            query = query.filter(Project.id != project_id)
        if not query.first():
            return candidate
        candidate = f"{base}-{counter}"
        counter += 1


def blank_project_data(name: str) -> dict[str, Any]:
    return {
        "projectName": name,
        "params": {},
        "products": [],
        "scheduleStore": {},
        "priceScheduleStore": {},
        "restockStore": {},
        "withdrawalStore": {"amounts": []},
        "projection": {},
        "projectMeta": {},
    }


def find_version(db: Session, version_id: str | None) -> ProjectVersion | None:
    if not version_id:
        return None
    return db.query(ProjectVersion).filter(ProjectVersion.id == version_id).first()


def map_project(db: Session, project: Project) -> dict[str, Any]:
    published = find_version(db, project.published_version_id)
    return {
        "id": project.id,
        "workspaceId": "default",
        "name": project.name,
        "slug": project.slug,
        "description": project.description or "",
        "status": project.status,
        "visibility": project.visibility,
        "currentData": project.current_data_json or {},
        "publishedData": (published.data_json if published else None),
        "publishedVersionId": project.published_version_id,
        "legacyFilePath": project.legacy_file_path,
        "hasAccessCode": bool(project.public_access_code_hash),
        "createdBy": project.created_by,
        "updatedBy": project.updated_by,
        "createdAt": iso(project.created_at),
        "updatedAt": iso(project.updated_at),
    }


def map_public_project(db: Session, project: Project) -> dict[str, Any]:
    published = find_version(db, project.published_version_id)
    published_data = published.data_json if published else None
    return {
        "id": project.id,
        "workspaceId": "default",
        "name": project.name,
        "slug": project.slug,
        "description": project.description or "",
        "status": project.status,
        "visibility": project.visibility,
        "currentData": published_data or {},
        "publishedData": published_data,
        "publishedVersionId": project.published_version_id,
        "legacyFilePath": project.legacy_file_path,
        "hasAccessCode": bool(project.public_access_code_hash),
        "createdBy": "",
        "updatedBy": project.updated_by,
        "createdAt": None,
        "updatedAt": iso(project.updated_at),
    }


def map_share(row: ProjectShareLink) -> dict[str, Any]:
    return {
        "id": row.id,
        "token": row.token,
        "projectId": row.project_id,
        "data": row.snapshot_data_json or {},
        "expiresAt": iso(row.expires_at),
        "createdAt": iso(row.created_at),
        "createdBy": row.created_by,
        "hasAccessCode": bool(row.access_code_hash),
    }


def add_version(db: Session, project_id: str, kind: str, data: dict[str, Any], created_by: str) -> ProjectVersion:
    version = ProjectVersion(
        id=make_id("version"),
        project_id=project_id,
        version_kind=kind,
        data_json=data or {},
        created_by=created_by,
        created_at=now_utc(),
    )
    db.add(version)
    db.flush()
    return version


def has_conflict(project: Project, expected_updated_at: str | None, force: bool) -> bool:
    if force or not expected_updated_at:
        return False
    return iso(project.updated_at) != expected_updated_at


def set_project_access_code(project: Project, access_code: str | None) -> None:
    if access_code is None:
        return
    clean = access_code.strip()
    project.public_access_code_hash = hash_secret(clean) if clean else None


def verify_project_access_code(project: Project, access_code: str) -> bool:
    if not project.public_access_code_hash:
        return True
    return verify_secret(access_code, project.public_access_code_hash)


def verify_share_access_code(row: ProjectShareLink, access_code: str) -> bool:
    if not row.access_code_hash:
        return True
    return verify_secret(access_code, row.access_code_hash)


def make_share_link(project_id: str | None, data: dict[str, Any], created_by: str, expires_in_hours: int, access_code: str | None) -> ProjectShareLink:
    expires_at = now_utc() + timedelta(hours=max(1, min(expires_in_hours or 72, 24 * 30)))
    row = ProjectShareLink(
        id=make_id("share_link"),
        project_id=project_id,
        token=uuid.uuid4().hex + uuid.uuid4().hex[:8],
        snapshot_data_json=data or {},
        access_code_hash=hash_secret(access_code.strip()) if access_code and access_code.strip() else None,
        created_by=created_by,
        created_at=now_utc(),
        expires_at=expires_at,
    )
    return row


def is_share_expired(row: ProjectShareLink) -> bool:
    if not row.expires_at:
        return False
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < now_utc()
