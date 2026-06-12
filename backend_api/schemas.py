from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    display_name: str = ""
    role: str


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class LegacyProjectImport(BaseModel):
    name: str
    description: str = ""
    slug: str
    legacy_file_path: str
    data: dict[str, Any] = Field(default_factory=dict)
    access_code: str | None = None


class ProjectSave(BaseModel):
    name: str | None = None
    description: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    expected_updated_at: str | None = None
    force: bool = False


class ProjectPublish(ProjectSave):
    slug: str | None = None
    access_code: str | None = None


class AccessCodeUpdate(BaseModel):
    access_code: str


class AccessUnlock(BaseModel):
    access_code: str


class ShareCreate(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    expires_in_hours: int = 72
    access_code: str | None = None


class ProjectOut(BaseModel):
    id: str
    workspaceId: str = "default"
    name: str
    slug: str
    description: str = ""
    status: str
    visibility: str
    currentData: dict[str, Any] = Field(default_factory=dict)
    publishedData: dict[str, Any] | None = None
    publishedVersionId: str | None = None
    legacyFilePath: str | None = None
    hasAccessCode: bool = False
    createdBy: str = ""
    updatedBy: str = ""
    createdAt: str | None = None
    updatedAt: str | None = None


class SaveResult(BaseModel):
    conflict: bool = False
    project: ProjectOut


class ShareOut(BaseModel):
    id: str
    token: str
    projectId: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    expiresAt: str | None = None
    createdAt: str | None = None
    createdBy: str = ""
    hasAccessCode: bool = False


class PublicLockState(BaseModel):
    locked: bool
    hasAccessCode: bool
