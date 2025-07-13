from typing import List, Dict, Any, Optional
import logging
from fastapi import Depends, HTTPException, status
from datetime import datetime, timedelta
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from app.core.config import get_settings, Settings
from app.models.user import UserResponse, UserRole, UserCreate, UserUpdate
from app.services.graph_service import GraphService

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self, settings: Settings = Depends(get_settings)):
        self.settings = settings
        self.graph_service = GraphService()
        if not self.settings.AZURE_AD_CLIENT_ID:
            logger.warning("Azure AD client ID not configured. Authentication will not work properly.")

    async def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """
        Create a JWT access token.
        """
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=self.settings.ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({
            "exp": expire,
            "sub": data.get("sub") or data.get("email"),
        })
        return jwt.encode(to_encode, self.settings.JWT_SECRET_KEY, algorithm=self.settings.JWT_ALGORITHM)

    async def get_user_from_token(self, token: str) -> Optional[UserResponse]:
        """
        Decode JWT token and extract user identity.
        NOTE: In production, use the Microsoft Graph API to fetch user info.
        """
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            payload = jwt.decode(token, self.settings.JWT_SECRET_KEY, algorithms=[self.settings.JWT_ALGORITHM])
            user_identifier: Optional[str] = payload.get("sub")
            if user_identifier is None:
                raise credentials_exception
        except ExpiredSignatureError:
            logger.info("Token has expired")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired", headers={"WWW-Authenticate": "Bearer"})
        except InvalidTokenError:
            logger.error("Invalid token")
            raise credentials_exception

        logger.warning("Azure AD integration for get_user_from_token not implemented. Returning mock user.")
        # Placeholder: Replace with real Azure AD user fetch
        return UserResponse(
            id=user_identifier,
            email=payload.get("email", "unknown@example.com"),
            display_name=payload.get("name", "Unknown User"),
            roles=[UserRole.REVIEWER],  # Default role
            created_datetime=datetime.utcnow()
        )

    async def get_users_async(self) -> List[UserResponse]:
        """
        Retrieve users from Azure AD via Microsoft Graph API.
        """
        # Check if Azure AD is properly configured
        if not self.settings.AZURE_AD_CLIENT_ID:
            logger.warning("Azure AD not configured. Cannot retrieve users")
            if self.settings.DEBUG_MODE:
                logger.info("DEBUG_MODE enabled, returning development mock users")
                # Return mock users for development
                return [
                    UserResponse(
                        id="dev-admin-1",
                        email="admin@example.com",
                        display_name="Development Admin",
                        roles=[UserRole.ADMINISTRATOR],
                        created_datetime=datetime.utcnow() - timedelta(days=30)
                    ),
                    UserResponse(
                        id="dev-labeller-1",
                        email="labeller@example.com", 
                        display_name="Development Labeller",
                        roles=[UserRole.LABELLER],
                        created_datetime=datetime.utcnow() - timedelta(days=20)
                    ),
                    UserResponse(
                        id="dev-reviewer-1",
                        email="reviewer@example.com",
                        display_name="Development Reviewer", 
                        roles=[UserRole.REVIEWER],
                        created_datetime=datetime.utcnow() - timedelta(days=10)
                    )
                ]
            return []
        
        # Production: Use Microsoft Graph API to get real users
        try:
            logger.info("Fetching users from Microsoft Graph API")
            graph_users = await self.graph_service.get_users()
            
            # Convert graph users to UserResponse objects
            user_responses = []
            for graph_user in graph_users:
                # Ensure ID is converted to string if it's a UUID
                user_id = str(graph_user.get("id")) if graph_user.get("id") else None
                user_response = UserResponse(
                    id=user_id,
                    email=graph_user.get("email"),
                    display_name=graph_user.get("displayName"),
                    roles=[graph_user.get("role", UserRole.REVIEWER)],  # Default to REVIEWER if role not found
                    created_datetime=datetime.utcnow()  # Graph doesn't provide creation time easily
                )
                user_responses.append(user_response)
            
            logger.info(f"Successfully retrieved {len(user_responses)} users from Microsoft Graph")
            return user_responses
            
        except Exception as e:
            logger.error(f"Error fetching users from Microsoft Graph: {str(e)}")
            
            # In production, we might want to fail gracefully or provide cached data
            # For now, we'll return an empty list but log the error
            if self.settings.DEBUG_MODE:
                logger.warning("Graph API failed in DEBUG_MODE, returning empty list")
            
            # Re-raise for production so admin knows there's an issue
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve users from Azure AD: {str(e)}"
            )

    async def get_user_by_id_async(self, user_id_str: str) -> Optional[UserResponse]:
        """
        Retrieve a single user from Azure AD using their object ID.
        """
        # Special handling for 'me' identifier in development mode
        if user_id_str == "me" and self.settings.DEBUG_MODE:
            logger.info("Development mode: Returning mock user for 'me' identifier")
            return UserResponse(
                id="dev-user-me",
                email="dev-user@example.com",
                display_name="Development User",
                roles=[UserRole.ADMINISTRATOR],
                created_datetime=datetime.utcnow() - timedelta(days=1)
            )
        
        # Check if Azure AD is properly configured
        if not self.settings.AZURE_AD_CLIENT_ID:
            logger.warning(f"Azure AD not configured. Cannot retrieve user {user_id_str}")
            if self.settings.DEBUG_MODE:
                # Return a generic development user in debug mode
                return UserResponse(
                    id=user_id_str,
                    email=f"{user_id_str}@example.com",
                    display_name=f"Dev User {user_id_str}",
                    roles=[UserRole.LABELLER],
                    created_datetime=datetime.utcnow() - timedelta(days=1)
                )
            return None
        
        # TODO: Implement actual Azure AD integration
        logger.warning(f"Azure AD integration not yet implemented for user {user_id_str}")
        return None

    async def create_user_azure_ad_async(self, user_in: UserCreate) -> UserResponse:
        """
        Create a new user in Azure AD.
        """
        # Check if Azure AD is properly configured
        if not self.settings.AZURE_AD_CLIENT_ID:
            if self.settings.DEBUG_MODE:
                logger.info(f"Development mode: Creating mock user for {user_in.email}")
                # Return a mock created user
                return UserResponse(
                    id=f"dev-created-{user_in.email.split('@')[0]}",
                    email=user_in.email,
                    display_name=user_in.display_name or user_in.email.split('@')[0],
                    roles=user_in.roles or [UserRole.LABELLER],
                    created_datetime=datetime.utcnow()
                )
            else:
                logger.error(f"Azure AD not configured. Cannot create user {user_in.email}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="User management service not available. Azure AD not configured."
                )
        
        # TODO: Implement actual Azure AD integration
        logger.warning(f"Azure AD integration not yet implemented for user creation: {user_in.email}")
        raise NotImplementedError("Azure AD user creation not implemented yet.")

    async def update_user_azure_ad_async(self, user_id_str: str, user_in: UserUpdate) -> Optional[UserResponse]:
        """
        Update user attributes in Azure AD.
        """
        # Check if Azure AD is properly configured
        if not self.settings.AZURE_AD_CLIENT_ID:
            if self.settings.DEBUG_MODE:
                logger.info(f"Development mode: Updating mock user {user_id_str}")
                # Return a mock updated user
                return UserResponse(
                    id=user_id_str,
                    email=user_in.email or f"{user_id_str}@example.com",
                    display_name=user_in.display_name or f"Updated User {user_id_str}",
                    roles=user_in.roles or [UserRole.LABELLER],
                    created_datetime=datetime.utcnow() - timedelta(days=1)
                )
            else:
                logger.error(f"Azure AD not configured. Cannot update user {user_id_str}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="User management service not available. Azure AD not configured."
                )
        
        # TODO: Implement actual Azure AD integration
        logger.warning(f"Azure AD integration not yet implemented for user update: {user_id_str}")
        raise NotImplementedError("Azure AD user update not implemented yet.")

    async def delete_user_azure_ad_async(self, user_id_str: str) -> bool:
        """
        Delete a user from Azure AD.
        """
        # Check if Azure AD is properly configured
        if not self.settings.AZURE_AD_CLIENT_ID:
            if self.settings.DEBUG_MODE:
                logger.info(f"Development mode: Mock deletion of user {user_id_str}")
                return True
            else:
                logger.error(f"Azure AD not configured. Cannot delete user {user_id_str}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="User management service not available. Azure AD not configured."
                )
        
        # TODO: Implement actual Azure AD integration
        logger.warning(f"Azure AD integration not yet implemented for user deletion: {user_id_str}")
        raise NotImplementedError("Azure AD user deletion not implemented yet.")
