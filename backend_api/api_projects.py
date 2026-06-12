from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .auth import get_current_user, require_writer
from .config import settings
from .database import get_db
from .models import Project, ProjectShareLink, User
from .project_service import (
    add_version,
    blank_project_data,
    has_conflict,
    make_id,
    make_share_link,
    map_project,
    map_share,
    now_utc,
    set_project_access_code,
    slugify,
    unique_slug,
)
from .schemas import AccessCodeUpdate, LegacyProjectImport, ProjectCreate, ProjectPublish, ProjectSave, ShareCreate


router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Project).order_by(Project.updated_at.desc()).all()
    return [map_project(db, row) for row in rows]


@router.post("")
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    name = payload.name.strip() or "未命名项目"
    project = Project(
        id=make_id("project"),
        name=name,
        slug=unique_slug(db, slugify(name)),
        description=payload.description or "",
        status="draft",
        visibility="private",
        current_data_json=blank_project_data(name),
        created_by=user.username,
        updated_by=user.username,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(project)
    db.flush()
    add_version(db, project.id, "draft", project.current_data_json, user.username)
    db.commit()
    db.refresh(project)
    return map_project(db, project)


@router.post("/legacy-import")
def import_legacy_project(payload: LegacyProjectImport, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    existing = db.query(Project).filter(Project.legacy_file_path == payload.legacy_file_path).first()
    if existing:
        return map_project(db, existing)

    name = (payload.name or payload.data.get("projectName") or "未命名项目").strip()
    data = {**(payload.data or {}), "projectName": name}
    project = Project(
        id=make_id("project"),
        name=name,
        slug=unique_slug(db, payload.slug or name),
        description=payload.description or "",
        status="active",
        visibility="public",
        current_data_json=data,
        legacy_file_path=payload.legacy_file_path,
        created_by=user.username,
        updated_by=user.username,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    set_project_access_code(project, payload.access_code if payload.access_code is not None else settings.default_public_access_code)
    db.add(project)
    db.flush()
    version = add_version(db, project.id, "published", data, user.username)
    project.published_version_id = version.id
    db.commit()
    db.refresh(project)
    return map_project(db, project)


@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return map_project(db, project)


@router.put("/{project_id}")
def save_project(project_id: str, payload: ProjectSave, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if has_conflict(project, payload.expected_updated_at, payload.force):
        return {"conflict": True, "project": map_project(db, project)}

    project.name = (payload.name or project.name).strip() or project.name
    project.description = payload.description if payload.description is not None else project.description
    project.current_data_json = {**(payload.data or {}), "projectName": project.name}
    project.updated_by = user.username
    project.updated_at = now_utc()
    if project.status != "archived":
        project.status = "draft"
    add_version(db, project.id, "draft", project.current_data_json, user.username)
    db.commit()
    db.refresh(project)
    return {"conflict": False, "project": map_project(db, project)}


@router.post("/{project_id}/publish")
def publish_project(project_id: str, payload: ProjectPublish, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if has_conflict(project, payload.expected_updated_at, payload.force):
        return {"conflict": True, "project": map_project(db, project)}

    project.name = (payload.name or project.name).strip() or project.name
    project.description = payload.description if payload.description is not None else project.description
    project.slug = unique_slug(db, payload.slug or project.slug or project.name, project_id=project.id)
    project.current_data_json = {**(payload.data or project.current_data_json or {}), "projectName": project.name}
    project.visibility = "public"
    project.status = "active"
    project.updated_by = user.username
    project.updated_at = now_utc()
    set_project_access_code(project, payload.access_code)

    version = add_version(db, project.id, "published", project.current_data_json, user.username)
    project.published_version_id = version.id
    db.commit()
    db.refresh(project)
    return {"conflict": False, "project": map_project(db, project)}


@router.post("/{project_id}/access-code")
def update_access_code(project_id: str, payload: AccessCodeUpdate, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    set_project_access_code(project, payload.access_code)
    project.updated_by = user.username
    project.updated_at = now_utc()
    db.commit()
    db.refresh(project)
    return map_project(db, project)


@router.post("/{project_id}/share-links")
def create_share_link(project_id: str, payload: ShareCreate, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    row = make_share_link(project.id, payload.data or project.current_data_json, user.username, payload.expires_in_hours, payload.access_code)
    db.add(row)
    db.commit()
    db.refresh(row)
    return map_share(row)
