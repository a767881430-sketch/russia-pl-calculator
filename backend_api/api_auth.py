from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .auth import clear_auth_cookie, get_current_user, login_user, set_auth_cookie
from .database import get_db
from .models import User
from .schemas import LoginRequest


router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.username,
        "display_name": user.display_name or user.username,
        "role": user.role,
        "user_metadata": {"display_name": user.display_name or user.username},
    }


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    result = login_user(db, payload.username, payload.password)
    if not result:
        raise HTTPException(status_code=401, detail="账号或密码错误")
    user, token = result
    set_auth_cookie(response, token)
    return {
        "token": token,
        "user": user_out(user),
        "workspaceId": "default",
        "workspaceRole": user.role,
    }


@router.post("/logout")
def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "user": user_out(user),
        "workspaceId": "default",
        "workspaceRole": user.role,
    }
