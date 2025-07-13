@echo off
REM Build and push Docker image to Azure Container Registry using az CLI

REM Set variables - update these as needed
set ACR_NAME=facadeai-ehgjdkdeg4e9bvbx.azurecr.io
set IMAGE_NAME=facade-studio-asp
set IMAGE_TAG=latest
set AZURE_SUBSCRIPTION=74c2eee8-58c0-477e-ad3a-acfc56fe3ad6

REM Log in to Azure
rem az login
call az account set --subscription %AZURE_SUBSCRIPTION%

REM Log in to Azure Container Registry
call az acr login --name %ACR_NAME%

REM Build the Docker image
call az acr build --registry %ACR_NAME% --image %IMAGE_NAME%:%IMAGE_TAG% .

REM Output the image reference for use in deployment
set IMAGE_FULL=%ACR_NAME%/%IMAGE_NAME%:%IMAGE_TAG%
echo Docker image built and pushed: %IMAGE_FULL%
