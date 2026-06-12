import json
from pathlib import Path

from backend_api.auth import ensure_default_admin
from backend_api.config import settings
from backend_api.database import SessionLocal
from backend_api.models import Project
from backend_api.project_service import add_version, make_id, now_utc, set_project_access_code, unique_slug


ROOT = Path(__file__).resolve().parents[1]

LEGACY_PUBLIC_PROJECTS = [
    {
        "name": "雄伟传奇",
        "file": "xiongwei-chuanqi-project.json",
        "slug": "xiongwei-chuanqi",
        "desc": "新增线上项目，适合直接发给别人看。",
    },
    {
        "name": "德力 22SKU - 保守试水",
        "file": "deli-glass-russia-22sku-conservative-project.json",
        "slug": "deli-22sku-conservative",
        "desc": "先小批试卖、控制现金占用。",
    },
    {
        "name": "德力 22SKU - 标准启动",
        "file": "deli-glass-russia-22sku-standard-project.json",
        "slug": "deli-22sku-standard",
        "desc": "默认讲解版本，适合老板/供应商一起看。",
    },
    {
        "name": "德力 22SKU - 进取放量",
        "file": "deli-glass-russia-22sku-aggressive-project.json",
        "slug": "deli-22sku-aggressive",
        "desc": "讨论多平台和更高备货规模。",
    },
    {
        "name": "Ozon 90 天 - 保守试销",
        "file": "ozon-wholesale-90day-pack/ozon-wholesale-90day-conservative-project.json",
        "slug": "ozon-90day-conservative",
        "desc": "低预算验证上架、客服和履约链路。",
    },
    {
        "name": "Ozon 90 天 - 标准启动",
        "file": "ozon-wholesale-90day-pack/ozon-wholesale-90day-standard-project.json",
        "slug": "ozon-90day-standard",
        "desc": "本地现货供货合作的默认测算。",
    },
    {
        "name": "Ozon 90 天 - 放量验证",
        "file": "ozon-wholesale-90day-pack/ozon-wholesale-90day-scale-project.json",
        "slug": "ozon-90day-scale",
        "desc": "需要供货价、库存、补货和售后机制更稳定。",
    },
]


def load_json(relative_path: str) -> dict:
    path = ROOT / "public" / relative_path
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if "projectName" not in data:
        data["projectName"] = path.stem
    return data


def migrate() -> None:
    db = SessionLocal()
    try:
      ensure_default_admin(db)
      for item in LEGACY_PUBLIC_PROJECTS:
          existing = db.query(Project).filter(Project.legacy_file_path == item["file"]).first()
          if existing:
              print(f"skip existing: {item['file']}")
              continue

          data = load_json(item["file"])
          name = data.get("projectName") or item["name"]
          project = Project(
              id=make_id("project"),
              name=name,
              slug=unique_slug(db, item["slug"]),
              description=item["desc"],
              status="active",
              visibility="public",
              current_data_json=data,
              legacy_file_path=item["file"],
              created_by=settings.admin_username,
              updated_by=settings.admin_username,
              created_at=now_utc(),
              updated_at=now_utc(),
          )
          set_project_access_code(project, settings.default_public_access_code)
          db.add(project)
          db.flush()
          version = add_version(db, project.id, "published", data, settings.admin_username)
          project.published_version_id = version.id
          print(f"migrated: {item['file']} -> /p/{project.slug}")
      db.commit()
    finally:
      db.close()


if __name__ == "__main__":
    migrate()
