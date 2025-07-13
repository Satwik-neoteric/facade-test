# Facade Studio - ASP.NET Core Version

Facade Studio is a web-based annotation tool for facade images, using the COCO format for storing annotations. This is the ASP.NET Core version of the original Python-based application.

## Features

- **Image Annotation**: View and annotate facade images
- **Dashboard**: View statistics and analytics about annotation progress
- **Admin Interface**: Manage users and assign roles
- **Azure AD Integration**: Secure authentication with role-based access control
- **COCO Format**: Compatible with the original annotation format

## Architecture

The application consists of:

- ASP.NET Core backend (API and Razor Pages)
- JavaScript frontend with fabric.js for canvas manipulation
- Azure Blob Storage for image and annotation storage
- Azure Cosmos DB for metadata and user data
- Azure AD for authentication and authorization

## Prerequisites

- .NET 8.0 SDK or newer
- Docker (for containerized deployment)
- Azure subscription with:
  - Azure Active Directory tenant
  - Azure Blob Storage account
  - Azure Cosmos DB account
  - Azure Container Apps (for deployment)

## Configuration

The application can be configured through `appsettings.json` or environment variables:

### Azure AD Settings

```json
"AzureAd": {
  "Instance": "https://login.microsoftonline.com/",
  "Domain": "yourdomain.com",
  "TenantId": "your-tenant-id",
  "ClientId": "your-client-id",
  "CallbackPath": "/signin-oidc",
  "SignedOutCallbackPath": "/signout-callback-oidc",
  "Groups": {
    "Administrator": "admin-group-id",
    "Labeller": "labeller-group-id",
    "Reviewer": "reviewer-group-id"
  }
}
```

### Azure Storage Settings

```json
"AzureStorage": {
  "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=yourstorageaccount;AccountKey=yourstoragekey;EndpointSuffix=core.windows.net",
  "InputContainer": "input",
  "AnnotationsContainer": "annotations", 
  "DeleteContainer": "delete"
}
```

### Cosmos DB Settings

```json
"CosmosDb": {
  "ConnectionString": "AccountEndpoint=https://yourcosmosaccount.documents.azure.com:443/;AccountKey=yourcosmoskey;",
  "DatabaseId": "FacadeStudio",
  "ContainerId": "Annotations"
}
```

## Deployment Options

### Local Development

1. Clone this repository
2. Update the `appsettings.json` file with your Azure credentials
3. Run the application:
   ```
   dotnet run
   ```

### Docker

1. Build the Docker image:
   ```
   docker build -t facade-studio .
   ```

2. Run the container:
   ```
   docker run -p 8080:80 -e "AzureAd__TenantId=your-tenant-id" -e "AzureAd__ClientId=your-client-id" facade-studio
   ```

### Docker Compose

1. Update the `docker-compose.yml` file with your Azure credentials
2. Run with Docker Compose:
   ```
   docker-compose up
   ```

### Azure Container Apps

1. Create an Azure Container Registry and push your image:
   ```
   az acr build --registry yourregistry --image facade-studio:latest .
   ```

2. Deploy to Azure Container Apps:
   ```
   az containerapp create \
     --name facade-studio \
     --resource-group your-resource-group \
     --image yourregistry.azurecr.io/facade-studio:latest \
     --environment your-container-apps-environment \
     --registry-server yourregistry.azurecr.io \
     --registry-username your-username \
     --registry-password your-password \
     --target-port 80 \
     --ingress external \
     --query properties.configuration.ingress.fqdn
   ```

## Deployment Instructions for Azure Container Apps

### Prerequisites
- Azure CLI installed and logged in.
- An Azure subscription with permissions to create resources.
- Docker installed for building container images.

### Steps
1. **Build the Docker Image**:
   ```bash
   docker build -t facade-studio .
   ```

2. **Push the Image to Azure Container Registry (ACR)**:
   ```bash
   az acr login --name <your-acr-name>
   docker tag facade-studio <your-acr-name>.azurecr.io/facade-studio:latest
   docker push <your-acr-name>.azurecr.io/facade-studio:latest
   ```

3. **Deploy to Azure Container Apps**:
   ```bash
   az containerapp create \
     --name facade-studio \
     --resource-group <your-resource-group> \
     --image <your-acr-name>.azurecr.io/facade-studio:latest \
     --environment <your-container-app-environment> \
     --cpu 0.5 --memory 1.0Gi \
     --ingress external --target-port 80 \
     --env-vars "ASPNETCORE_ENVIRONMENT=Production"
   ```

4. **Verify Deployment**:
   - Navigate to the URL provided by Azure Container Apps.
   - Ensure the application is running and accessible.

## User Roles

The application supports three roles:

- **Administrator**: Full access to the application, including user management
- **Labeller**: Can create and edit annotations
- **Reviewer**: Can review, approve, or reject annotations

## Migration Notes

This ASP.NET Core version maintains compatibility with the original Python Flask application:

- Existing COCO annotations can be used without modification
- The JavaScript frontend is largely unchanged
- Authentication is enhanced with Azure AD integration
- New dashboard and admin pages have been added

## License

[MIT License](LICENSE)