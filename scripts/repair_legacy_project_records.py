from pathlib import Path
import sys

from sqlalchemy import or_

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend_api.config import settings
from backend_api.database import SessionLocal
from backend_api.models import Project, ProjectShareLink, ProjectVersion
from backend_api.project_service import add_version, set_project_access_code


LEGACY_PUBLIC_PROJECTS = [
    {"file": "xiongwei-chuanqi-project.json", "slug": "xiongwei-chuanqi"},
    {"file": "deli-glass-russia-22sku-conservative-project.json", "slug": "deli-22sku-conservative"},
    {"file": "deli-glass-russia-22sku-standard-project.json", "slug": "deli-22sku-standard"},
    {"file": "deli-glass-russia-22sku-aggressive-project.json", "slug": "deli-22sku-aggressive"},
    {"file": "ozon-wholesale-90day-pack/ozon-wholesale-90day-conservative-project.json", "slug": "ozon-90day-conservative"},
    {"file": "ozon-wholesale-90day-pack/ozon-wholesale-90day-standard-project.json", "slug": "ozon-90day-standard"},
    {"file": "ozon-wholesale-90day-pack/ozon-wholesale-90day-scale-project.json", "slug": "ozon-90day-scale"},
]


def choose_keeper(candidates: list[Project], slug: str, legacy_file: str) -> Project:
    for project in candidates:
        if project.legacy_file_path == legacy_file and project.slug == slug:
            return project
    for project in candidates:
        if project.slug == slug:
            return project
    for project in candidates:
        if project.legacy_file_path == legacy_file:
            return project
    return sorted(candidates, key=lambda item: item.created_at)[0]


def repair() -> None:
    db = SessionLocal()
    try:
        for item in LEGACY_PUBLIC_PROJECTS:
            slug = item["slug"]
            legacy_file = item["file"]
            candidates = (
                db.query(Project)
                .filter(
                    or_(
                        Project.legacy_file_path == legacy_file,
                        Project.slug == slug,
                        Project.slug.like(f"{slug}-%"),
                    )
                )
                .all()
            )
            if not candidates:
                continue

            keeper = choose_keeper(candidates, slug, legacy_file)
            duplicates = [project for project in candidates if project.id != keeper.id]

            keeper.legacy_file_path = legacy_file
            keeper.visibility = "public"
            keeper.status = "active"
            if not keeper.public_access_code_hash:
                set_project_access_code(keeper, settings.default_public_access_code)
            if not keeper.published_version_id:
                version = add_version(db, keeper.id, "published", keeper.current_data_json or {}, settings.admin_username)
                keeper.published_version_id = version.id

            for project in duplicates:
                db.query(ProjectVersion).filter(ProjectVersion.project_id == project.id).delete(synchronize_session=False)
                db.query(ProjectShareLink).filter(ProjectShareLink.project_id == project.id).update(
                    {ProjectShareLink.project_id: None},
                    synchronize_session=False,
                )
                db.delete(project)
                print(f"removed duplicate: {project.slug}")
            print(f"repaired: {slug}")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    repair()
