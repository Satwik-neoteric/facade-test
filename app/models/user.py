from pydantic import BaseModel, EmailStr, validator, Field
from typing import List, Optional
import re
from datetime import datetime
import uuid
from uuid import UUID

# "Administrator": "Full access to all features including user management",
# "Labeller": "Can view and annotate images",
# "Reviewer": "Can review and approve/reject annotations"

class UserRole:
    """
    Centralized user roles
    """
    ADMINISTRATOR = "Administrator"
    LABELLER = "Labeller"
    REVIEWER = "Reviewer"
    ALL = [ADMINISTRATOR, LABELLER, REVIEWER]


class UserBase(BaseModel):
    """
    Base user model with common attributes
    """
    email: EmailStr = Field(..., description="User's email address, used for login.")
    display_name: Optional[str] = Field(None, max_length=100, description="User's display name.")

class UserCreate(UserBase):
    """
    User creation model with password
    """
    password: str = Field(..., min_length=8, description="User's password (min 8 characters).")
    roles: List[str] = Field(default_factory=lambda: [UserRole.LABELLER], description="List of user roles.")

    @validator('password')
    def password_complexity(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v
    
    @validator('roles', each_item=True)
    def validate_roles(cls, v):
        if v not in UserRole.ALL:
            raise ValueError(f"Invalid role: {v}. Valid roles are: {', '.join(UserRole.ALL)}")
        return v

class UserUpdate(BaseModel):
    """
    User update model with optional fields
    """
    email: Optional[EmailStr] = Field(None, description="User's email address.")
    display_name: Optional[str] = Field(None, max_length=100, description="User's display name.")
    password: Optional[str] = Field(None, min_length=8, description="User's new password (min 8 characters).")
    roles: Optional[List[str]] = Field(None, description="List of user roles.")

    @validator('password')
    def password_complexity_optional(cls, v):
        if v is not None and len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v
    
    @validator('roles', each_item=True)
    def validate_roles_optional(cls, v_list):
        if v_list is None:
            return v_list
        for v in v_list:
            if v not in UserRole.ALL:
                raise ValueError(f"Invalid role: {v}. Valid roles are: {', '.join(UserRole.ALL)}")
        return v_list

class UserInDBBase(UserBase):
    """
    User model as stored in the database (base part)
    """
    id: uuid.UUID = Field(default_factory=uuid.uuid4, description="Unique user ID.")
    roles: List[str] = Field(default_factory=list)
    created_datetime: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of user creation.")
    
    class Config:
        orm_mode = True

class UserInDB(UserInDBBase):
    """
    User model as stored in the database, including hashed password
    """
    hashed_password: str = Field(..., description="Hashed password for storage.")


class UserResponse(UserInDBBase):
    """
    User model returned from API (excluding sensitive info like password)
    """
    pass


# --- NEW MODEL: AuthenticatedUser ---
class AuthenticatedUser(BaseModel):
    """
    Model representing an authenticated user, returned by get_current_user dependencies.
    This consolidates the necessary fields for both web (Microsoft) and API authentication.
    """
    username: str = Field(..., description="The primary identifier for the authenticated user (e.g., email or preferred username).")
    email: EmailStr = Field(..., description="User's email address.")
    display_name: Optional[str] = Field(None, description="User's display name.")
    roles: List[str] = Field(default_factory=list, description="List of user roles.")
    disabled: bool = Field(False, description="True if the user account is disabled.")
    # You might optionally include id if it's consistently available and useful for the frontend/further logic
    # id: Optional[uuid.UUID] = Field(None, description="Unique user ID.")

    class Config:
        orm_mode = True # For compatibility if mapping from ORM objects
        from_attributes = True # Pydantic v2 equivalent of orm_mode
        populate_by_name = True # Allows using alias for field names (e.g. from DB)


class Token(BaseModel):
    """
    JWT token model
    """
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """
    Token data model, used for decoding JWT claims
    """
    sub: Optional[str] = Field(None, description="Subject of the token, typically user ID or email.") 
    scopes: List[str] = Field(default_factory=list)

# For DevAdminController mock responses
class MockApplicationUser(BaseModel):
    id: UUID = Field(..., description="User ID (can be string for mock).")
    displayName: Optional[str] = Field(None, alias="display_name")
    email: EmailStr
    userPrincipalName: Optional[EmailStr] = Field(None, alias="user_principal_name")
    roles: Optional[List[str]] = Field(default_factory=list)
    createdDateTime: Optional[datetime] = Field(None, alias="created_datetime")
    password: Optional[str] = None # Only for creation, not for response

    class Config:
        populate_by_name = True # Allows using alias for field names
        from_attributes = True # orm_mode for Pydantic v1
