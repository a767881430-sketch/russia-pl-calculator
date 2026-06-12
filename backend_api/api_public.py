from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import Project, ProjectShareLink
from .project_service import (
    find_version,
    is_share_expired,
    map_public_project,
    map_share,
    verify_project_access_code,
    verify_share_access_code,
)
from .schemas import AccessUnlock


router = APIRouter(prefix="/api", tags=["public"])


def public_project_or_404(db: Session, slug: str) -> Project:
    project = db.query(Project).filter(Project.slug == slug, Project.visibility == "public").first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在或暂未公开")
    return project


@router.post("/public/{slug}/unlock")
def unlock_public_project(slug: str, payload: AccessUnlock, db: Session = Depends(get_db)):
    project = public_project_or_404(db, slug)
    if not verify_project_access_code(project, payload.access_code):
        raise HTTPException(status_code=403, detail="访问码不正确")
    return {"ok": True}


@router.get("/public/{slug}")
def get_public_project(slug: str, access_code: str = "", db: Session = Depends(get_db)):
    project = public_project_or_404(db, slug)
    if project.public_access_code_hash and not verify_project_access_code(project, access_code):
        return {"locked": True, "hasAccessCode": True}
    version = find_version(db, project.published_version_id)
    if not version:
        raise HTTPException(status_code=404, detail="项目还没有发布版本")
    return map_public_project(db, project)


def share_or_404(db: Session, token: str) -> ProjectShareLink:
    row = db.query(ProjectShareLink).filter(ProjectShareLink.token == token).first()
    if not row or is_share_expired(row):
        raise HTTPException(status_code=404, detail="分享链接不存在或已过期")
    return row


@router.post("/share/{token}/unlock")
def unlock_share(token: str, payload: AccessUnlock, db: Session = Depends(get_db)):
    row = share_or_404(db, token)
    if not verify_share_access_code(row, payload.access_code):
        raise HTTPException(status_code=403, detail="访问码不正确")
    return {"ok": True}


@router.get("/share/{token}")
def get_share(token: str, access_code: str = "", db: Session = Depends(get_db)):
    row = share_or_404(db, token)
    if row.access_code_hash and not verify_share_access_code(row, access_code):
        return {"locked": True, "hasAccessCode": True}
    return map_share(row)
