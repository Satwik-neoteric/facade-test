# app/api/routes/auth_router.py
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates # Assuming this is needed for error rendering
from msal import ConfidentialClientApplication
from app.core.config import settings  # Import settings
from app.core.auth import create_internal_access_token # Import the internal JWT creator
from urllib.parse import urlencode

# # Get base directory
# BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# templates_dir = os.path.join(BASE_DIR, "templates")

# # Set up Jinja2 templates using the templates directory
# templates = Jinja2Templates(directory=templates_dir)

templates = Jinja2Templates(directory="templates")

router = APIRouter(prefix="/api/auth", tags=["auth"])
 
CLIENT_ID = settings.AZURE_AD_CLIENT_ID
CLIENT_SECRET = settings.AZURE_AD_CLIENT_SECRET
AUTHORITY = settings.AZURE_AD_AUTHORITY
REDIRECT_URI = settings.AZURE_REDIRECT_URI
SCOPE = settings.AZURE_AD_SCOPE.split()
 
def build_msal_app():
    return ConfidentialClientApplication(
        client_id=CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET,
    )
 
@router.get("/login")
async def login():
    msal_app = build_msal_app()
    auth_url = msal_app.get_authorization_request_url(
        scopes=SCOPE,
        redirect_uri=REDIRECT_URI,
        response_mode="query"
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
async def callback(request: Request):
    code = request.query_params.get("code")
    if not code:

        # Redirect to intro with an error if no code is present
        return templates.TemplateResponse(
            "intro.html",
            {"request": request, "error": "Authentication failed: No authorization code received."}
        )

    msal_app = build_msal_app()
    try:
        result = msal_app.acquire_token_by_authorization_code(
            code,
            scopes=SCOPE,
            redirect_uri=REDIRECT_URI
        )
    except Exception as e:
        # Catch MSAL specific errors during token acquisition
        print(f"MSAL token acquisition failed: {e}")
        return templates.TemplateResponse(
            "intro.html",
            {"request": request, "error": f"Authentication failed during token acquisition: {e}"}
        )

    if "id_token_claims" not in result:
        # This means token acquisition failed or id_token was not returned
        error_description = result.get("error_description", "Unknown authentication error.")
        print(f"Authentication failed, no id_token_claims: {error_description}")
        return templates.TemplateResponse(
            "intro.html",
            {"request": request, "error": f"Authentication failed: {error_description}"}
        )

    user_claims = result["id_token_claims"]
    # print("User information from ID Token claims:")
    # print(user_claims)

    # Extract relevant user info for your internal session
    # It's best to store a unique identifier (like 'sub' or 'oid' if available)
    # and display name/email. Avoid storing sensitive data directly in the token if possible.
    user_data_for_internal_token = {
        "sub": user_claims.get("sub", user_claims.get("oid")), # 'sub' is standard, 'oid' is Azure AD object ID
        "email": user_claims.get("email") or user_claims.get("preferred_username"),
        "name": user_claims.get("name"),
        "roles": user_claims.get("roles", []) # Store roles if you need them for authorization
    }
    
    # Create the secure internal access token
    internal_access_token = create_internal_access_token(user_data_for_internal_token)

    # Redirect to home and set the secure cookie
    response = RedirectResponse(url="/home", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="app_access_token",
        value=internal_access_token,
        httponly=True,  # IMPORTANT: Prevents client-side JS access
        samesite="lax", # Recommended for CSRF protection
        secure=True if request.url.scheme == "https" else False, # Use secure cookie in HTTPS
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60 # Set cookie expiry
    )
    return response


@router.get("/logout")
async def logout(response: Response):
    """
    Logs out the user from the application by deleting the internal session cookie.
    Optionally redirects to Azure AD's logout endpoint for a full SSO logout.
    """
    logout_url = (
        f"{AUTHORITY}/oauth2/v2.0/logout?"
        f"post_logout_redirect_uri={REDIRECT_URI.replace('/api/auth/callback', '/intro')}"
        # Adjust post_logout_redirect_uri to your actual intro page after logout
    )
    # Clear the internal session cookie
    response = RedirectResponse(logout_url, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(key="app_access_token")
    
    return response
 