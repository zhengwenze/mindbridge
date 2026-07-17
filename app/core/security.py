import hashlib
import hmac
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import UserAccount

basic_auth = HTTPBasic(auto_error=False)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_password(password), hashed)


def _credentials(credentials: HTTPBasicCredentials | None) -> tuple[str, str]:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing Basic authorization")
    return credentials.username, credentials.password


def current_user(
    credentials: Annotated[HTTPBasicCredentials | None, Depends(basic_auth)],
    db: Annotated[Session, Depends(get_db)],
) -> UserAccount:
    username, password = _credentials(credentials)
    user = db.query(UserAccount).filter(UserAccount.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad credentials")
    return user


def require_admin(user: Annotated[UserAccount, Depends(current_user)]) -> UserAccount:
    if "ROLE_ADMIN" not in user.roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user


def require_student(user: Annotated[UserAccount, Depends(current_user)]) -> UserAccount:
    if "ROLE_ADMIN" in user.roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Student access required")
    return user
