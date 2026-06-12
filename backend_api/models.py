from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[str] = mapped_column(String(24), default="editor")
    status: Mapped[str] = mapped_column(String(24), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(240), index=True)
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    visibility: Mapped[str] = mapped_column(String(24), default="private", index=True)
    current_data_json: Mapped[dict] = mapped_column(JSON, default=dict)
    published_version_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    legacy_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)
    public_access_code_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(120), default="")
    updated_by: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    versions: Mapped[list["ProjectVersion"]] = relationship("ProjectVersion", back_populates="project", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_projects_visibility_status", "visibility", "status"),
    )


class ProjectVersion(Base):
    __tablename__ = "project_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(64), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version_kind: Mapped[str] = mapped_column(String(32), default="draft")
    data_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    project: Mapped[Project] = relationship("Project", back_populates="versions")


class ProjectShareLink(Base):
    __tablename__ = "project_share_links"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    token: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    snapshot_data_json: Mapped[dict] = mapped_column(JSON, default=dict)
    access_code_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint("token", name="uq_project_share_links_token"),
    )
