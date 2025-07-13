from fastapi import APIRouter, Depends, HTTPException, status, Request, Security
from typing import List, Dict, Any
import logging
from pydantic import BaseModel
from datetime import datetime

from app.core.auth import get_current_web_user, has_role
from app.models.user import UserRole, AuthenticatedUser
from app.services.graph_service import GraphService

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)

# Create GraphService instance
graph_service = GraphService()

# Add validation status model
class ValidationStatusRequest(BaseModel):
    batch_id: str
    image_id: str
    validation_status: str  # 'accepted' or 'rejected'
    reviewer_id: str
    timestamp: str

@router.get("/users", response_model=List[Dict[str, Any]])
async def get_ad_users(
    current_user: AuthenticatedUser = Security(get_current_web_user),
    admin_access: bool = Depends(has_role([UserRole.ADMINISTRATOR]))
):
    """
    Get all users with assigned roles in the application
    """
    try:
        users = await graph_service.get_users()
        logger.info(f"Retrieved {len(users)} users")
        return users
    except Exception as e:
        logger.error(f"Error getting AD users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting users: {str(e)}"
        )

@router.post("/users", response_model=Dict[str, Any])
async def add_ad_user(
    user_data: Dict[str, Any],
    current_user: AuthenticatedUser = Security(get_current_web_user),
    admin_access: bool = Depends(has_role([UserRole.ADMINISTRATOR]))
):
    """
    Add a user to the application with a specific role
    """
    try:
        email = user_data.get("email")
        role = user_data.get("role")
        
        logger.info(f"Received request to add user: email={email}, role={role}")
        
        if not email or not role:
            logger.warning(f"Missing required fields: email={email}, role={role}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and role are required"
            )
            
        if role not in UserRole.ALL:
            logger.warning(f"Invalid role: {role}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {role}. Must be one of {UserRole.ALL}"
            )
        log_msg = f"Adding user with email={email}, role={role}"
        logger.info(log_msg)
        print(f"INFO: {log_msg}")
        
        result = await graph_service.add_user(email, role)
        
        log_msg = f"User added successfully: {result}"
        logger.info(log_msg)
        print(f"INFO: {log_msg}")
        
        return result    
    except ValueError as e:
        error_msg = f"Value error when adding user: {str(e)}"
        logger.warning(error_msg)
        print(f"WARNING: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        error_msg = f"Error adding AD user: {e}"
        logger.error(error_msg)
        print(f"ERROR: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding user: {str(e)}"
        )

@router.put("/users/{user_id}", response_model=Dict[str, Any])
async def update_ad_user_role(
    user_id: str,
    user_data: Dict[str, Any],
    current_user: AuthenticatedUser = Security(get_current_web_user),
    admin_access: bool = Depends(has_role([UserRole.ADMINISTRATOR]))
):
    """
    Update a user's role in the application
    """
    try:
        role = user_data.get("role")
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role is required"
            )
            
        if role not in UserRole.ALL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {role}. Must be one of {UserRole.ALL}"
            )
            
        result = await graph_service.update_user_role(user_id, role)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating AD user role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user role: {str(e)}"
        )

@router.delete("/users/{user_id}", response_model=Dict[str, Any])
async def delete_ad_user(
    user_id: str,
    current_user: AuthenticatedUser = Security(get_current_web_user),
    admin_access: bool = Depends(has_role([UserRole.ADMINISTRATOR]))
):
    """
    Remove a user from the application by removing their role assignments
    """
    try:
        result = await graph_service.delete_user(user_id)
        return result
    except Exception as e:
        logger.error(f"Error deleting AD user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )

@router.post("/validation-status", response_model=Dict[str, Any])
async def save_validation_status(
    validation_data: ValidationStatusRequest,
    current_user: AuthenticatedUser = Security(get_current_web_user),
    reviewer_access: bool = Depends(has_role([UserRole.REVIEWER, UserRole.ADMINISTRATOR]))
):
    """
    Save validation status for an image annotation
    """
    try:
        logger.info(f"Saving validation status: {validation_data.validation_status} for image {validation_data.image_id} in batch {validation_data.batch_id}")
        
        # For now, just log the validation status
        # TODO: Implement actual storage in Cosmos DB or another persistence layer
        result = {
            "success": True,
            "message": f"Validation status '{validation_data.validation_status}' saved for image {validation_data.image_id}",
            "batch_id": validation_data.batch_id,
            "image_id": validation_data.image_id,
            "validation_status": validation_data.validation_status,
            "reviewer_id": validation_data.reviewer_id,
            "timestamp": validation_data.timestamp
        }
        
        logger.info(f"Validation status saved successfully: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error saving validation status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving validation status: {str(e)}"
        )
