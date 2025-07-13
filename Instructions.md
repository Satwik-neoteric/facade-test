# Facade Studio Azure Setup Instructions

This document provides detailed instructions for setting up the required Azure resources and configuring Azure AD authentication for the Facade Studio application.

## Azure Resources Setup

### Prerequisites

- An Azure subscription
- Azure CLI installed and logged in (`az login`)
- Sufficient permissions to create resources in your subscription

### 1. Create Resource Group

```bash
az group create --name rg-facade-studio --location eastus
```

### 2. Azure Cosmos DB Setup

```bash
# Create Cosmos DB account
az cosmosdb create --name facade-studio-cosmos --resource-group rg-facade-studio --locations regionName=eastus --default-consistency-level Session

# Get the connection string
az cosmosdb keys list --name facade-studio-cosmos --resource-group rg-facade-studio --type connection-strings

# Create database
az cosmosdb sql database create --account-name facade-studio-cosmos --resource-group rg-facade-studio --name InputImages

# Create container
az cosmosdb sql container create --account-name facade-studio-cosmos --resource-group rg-facade-studio --database-name InputImages --name batches --partition-key-path "/id"
```

### 3. Azure Storage Setup

```bash
# Create storage account
az storage account create --name facadestudiostorage --resource-group rg-facade-studio --location eastus --sku Standard_LRS --kind StorageV2

# Get the connection string
az storage account show-connection-string --name facadestudiostorage --resource-group rg-facade-studio

# Create containers
az storage container create --name input --account-name facadestudiostorage --auth-mode key
az storage container create --name annotations --account-name facadestudiostorage --auth-mode key
az storage container create --name delete --account-name facadestudiostorage --auth-mode key
```

## Azure Active Directory Setup

### 1. Register an Application

1. Sign in to the [Azure Portal](https://portal.azure.com/).
2. Navigate to Azure Active Directory → App registrations → New registration.
3. Enter a name for the application (e.g., "Facade Studio").
4. Select the supported account types (Single tenant is recommended for internal apps).
5. For the Redirect URI, select "Web" and enter your application's redirect URL (e.g., `https://your-app-url/auth/callback` for production or `http://localhost:8000/auth/callback` for local development).
6. Click "Register".

### 2. Configure Application Authentication

1. In your registered app, go to "Authentication".
2. Under "Implicit grant and hybrid flows", check "ID tokens" and "Access tokens".
3. Under "Advanced settings", set "Allow public client flows" to "Yes" if you need to support mobile or desktop apps.
4. Add any additional redirect URIs as needed.
5. Click "Save".

### 3. Create App Roles

1. Go to "App roles" → "Create app role".
2. Add the following roles:

   - **Administrator**:
     - Display name: Administrator
     - Allowed member types: Users/Groups
     - Value: Administrator
     - Description: Full access to all features including user management

   - **Labeller**:
     - Display name: Labeller
     - Allowed member types: Users/Groups
     - Value: Labeller
     - Description: Can view and annotate images

   - **Reviewer**:
     - Display name: Reviewer
     - Allowed member types: Users/Groups
     - Value: Reviewer
     - Description: Can review and approve/reject annotations

3. Click "Apply" for each role.

### 4. Add API Permissions

1. Go to "API permissions" → "Add a permission".
2. Select "Microsoft Graph" → "Delegated permissions".
3. Add the following permissions:
   - `User.Read` (to read user profile)
   - `Directory.Read.All` (to read directory data if admin features are needed)
4. Click "Add permissions".
5. For admin features, also add "Application permissions" → `User.ReadWrite.All`.
6. Click "Grant admin consent" if you have the necessary permissions.

### 5. Create a Client Secret

1. Go to "Certificates & secrets" → "New client secret".
2. Add a description and select an expiry period.
3. Click "Add".
4. **Important**: Copy the secret value immediately and store it securely. You won't be able to see it again.

### 6. Assign Users to Roles

1. Go to Azure Active Directory → Enterprise applications.
2. Find and select your application.
3. Go to "Users and groups" → "Add user/group".
4. Select the users or groups you want to assign to a role.
5. Select the role from the list.
6. Click "Assign".

## Application Configuration

### Environment Variables

After setting up the Azure resources, update your `.env` file or environment variables with the following values:

```
# Azure AD Configuration
AZURE_AD_TENANT_ID=your_tenant_id
AZURE_AD_CLIENT_ID=your_application_id
AZURE_AD_CLIENT_SECRET=your_client_secret

# Cosmos DB Configuration
COSMOS_ENDPOINT=https://facade-studio-cosmos.documents.azure.com:443/
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE=InputImages
COSMOS_CONTAINER=batches

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=your_storage_connection_string
AZURE_INPUT_CONTAINER=input
AZURE_ANNOTATIONS_CONTAINER=annotations
AZURE_DELETE_CONTAINER=delete
```

### Azure Container Apps Deployment

1. Build and push the Docker image to Azure Container Registry:

```bash
# Create Azure Container Registry
az acr create --name facadestudioacr --resource-group rg-facade-studio --sku Basic

# Log in to ACR
az acr login --name facadestudioacr

# Build and push the image
docker build -t facadestudioacr.azurecr.io/facade-studio:latest .
docker push facadestudioacr.azurecr.io/facade-studio:latest
```

2. Create Azure Container Apps environment:

```bash
az containerapp env create \
  --name facade-studio-env \
  --resource-group rg-facade-studio \
  --location eastus
```

3. Deploy the application:

```bash
az containerapp create \
  --name facade-studio \
  --resource-group rg-facade-studio \
  --environment facade-studio-env \
  --image facadestudioacr.azurecr.io/facade-studio:latest \
  --registry-server facadestudioacr.azurecr.io \
  --target-port 8000 \
  --ingress external \
  --query properties.configuration.ingress.fqdn \
  --env-vars \
    AZURE_AD_TENANT_ID=your_tenant_id \
    AZURE_AD_CLIENT_ID=your_application_id \
    AZURE_AD_CLIENT_SECRET=your_client_secret \
    COSMOS_ENDPOINT=your_cosmos_endpoint \
    COSMOS_KEY=your_cosmos_key \
    AZURE_STORAGE_CONNECTION_STRING=your_storage_connection_string \
    DEBUG=False
```

4. Get the application URL:

```bash
az containerapp show \
  --name facade-studio \
  --resource-group rg-facade-studio \
  --query properties.configuration.ingress.fqdn
```

5. Update your Azure AD app registration with the new URL for authentication callbacks.

## Monitoring and Logs

To monitor your application:

```bash
# View container logs
az containerapp logs show \
  --name facade-studio \
  --resource-group rg-facade-studio \
  --follow

# View container metrics
az monitor metrics list \
  --resource facade-studio \
  --resource-group rg-facade-studio \
  --resource-type "Microsoft.App/containerApps" \
  --metric "Requests"
```

## Troubleshooting

If you encounter authentication issues:

1. Check that the redirect URI in your app registration matches the actual URI of your deployed application.
2. Verify that the required API permissions are granted.
3. Ensure the application roles are correctly set up and users are assigned to them.
4. Check your application logs for detailed error messages.
5. Verify that all environment variables are correctly set on your deployment.
