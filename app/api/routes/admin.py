from fastapi import APIRouter, HTTPException, Depends, Body, Path, Query, status # Added status
from typing import List, Dict, Any, Optional
import logging
import uuid
import asyncio
import httpx
from datetime import datetime, timedelta # Added for mock user initialization

from app.services.user_service import UserService
from app.services.system_status_service import SystemStatusService
from app.core.config import get_settings, Settings
from app.models.user import UserResponse, UserCreate, UserUpdate, MockApplicationUser, UserRole
# from app.core.dependencies import get_current_active_admin_user # Placeholder for auth

router = APIRouter()
logger = logging.getLogger(__name__)

# Mock user data for development if Azure AD is not configured
# This simulates the GetMockUsers functionality from C# DevAdminController
# Keys are string IDs for easier direct use in path parameters if needed for mock.
_MOCK_USERS_STORE_ADMIN_ROUTE: Dict[str, MockApplicationUser] = {}

def _initialize_mock_users_for_admin_route(settings_param: Settings):
    if not _MOCK_USERS_STORE_ADMIN_ROUTE and settings_param.DEBUG_MODE: # Initialize only once and if in debug mode
        logger.info("Initializing mock user store for admin route.")
        _MOCK_USERS_STORE_ADMIN_ROUTE["dev-admin-1"] = MockApplicationUser(
            id="dev-admin-1",
            displayName="Development Admin (Admin Route)",
            email="dev-admin@example.com",
            userPrincipalName="dev-admin@example.com",
            roles=[UserRole.ADMINISTRATOR],
            createdDateTime=datetime.utcnow() - timedelta(days=30)
        )
        _MOCK_USERS_STORE_ADMIN_ROUTE["dev-labeller-1"] = MockApplicationUser(
            id="dev-labeller-1",
            displayName="Development Labeller (Admin Route)",
            email="dev-labeller@example.com",
            userPrincipalName="dev-labeller@example.com",
            roles=[UserRole.LABELLER],
            createdDateTime=datetime.utcnow() - timedelta(days=20)
        )
        _MOCK_USERS_STORE_ADMIN_ROUTE["dev-reviewer-1"] = MockApplicationUser(
            id="dev-reviewer-1",
            displayName="Development Reviewer (Admin Route)",
            email="dev-reviewer@example.com",
            userPrincipalName="dev-reviewer@example.com",
            roles=[UserRole.REVIEWER],
            createdDateTime=datetime.utcnow() - timedelta(days=10)
        )
        logger.info(f"Mock user store for admin route initialized with {len(_MOCK_USERS_STORE_ADMIN_ROUTE)} users.")

# Initialize mock store when module is loaded, based on settings
# This requires settings to be available at module load time, or defer initialization.
# For simplicity, let's assume settings can be fetched here or initialization is called within an endpoint.
# Better: Initialize within a startup event or upon first request in debug mode.
# For now, let's try to initialize it via a dependency that ensures it runs once.

async def get_initialized_settings(settings: Settings = Depends(get_settings)) -> Settings:
    _initialize_mock_users_for_admin_route(settings)
    return settings

@router.get("/system-status", response_model=Dict[str, Any])
async def get_system_status(
    settings: Settings = Depends(get_initialized_settings),
    system_status_service: SystemStatusService = Depends()
    # current_user: UserResponse = Depends(get_current_active_admin_user), # Auth placeholder
):
    """
    Get the system status. Requires admin role in production.
    In development mode (DEBUG_MODE=True), this endpoint is open if not using actual auth.
    """
    if not settings.DEBUG_MODE:
        # Actual authentication/authorization check here for production
        # This part needs to be integrated with the actual Azure AD auth flow later.
        # For now, if not in debug mode, we might raise an error or rely on a dependency.
        # raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        pass # Placeholder: Assume auth is handled by a dependency like get_current_active_admin_user

    try:
        status_info = await system_status_service.get_system_status()
        return status_info
    except Exception as e:
        logger.error(f"Error retrieving system status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred while retrieving system status.")

@router.get("/admin/users", response_model=List[MockApplicationUser])
async def list_users(
    settings: Settings = Depends(get_initialized_settings),
    user_service: UserService = Depends()
    # current_user: UserResponse = Depends(get_current_active_admin_user), # Auth placeholder
):
    """
    List all users. Requires admin role in production.
    In development mode (DEBUG_MODE=True) and if Azure AD is not configured in UserService,
    returns mock users from the admin route's store if UserService returns empty or error.
    Otherwise, it attempts to fetch from UserService (which might use its own mock or Azure AD).
    """
    if settings.DEBUG_MODE and not settings.AZURE_AD_CLIENT_ID:
        logger.info("Admin route: DEBUG_MODE active & no AZURE_AD_CLIENT_ID. Serving admin mock users.")
        return list(_MOCK_USERS_STORE_ADMIN_ROUTE.values())
    
    try:
        users_from_service = await user_service.get_users_async()
        # Convert UserResponse from service to MockApplicationUser for this admin endpoint's contract
        return [
            MockApplicationUser.model_validate(user.model_dump(by_alias=True)) 
            for user in users_from_service
        ]
    except Exception as e:
        logger.error(f"Error listing users via user_service: {str(e)}", exc_info=True)
        if settings.DEBUG_MODE: # Fallback to admin mock if service fails in debug
            logger.warning("UserService failed, falling back to admin route's mock users.")
            return list(_MOCK_USERS_STORE_ADMIN_ROUTE.values())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list users")

@router.get("/admin/users/{user_id}", response_model=MockApplicationUser)
async def get_user(
    user_id: str = Path(..., description="The ID of the user to retrieve."),
    settings: Settings = Depends(get_initialized_settings),
    user_service: UserService = Depends()
    # current_user: UserResponse = Depends(get_current_active_admin_user), # Auth placeholder
):
    if settings.DEBUG_MODE and not settings.AZURE_AD_CLIENT_ID:
        logger.info(f"Admin route: DEBUG_MODE active & no AZURE_AD_CLIENT_ID. Getting mock user ID {user_id}.")
        user = _MOCK_USERS_STORE_ADMIN_ROUTE.get(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mock user with ID {user_id} not found in admin store")
        return user

    try:
        user_from_service = await user_service.get_user_by_id_async(user_id)
        if not user_from_service:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found via user_service")
        return MockApplicationUser.model_validate(user_from_service.model_dump(by_alias=True))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user {user_id} via user_service: {str(e)}", exc_info=True)
        if settings.DEBUG_MODE: # Fallback to admin mock
            logger.warning(f"UserService failed for get_user_by_id_async, trying admin route's mock for {user_id}.")
            user = _MOCK_USERS_STORE_ADMIN_ROUTE.get(user_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mock user with ID {user_id} not found in admin store after service failure")
            return user
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve user")

@router.post("/admin/users", response_model=MockApplicationUser, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: MockApplicationUser, # Request body is MockApplicationUser
    settings: Settings = Depends(get_initialized_settings),
    user_service: UserService = Depends()
    # current_user: UserResponse = Depends(get_current_active_admin_user), # Auth placeholder
):
    if settings.DEBUG_MODE and not settings.AZURE_AD_CLIENT_ID:
        logger.info(f"Admin route: DEBUG_MODE active & no AZURE_AD_CLIENT_ID. Creating mock user: {user_in.email}.")
        if user_in.id in _MOCK_USERS_STORE_ADMIN_ROUTE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Mock user with ID {user_in.id} already exists in admin store")
        new_id = user_in.id or f"dev-mock-{uuid.uuid4()}" # Ensure ID for mock
        
        # Ensure all required fields for MockApplicationUser are present or defaulted
        created_mock_user = MockApplicationUser(
            id=new_id,
            displayName=user_in.displayName,
            email=user_in.email,
            userPrincipalName=user_in.userPrincipalName or user_in.email,
            roles=user_in.roles or [UserRole.LABELLER],
            createdDateTime=datetime.utcnow(),
            password=None # Password is not stored or returned in MockApplicationUser like this
        )
        _MOCK_USERS_STORE_ADMIN_ROUTE[new_id] = created_mock_user
        return created_mock_user

    try:
        # Convert MockApplicationUser to UserCreate for the service layer
        user_create_service = UserCreate(
            email=user_in.email,
            password=user_in.password or "DefaultP@ssw0rd1", # DevAdminController implies password might not always be sent
            display_name=user_in.displayName,
            roles=user_in.roles or [UserRole.LABELLER]
        )
        created_user_from_service = await user_service.create_user_azure_ad_async(user_create_service)
        # Convert UserResponse from service back to MockApplicationUser
        return MockApplicationUser.model_validate(created_user_from_service.model_dump(by_alias=True))
    except ValueError as ve:
        logger.error(f"Validation error creating user {user_in.email}: {str(ve)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except HTTPException: # Re-raise HTTPExceptions from service (e.g., user already exists)
        raise
    except Exception as e:
        logger.error(f"Error creating user {user_in.email} via user_service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

@router.put("/admin/users/{user_id}", response_model=MockApplicationUser)
async def update_user(
    user_id: str = Path(..., description="The ID of the user to update."),
    user_in: MockApplicationUser = Body(...), # Request body is MockApplicationUser
    settings: Settings = Depends(get_initialized_settings),
    user_service: UserService = Depends()
    # current_user: UserResponse = Depends(get_current_active_admin_user), # Auth placeholder
):
    if settings.DEBUG_MODE and not settings.AZURE_AD_CLIENT_ID:
        logger.info(f"Admin route: DEBUG_MODE active & no AZURE_AD_CLIENT_ID. Updating mock user ID {user_id}.")
        if user_id not in _MOCK_USERS_STORE_ADMIN_ROUTE:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mock user with ID {user_id} not found in admin store")
        
        original_user = _MOCK_USERS_STORE_ADMIN_ROUTE[user_id]
        update_data = user_in.model_dump(exclude_unset=True, by_alias=False) # Use actual field names for model_copy
        if 'id' in update_data and update_data['id'] != user_id:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User ID in path and body mismatch, or attempt to change ID.")
        if 'id' in update_data: del update_data['id'] # Don't try to update ID itself

        updated_user_mock = original_user.model_copy(update=update_data)
        _MOCK_USERS_STORE_ADMIN_ROUTE[user_id] = updated_user_mock
        return updated_user_mock

    try:
        # Convert MockApplicationUser to UserUpdate for the service layer
        user_update_service = UserUpdate(
            email=user_in.email,
            display_name=user_in.displayName,
            roles=user_in.roles,
            password=user_in.password # Service layer handles hashing if password is provided
        )
        updated_user_from_service = await user_service.update_user_azure_ad_async(user_id, user_update_service)
        if not updated_user_from_service:
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found for update via user_service")
        return MockApplicationUser.model_validate(updated_user_from_service.model_dump(by_alias=True))
    except ValueError as ve:
        logger.error(f"Validation error updating user {user_id}: {str(ve)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except HTTPException: # Re-raise HTTPExceptions from service
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id} via user_service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user")

@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str = Path(..., description="The ID of the user to delete."),
    settings: Settings = Depends(get_initialized_settings),
    user_service: UserService = Depends()
    # current_user: UserResponse = Depends(get_current_active_admin_user), # Auth placeholder
):
    if settings.DEBUG_MODE and not settings.AZURE_AD_CLIENT_ID:
        logger.info(f"Admin route: DEBUG_MODE active & no AZURE_AD_CLIENT_ID. Deleting mock user ID {user_id}.")
        if user_id not in _MOCK_USERS_STORE_ADMIN_ROUTE:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mock user with ID {user_id} not found in admin store")
        del _MOCK_USERS_STORE_ADMIN_ROUTE[user_id]
        return

    try:
        success = await user_service.delete_user_azure_ad_async(user_id)
        if not success:
            # Service should raise HTTPException for not found, but double check here
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found or could not be deleted by user_service")
        return # FastAPI handles 204 No Content response automatically
    except HTTPException: # Re-raise HTTPExceptions from service
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id} via user_service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete user")

# @router.get("/admin/data/all", response_model=Dict[str, Any])
# async def get_all_admin_data(
#     settings: Settings = Depends(get_initialized_settings),
#     user_service: UserService = Depends(),
#     system_status_service: SystemStatusService = Depends()
# ):
#     """
#     Get all admin-related data in a single optimized response.
#     In development mode, returns mock data if Azure AD is not configured.
#     """
#     if settings.DEBUG_MODE and not settings.AZURE_AD_CLIENT_ID:
#         logger.info("Admin route: DEBUG_MODE active & no AZURE_AD_CLIENT_ID. Returning mock admin data.")
#         return {
#             "users": list(_MOCK_USERS_STORE_ADMIN_ROUTE.values()),
#             "system_status": {
#                 "status": "mock",
#                 "message": "Mock system status in development mode"
#             }
#         }

#     try:
#         users = await user_service.get_users_async()
#         system_status = await system_status_service.get_system_status()
        
#         return {
#             "users": [MockApplicationUser.model_validate(user.model_dump(by_alias=True)) for user in users],
#             "system_status": system_status
#         }
#     except Exception as e:
#         logger.error(f"Error retrieving all admin data: {str(e)}", exc_info=True)
#         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve all admin data")
