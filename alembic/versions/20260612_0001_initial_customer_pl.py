"""initial customer pl schema

Revision ID: 20260612_0001
Revises:
Create Date: 2026-06-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260612_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json_type():
    return sa.JSON()


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=240), nullable=False),
        sa.Column("slug", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("visibility", sa.String(length=24), nullable=False),
        sa.Column("current_data_json", _json_type(), nullable=False),
        sa.Column("published_version_id", sa.String(length=64), nullable=True),
        sa.Column("legacy_file_path", sa.String(length=500), nullable=True),
        sa.Column("public_access_code_hash", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=False),
        sa.Column("updated_by", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_legacy_file_path"), "projects", ["legacy_file_path"], unique=False)
    op.create_index(op.f("ix_projects_name"), "projects", ["name"], unique=False)
    op.create_index(op.f("ix_projects_slug"), "projects", ["slug"], unique=True)
    op.create_index(op.f("ix_projects_status"), "projects", ["status"], unique=False)
    op.create_index(op.f("ix_projects_updated_at"), "projects", ["updated_at"], unique=False)
    op.create_index(op.f("ix_projects_visibility"), "projects", ["visibility"], unique=False)
    op.create_index("ix_projects_visibility_status", "projects", ["visibility", "status"], unique=False)

    op.create_table(
        "project_versions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("project_id", sa.String(length=64), nullable=False),
        sa.Column("version_kind", sa.String(length=32), nullable=False),
        sa.Column("data_json", _json_type(), nullable=False),
        sa.Column("created_by", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_versions_created_at"), "project_versions", ["created_at"], unique=False)
    op.create_index(op.f("ix_project_versions_project_id"), "project_versions", ["project_id"], unique=False)

    op.create_table(
        "project_share_links",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("project_id", sa.String(length=64), nullable=True),
        sa.Column("token", sa.String(length=160), nullable=False),
        sa.Column("snapshot_data_json", _json_type(), nullable=False),
        sa.Column("access_code_hash", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_project_share_links_token"),
    )
    op.create_index(op.f("ix_project_share_links_expires_at"), "project_share_links", ["expires_at"], unique=False)
    op.create_index(op.f("ix_project_share_links_project_id"), "project_share_links", ["project_id"], unique=False)
    op.create_index(op.f("ix_project_share_links_token"), "project_share_links", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_share_links_token"), table_name="project_share_links")
    op.drop_index(op.f("ix_project_share_links_project_id"), table_name="project_share_links")
    op.drop_index(op.f("ix_project_share_links_expires_at"), table_name="project_share_links")
    op.drop_table("project_share_links")
    op.drop_index(op.f("ix_project_versions_project_id"), table_name="project_versions")
    op.drop_index(op.f("ix_project_versions_created_at"), table_name="project_versions")
    op.drop_table("project_versions")
    op.drop_index("ix_projects_visibility_status", table_name="projects")
    op.drop_index(op.f("ix_projects_visibility"), table_name="projects")
    op.drop_index(op.f("ix_projects_updated_at"), table_name="projects")
    op.drop_index(op.f("ix_projects_status"), table_name="projects")
    op.drop_index(op.f("ix_projects_slug"), table_name="projects")
    op.drop_index(op.f("ix_projects_name"), table_name="projects")
    op.drop_index(op.f("ix_projects_legacy_file_path"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")
