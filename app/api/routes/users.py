from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import List, Dict
import logging
from datetime import datetime, timedelta

from jose import JWTError, jwt

from app.core.config import Settings, get_settings
from app.models.user import UserRole, MockApplicationUser

settings = get_settings()
router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/me")
async def get_logged_in_user_from_cookie(
    request: Request,
    settings: Settings = Depends(get_settings)
):
    """
    Return user info by decoding internal JWT stored in HttpOnly cookie.
    This is for Microsoft-authenticated sessions using app_access_token.
    """
    token = request.cookies.get("app_access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return {
            "name": payload.get("name"),
            "email": payload.get("email"),
            "roles": payload.get("roles", [])
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/roles", response_model=Dict[str, List[str]])
async def get_available_roles():
    """
    Get all available user roles defined in the system.
    """
    return {"roles": UserRole.ALL}

@router.get("/dev/profile", response_model=MockApplicationUser, include_in_schema=True)
async def get_dev_user_profile(settings: Settings = Depends(get_settings)):
    """
    Development-only endpoint to get a mock user profile without authentication.
    Mirrors functionality of DevUserController.cs.
    Only available if DEBUG_MODE is True.
    """
    if not settings.DEBUG_MODE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found. This endpoint is development-only.")
    
    logger.info("User route: DEBUG_MODE active. Serving mock user profile from /dev/profile.")
    return MockApplicationUser(
        id="dev-profile-user-id",
        displayName="Development Profile User (from /dev/profile)",
        email="dev-profile@example.com",
        userPrincipalName="dev-profile@example.com",
        roles=[UserRole.ADMINISTRATOR, UserRole.REVIEWER],
        createdDateTime=datetime.utcnow() - timedelta(days=5)
    )
