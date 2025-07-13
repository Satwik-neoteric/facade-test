import requests
import json
from typing import Dict, List, Optional, Any
import logging
from app.core.config import settings
from app.models.user import UserRole

logger = logging.getLogger(__name__)

# Role IDs mapping
ROLE_IDS = {
    UserRole.ADMINISTRATOR: "e94b7e56-b426-480e-aeb2-ee309fca7eae",
    UserRole.LABELLER: "e36f42cf-296b-450f-8e6c-121cac0c38d0",
    UserRole.REVIEWER: "153cbdf8-96f8-4bf2-beae-6bfa896538b3"
}

class GraphService:
    """
    Service class for Microsoft Graph API operations related to user management
    """   
    
    def __init__(self):
        self.tenant_id = settings.AZURE_AD_TENANT_ID
        self.client_id = settings.AZURE_AD_CLIENT_ID
        self.client_secret = settings.AZURE_AD_CLIENT_SECRET
        self.base_url = "https://graph.microsoft.com/v1.0"
        self.access_token = None
        self.app_id = settings.AZURE_AD_CLIENT_ID  # The app registration ID
        # __init__ should not return anything
        
    async def get_access_token(self) -> str:
        """
        Get an access token for the Microsoft Graph API using client credentials flow
        """
        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        payload = {
            'client_id': self.client_id,
            'scope': 'https://graph.microsoft.com/.default',
            'client_secret': self.client_secret,
            'grant_type': 'client_credentials'
        }
        
        try:
            response = requests.post(url, data=payload)
            response.raise_for_status()
            token_data = response.json()            
            if 'access_token' not in token_data:
                error_msg = f"Token response missing access_token: {token_data}"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError("Failed to obtain access token - no token in response")
                
            self.access_token = token_data['access_token']
            success_msg = "Successfully obtained Microsoft Graph API access token"
            logger.info(success_msg)
            print(f"INFO: {success_msg}")
            return self.access_token
        
        except Exception as e:
            error_msg = f"Error getting access token: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            
            # Provide specific guidance for common errors
            if "401" in str(e) or "unauthorized" in str(e).lower():
                guidance_msg = (
                    "❌ AUTHENTICATION FAILED: This is likely due to missing Azure AD app permissions.\n"
                    "🔧 REQUIRED FIX: Add these Application permissions to your Azure AD app registration:\n"
                    "   • Application.Read.All\n"
                    "   • User.Read.All\n"
                    "   • AppRoleAssignment.ReadWrite.All\n"
                    "📋 Then grant admin consent for these permissions.\n"
                    "📖 See AZURE_AD_PERMISSIONS_FIX.md for detailed instructions."
                )
                print(f"GUIDANCE: {guidance_msg}")
                logger.error(guidance_msg)
            
            raise    
    
  
    async def get_users(self) -> List[Dict[str, Any]]:
        """
        Get all users who have app roles assigned in this application
        """
        if not self.access_token:
            print("INFO: No access token found, getting one...")
            await self.get_access_token()
            
        # First get the service principal for our app
        try:
            # Get the service principal ID for our app
            print(f"INFO: Getting service principal for app ID {self.app_id}")
            sp_url = f"{self.base_url}/servicePrincipals?$filter=appId eq '{self.app_id}'"
            sp_response = requests.get(sp_url, headers={"Authorization": f"Bearer {self.access_token}"})
            sp_response.raise_for_status()
            service_principal_id = sp_response.json().get("value")[0].get("id")
            print(f"INFO: Found service principal ID: {service_principal_id}")
            
            # Get all app role assignments for this service principal
            print("INFO: Getting app role assignments...")
            assignments_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo"
            assignments_response = requests.get(assignments_url, headers={"Authorization": f"Bearer {self.access_token}"})
            assignments_response.raise_for_status()
            
            # Extract user information from assignments
            users = []
            print(f"INFO: Found {len(assignments_response.json().get('value', []))} app role assignments")
            for assignment in assignments_response.json().get("value", []):
                if assignment.get("principalType") == "User":
                    # Get detailed user info
                    user_id = assignment.get("principalId")
                    print(f"INFO: Getting details for user ID: {user_id}")
                    user_url = f"{self.base_url}/users/{user_id}"
                    user_response = requests.get(user_url, headers={"Authorization": f"Bearer {self.access_token}"})
                    user_response.raise_for_status()
                    user_data = user_response.json()
                    # Determine role from appRoleId
                    role = "Unknown"
                    app_role_id = assignment.get("appRoleId")
                    for role_name, role_id in ROLE_IDS.items():
                        if role_id == app_role_id:
                            role = role_name
                            break
                    
                    users.append({
                        "id": user_data.get("id"),
                        # "email": user_data.get("userPrincipalName"),
                        "email": user_data.get("mail") or user_data.get("userPrincipalName"),
                        "displayName": user_data.get("displayName"),
                        "role": role
                    })
            # Return the complete users list after all users are processed
            print(f"INFO: Returning {len(users)} users")
            return users
        
        except Exception as e:
            logger.error(f"Error getting users: {e}")
            print(f"ERROR: Error getting users: {e}")
            
            # Provide specific guidance for permission-related errors
            if "401" in str(e) or "unauthorized" in str(e).lower():
                guidance_msg = (
                    "❌ MICROSOFT GRAPH API ACCESS DENIED\n"
                    "🔧 SOLUTION: Your Azure AD app registration needs these Application permissions:\n"
                    "   • Application.Read.All (to read service principals)\n"
                    "   • User.Read.All (to read user information)\n"
                    "   • AppRoleAssignment.ReadWrite.All (to manage role assignments)\n"
                    "\n📋 STEPS TO FIX:\n"
                    "   1. Go to Azure Portal > Azure AD > App registrations\n"
                    "   2. Find app ID: 02728f82-9818-468c-9569-79f86184ed73\n"
                    "   3. Go to API permissions > Add permission > Microsoft Graph > Application permissions\n"
                    "   4. Add the permissions listed above\n"
                    "   5. Click 'Grant admin consent' (CRITICAL STEP)\n"
                    "\n📖 See AZURE_AD_PERMISSIONS_FIX.md for complete instructions."
                )
                print(f"GUIDANCE: {guidance_msg}")
                logger.error(guidance_msg)
            elif "403" in str(e) or "forbidden" in str(e).lower():
                guidance_msg = (
                    "❌ INSUFFICIENT PERMISSIONS\n"
                    "🔧 Your app has permissions but admin consent may be missing.\n"
                    "📋 Go to Azure Portal > Your App > API permissions > Grant admin consent"
                )
                print(f"GUIDANCE: {guidance_msg}")
                logger.error(guidance_msg)
            
            raise
    
        
    async def add_user(self, email: str, role: str) -> Dict[str, Any]:
        """
        Add a user to the app by assigning them an app role
        
        Note: The user must already exist in the tenant
        """
        if not self.access_token:
            print("INFO: No access token found, getting one for add_user...")
            await self.get_access_token()
        try:
            logger.info(f"Adding user with email {email} and role {role}")
            print(f"INFO: Adding user with email {email} and role {role}")
            
            # Get the service principal ID for our app
            sp_url = f"{self.base_url}/servicePrincipals?$filter=appId eq '{self.app_id}'"
            sp_headers = {
                "Authorization": f"Bearer {self.access_token}",
                "ConsistencyLevel": "eventual"
            }
            
            logger.info(f"Fetching service principal for app ID {self.app_id}")
            print(f"INFO: Fetching service principal for app ID {self.app_id}")
            sp_response = requests.get(sp_url, headers=sp_headers)
            
            if not sp_response.ok:
                logger.error(f"Service principal request failed: {sp_response.status_code} - {sp_response.text}")
                sp_response.raise_for_status()
                
            sp_data = sp_response.json()
            if not sp_data.get("value"):
                logger.error(f"No service principal found for app ID {self.app_id}: {sp_data}")
                raise ValueError(f"No service principal found for app ID {self.app_id}")
                
            service_principal_id = sp_data["value"][0]["id"]
            logger.info(f"Found service principal ID: {service_principal_id}")
            
            # ALTERNATIVE APPROACH: Use Microsoft Graph Users.ReadBasic.All permission to list users
            # or use Directory.Read.All if the app has been granted that permission
            
            # Find user through directory
            try:                # Try to find the user directly
                log_msg = f"Looking up user with email: {email}"
                logger.info(log_msg)
                print(f"INFO: {log_msg}")
                user_url = f"{self.base_url}/users?$filter=userPrincipalName eq '{email}' or mail eq '{email}'&$select=id,displayName,userPrincipalName,mail"
                user_response = requests.get(
                    user_url, 
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "ConsistencyLevel": "eventual"
                    }
                )
                if not user_response.ok:
                    error_msg = f"User lookup failed: {user_response.status_code} - {user_response.text}"
                    logger.warning(error_msg)
                    print(f"WARNING: {error_msg}")
                    # If we get permission denied, we'll try an alternative approach
                    if user_response.status_code == 403:
                        log_msg = "Permission denied accessing users. Using invitation approach instead."
                        logger.info(log_msg)
                        print(f"INFO: {log_msg}")
                        raise PermissionError("Permission denied accessing users directly")
                    else:
                        user_response.raise_for_status()
                
                user_data = user_response.json()
                users = user_data.get("value", [])
                print(f"INFO: User lookup result: {json.dumps(user_data)}")
                
                if not users:
                    error_msg = f"User with email {email} not found"
                    logger.warning(error_msg)
                    print(f"WARNING: {error_msg}")
                    raise ValueError(f"User with email {email} not found in Azure AD")
                user_id = users[0].get("id")
                log_msg = f"Found user ID: {user_id}"
                logger.info(log_msg)
                print(f"INFO: {log_msg}")
            except PermissionError:
                # If we can't search for users, try adding by inviting the user
                # This requires the app to have Directory.ReadWrite.All permission
                # which is a highly privileged permission
                # 
                # For now, we'll return an informative error message
                error_msg = "Application doesn't have permission to search for users"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError(
                    "The application doesn't have permission to search for users. "
                    "Please add 'User.Read.All' or 'User.ReadBasic.All' permission to your app registration."
                )
              # Get the appropriate role ID
            role_id = ROLE_IDS.get(role)
            if not role_id:
                error_msg = f"Invalid role: {role}"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError(f"Invalid role: {role}. Valid roles are: {', '.join(ROLE_IDS.keys())}")
            
            log_msg = f"Assigning role {role} (ID: {role_id}) to user {user_id}"
            logger.info(log_msg)
            print(f"INFO: {log_msg}")
            
            # Check if the user already has a role assignment to avoid duplicates
            check_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo"
            log_msg = f"Checking for existing role assignments at URL: {check_url}"
            logger.info(log_msg)
            print(f"INFO: {log_msg}")
            
            check_response = requests.get(check_url, headers={"Authorization": f"Bearer {self.access_token}"})
            check_response.raise_for_status()
            
            # Filter assignments for this user locally
            all_assignments = check_response.json().get("value", [])
            log_msg = f"Found {len(all_assignments)} total role assignments"
            logger.info(log_msg)
            print(f"INFO: {log_msg}")
            
            # Debug: Print all user IDs from role assignments
            user_ids = [a.get("principalId") for a in all_assignments]
            print(f"DEBUG: All user IDs in role assignments: {', '.join(user_ids)}")
            print(f"DEBUG: Looking for user ID: {user_id}")
            
            user_assignments = [a for a in all_assignments if a.get("principalId") == user_id]
            log_msg = f"Found {len(user_assignments)} role assignments for user ID {user_id}"
            logger.info(log_msg)
            print(f"INFO: {log_msg}")
            
            if user_assignments:
                log_msg = f"User {user_id} already has a role assignment. Updating role instead."
                logger.info(log_msg)
                print(f"INFO: {log_msg}")
                # User already has a role, update it instead
                return await self.update_user_role(user_id, role)
            
            # Create the app role assignment
            assignment_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo"
            assignment_data = {
                "principalId": user_id,
                "resourceId": service_principal_id,
                "appRoleId": role_id,
                "principalType": "User"
            }
            log_msg = f"Creating role assignment with data: {json.dumps(assignment_data)}"
            logger.info(log_msg)
            print(f"INFO: {log_msg}")
            assignment_response = requests.post(
                assignment_url, 
                json=assignment_data, 
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if not assignment_response.ok:
                error_msg = f"Role assignment failed: {assignment_response.status_code} - {assignment_response.text}"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                assignment_response.raise_for_status()
            
            log_msg = f"Successfully added user {email} with role {role}"
            logger.info(log_msg)
            print(f"INFO: {log_msg}")
            return {
                "id": user_id,
                "email": email,
                "role": role,
                "success": True
            }        
            
        except ValueError as e:
            error_msg = f"Value error adding user: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise
        except Exception as e:
            error_msg = f"Error adding user: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise

    async def update_user_role(self, user_id: str, new_role: str) -> Dict[str, Any]:
        """
        Update a user's role by removing existing role assignment and adding a new one
        """
        log_msg = f"Updating role for user {user_id} to {new_role}"
        logger.info(log_msg)
        print(f"INFO: {log_msg}")
        
        if not self.access_token:
            log_msg = "No access token found, getting one for update_user_role..."
            logger.info(log_msg)
            print(f"INFO: {log_msg}")
            await self.get_access_token()
            
        try:
            # Get the service principal ID for our app
            sp_url = f"{self.base_url}/servicePrincipals?$filter=appId eq '{self.app_id}'"
            sp_response = requests.get(sp_url, headers={"Authorization": f"Bearer {self.access_token}"})
            sp_response.raise_for_status()
            service_principal_id = sp_response.json().get("value")[0].get("id")
            
            # Get all role assignments for this service principal, then filter locally
            # Graph API doesn't reliably support all $filter operations on this endpoint
            assignments_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo"
            assignments_response = requests.get(assignments_url, headers={"Authorization": f"Bearer {self.access_token}"})
            assignments_response.raise_for_status()
            
            # Filter assignments for this user locally
            all_assignments = assignments_response.json().get("value", [])
            assignments = [a for a in all_assignments if a.get("principalId") == user_id]
            
            # Delete existing assignments
            for assignment in assignments:
                assignment_id = assignment.get("id")
                delete_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo/{assignment_id}"
                delete_response = requests.delete(delete_url, headers={"Authorization": f"Bearer {self.access_token}"})
                delete_response.raise_for_status()
            
            # Get new role ID
            role_id = ROLE_IDS.get(new_role)
            if not role_id:
                raise ValueError(f"Invalid role: {new_role}")
            
            # Create a new app role assignment
            assignment_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo"
            assignment_data = {
                "principalId": user_id,
                "resourceId": service_principal_id,
                "appRoleId": role_id,
                "principalType": "User"
            }
            
            assignment_response = requests.post(
                assignment_url, 
                json=assignment_data, 
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                }
            )
            assignment_response.raise_for_status()
            
            # Get updated user info
            user_url = f"{self.base_url}/users/{user_id}"
            user_response = requests.get(user_url, headers={"Authorization": f"Bearer {self.access_token}"})
            user_response.raise_for_status()
            
            return {
                "id": user_id,
                "email": user_response.json().get("userPrincipalName"),
                "role": new_role,
                "success": True
            }
        except requests.RequestException as e:
            error_msg = f"Request error updating user role: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}, Response body: {e.response.text}")
                print(f"ERROR: Response status: {e.response.status_code}, Response body: {e.response.text}")
            raise ValueError(f"Failed to update user role: {str(e)}")
        except Exception as e:
            error_msg = f"Error updating user role: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise

    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        """
        Remove a user's access to the app by deleting their role assignments
        """
        if not self.access_token:
            await self.get_access_token()
            
        try:
            # Get the service principal ID for our app
            sp_url = f"{self.base_url}/servicePrincipals?$filter=appId eq '{self.app_id}'"
            sp_response = requests.get(sp_url, headers={"Authorization": f"Bearer {self.access_token}"})
            sp_response.raise_for_status()
            service_principal_id = sp_response.json().get("value")[0].get("id")
            
            # Get all role assignments and filter locally
            # Graph API doesn't reliably support all $filter operations on this endpoint
            assignments_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo"
            assignments_response = requests.get(assignments_url, headers={"Authorization": f"Bearer {self.access_token}"})
            assignments_response.raise_for_status()
            
            # Filter assignments for this user locally
            all_assignments = assignments_response.json().get("value", [])
            assignments = [a for a in all_assignments if a.get("principalId") == user_id]
            
            # Delete existing assignments
            for assignment in assignments:
                assignment_id = assignment.get("id")
                delete_url = f"{self.base_url}/servicePrincipals/{service_principal_id}/appRoleAssignedTo/{assignment_id}"
                delete_response = requests.delete(delete_url, headers={"Authorization": f"Bearer {self.access_token}"})
                delete_response.raise_for_status()
            
            return {
                "id": user_id,
                "success": True
            }
        except requests.RequestException as e:
            error_msg = f"Request error deleting user: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}, Response body: {e.response.text}")
                print(f"ERROR: Response status: {e.response.status_code}, Response body: {e.response.text}")
            raise ValueError(f"Failed to delete user: {str(e)}")
        except Exception as e:
            error_msg = f"Error deleting user: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise