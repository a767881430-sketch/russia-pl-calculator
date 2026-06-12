import uuid

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User
from .security import create_access_token, decode_access_token, hash_secret, verify_secret


WRITE_ROLES = {"admin", "editor"}


def ensure_default_admin(db: Session) -> None:
    existing = db.query(User).filter(User.username == settings.admin_username).first()
    if existing:
        return
    admin = User(
        id=f"user_{uuid.uuid4().hex}",
        username=settings.admin_username,
        display_name="管理员",
        role="admin",
        status="active",
        password_hash=hash_secret(settings.admin_password),
    )
    db.add(admin)
    db.commit()


def get_token_from_request(request: Request) -> str:
    cookie_token = request.cookies.get("pl_token", "")
    if cookie_token:
        return cookie_token
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    return header


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    if not payload:
        raise HTTPException(status_code=401, detail="请先登录")
    user = db.query(User).filter(User.id == payload.get("sub"), User.status == "active").first()
    if not user:
        raise HTTPException(status_code=401, detail="登录已失效")
    return user


def require_writer(user: User = Depends(get_current_user)) -> User:
    if user.role not in WRITE_ROLES:
        raise HTTPException(status_code=403, detail="当前账号为只读权限，不能保存或发布")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="只有管理员可以执行该操作")
    return user


def login_user(db: Session, username: str, password: str) -> tuple[User, str] | None:
    user = db.query(User).filter(User.username == username, User.status == "active").first()
    if not user or not verify_secret(password, user.password_hash):
        return None
    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role})
    return user, token


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        "pl_token",
        token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_expire_hours * 3600,
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie("pl_token")
