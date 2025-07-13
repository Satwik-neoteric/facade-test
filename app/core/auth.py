from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.responses import RedirectResponse
from typing import List, Optional, Dict, Any, Callable
from pydantic import ValidationError
from jose import JWTError, jwt
import logging
from datetime import datetime, timedelta
 
from app.core.config import settings  # Use the centralized settings
from app.models.user import AuthenticatedUser  # Authenticated user model


# "Administrator": "Full access to all features including user management",
# "Labeller": "Can view and annotate images",
# "Reviewer": "Can review and approve/reject annotations"

 
logger = logging.getLogger(__name__)
 
# --- Internal Session JWT Handling (for Microsoft Auth) ---
def create_internal_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None):
    """
    Creates a JWT for your application's internal session management after Microsoft login.
    This token will be stored as an HttpOnly cookie.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Using ACCESS_TOKEN_EXPIRE_MINUTES for web session expiry
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt
 
def verify_internal_token(token: str) -> Dict[str, Any]:
    """
    Verifies your application's internal session JWT.
    Returns the payload if valid, raises HTTPException otherwise.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.exception(f"Internal session JWT validation failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid session token: {e}")
 
# --- Dependency for Web Pages (Microsoft Auth) ---
async def get_current_web_user(request: Request) -> AuthenticatedUser:
    """
    FastAPI dependency to get the current authenticated user for HTML pages
    based on the internal session cookie set after Microsoft login.
    If no valid token, it redirects to the intro page.
    """
    token = request.cookies.get("app_access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_302_FOUND,
            detail="Not authenticated",
            headers={"Location": "/intro"}
        )

    try:
        payload = verify_internal_token(token)
 
        # Extract user info from the internal token payload
        username = payload.get("email") or payload.get("preferred_username") or payload.get("name")
        email = payload.get("email")
        roles = payload.get("roles", [])  # Default to empty list if roles not in token
       
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token payload: missing user identifier")
       
        # Construct an AuthenticatedUser object from the session token claims
        user = AuthenticatedUser(
            username=username,
            email=email,
            display_name=payload.get("name"),  # Assuming 'name' from payload maps to display_name
            roles=roles,
            disabled=False  # Assuming Microsoft authenticated users are not disabled by default
        )
        return user
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error processing web user session: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session processing error")

# --- Web-only: Check if authenticated user is active ---
async def get_current_active_web_user(
    current_user: AuthenticatedUser = Security(get_current_web_user, scopes=[])
) -> AuthenticatedUser:
    """
    Get the current web user, ensuring they are active (not disabled).
    (Though Azure AD users are typically active; this is for consistency)
    """
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
 
 
# --- Role-Based Authorization Helpers for Web ---
def has_role(roles: List[str]):
    """
    Dependency factory to check if a user has any of the specified roles.
   
    Args:
        roles (List[str]): A list of role strings to check for.
    Usage Example:
        `Depends(has_role([UserRole.LABELLER, UserRole.REVIEWER]))`
    """
    async def has_role_dependency(
        request: Request,
        current_user: AuthenticatedUser = Depends(get_current_web_user)
    ) -> AuthenticatedUser:
        if not any(role in current_user.roles for role in roles):
            raise HTTPException(
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                detail="Redirecting to home due to insufficient permissions.",
                headers={"Location": "/home"}
            )
        return True
    return has_role_dependency
