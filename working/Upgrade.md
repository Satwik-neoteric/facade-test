Proposed technical Plan

Facade Studio Conversion Plan: ASP.NET to FastAPI
After reviewing the project structure and requirements in Upgrade.md, I'll outline a comprehensive plan to convert the ASP.NET Core application back to Python using FastAPI while maintaining and enhancing functionality.

1. Project Setup and Scaffolding
Create FastAPI Project Structure

Set Up Dependencies

FastAPI, Uvicorn, python-dotenv, azure-cosmos, azure-identity, python-multipart
Dashboard: Chart.js (client-side)
Authentication: msal-python, fastapi-azure-auth
2. Core Backend Conversion
Configuration Module

Create config.py to load settings from environment variables/.env file
Include CosmosDB connection, Azure AD settings, debugging options
Database Connection Layer

Implement CosmosDB client for the InputImages/batches container
Create data access services to handle CRUD operations
API Endpoint Migration

Analyze current ASP.NET endpoints and convert to FastAPI routes
Implement Pydantic models for request/response validation
Organize endpoints by function (images, annotations, batches, etc.)
File Handling

Convert file upload/download functionality to FastAPI
3. Authentication & Authorization
Azure AD Integration

Set up Azure AD authentication with MSAL Python
Implement JWT validation middleware
Create permission decorators for role-based access (Administrator, Labeller, Reviewer)
Session Management

Implement session handling for authenticated users
4. Dashboard Implementation
Data Aggregation Services

Create services to aggregate data from CosmosDB for dashboard metrics
Implement filtering by batch ID
Dashboard API Endpoints

Create endpoints to serve dashboard data
Dashboard UI

Implement frontend with Chart.js for visualization
Create dynamic, responsive dashboard layout
5. Admin Page Implementation
User Management Service

Create service to manage users and roles in Azure AD
Admin API Endpoints

Implement endpoints for user management
Admin UI

Create administrative interface for user/role management
6. Deployment Configuration
Local Development Setup

Create setup.bat for Windows development environment
Configure dotenv for local configuration
Docker Configuration

Create optimized Dockerfile for production
Configure environment variable handling
Azure Deployment

Create deployment scripts for Azure Container Apps
Set up CI/CD workflow
7. Documentation
Project Documentation

Create README.md with setup and usage instructions
Write functions.md documenting all modules and functions
Create Instructions.md for Azure AD setup
Code Documentation

Add comprehensive docstrings to all functions
Include debug information options
8. Testing
Unit Tests

Create tests for core functionality
Integration Tests

Test API endpoints and authentication flow
End-to-End Tests

Verify complete user journeys
Timeline and Implementation Order
Phase 1: Core Functionality (Week 1)

Project setup, configuration, database layer
Convert basic API endpoints
Phase 2: Authentication (Week 2)

Implement Azure AD authentication
Set up role-based permissions
Phase 3: New Features (Week 3)

Dashboard implementation
Admin page development
Phase 4: Deployment & Documentation (Week 4)

Finalize Docker configuration
Complete documentation
Deploy to Azure Container Apps


------------------------------------






Convert the app from a .net asp core 8 or 9 application to a python fastapi app

Keep the UI look and feel, use javascript library, HTML

In addition I will need a dashboard page and an administrator page. And users if they have permission should be able to navigate between pages.
The application should use azure active directory/app registration. There should be groups of users administrators, Labeller and reviewers. The administrator should have access to all the pages. On the administrative page the admins should be able to add users and assign groups which should update Active Directory

On the dashboard the user should be able to see a range of charts relating to the labels. The dashboard should show # of images per batch. They should be able to compare the # labelled and unlabelled images and the breakdown of labels into counts of classes/no labels. They should also be able see the review statistics broken in accepted rejected. Finally the dashboard should compare the labellers and reviewers statistics. The user should also be able the filter the graphs by batchid, by a dropdown at the top. The dashboard should show should be dynamic, professional and visually appealing. 
Use the minimal number of charts to convey this information Use your creativity.

The code will need to run locally on windows but also be deployed on a Linux based docker container on azure container apps serverless. The configuration should be obtained from environment variables and locally .env files. It will continue to use cosmosdb for persistence, we can create new tables/containers. Please create all the setup/configuration scripts and instructions for local and azure deployment.

Guidelines: 
- There is a directory called orginal\facade-studio that contains allot of python code that can be used for help as code samples, however it may be a little out of date. The ASP is the most up to date and should be seen as the source of truth
- The current JS and App.py work well, be careful not to break, however we will need to add the menus and multi-pages.
- Write the code as modular as possible, I need the code to maintained by AI. It will be easy if implemented as modules
- There should a debug option that creates detailed debug information for AI to debug, however this should be switched off by default 
- do not update the utils/ files, leave them as python
- update setup.bat
- Updates 

Documentation
- Write a readme.md which covers the functionality of the project and how to configure and run the application and how to run debug
- Write functions.md which is documentation summarising each function by program. 
- Give me instructions on how I can set up AD to support the application and any other azure backend tasks I need to complete in Instructions.md
- Update Docs as needed, replacing with the new functionality

Clarifications from AI.

Existing User Roles: The current app has "Admin" and "Reviewer" roles. In the upgrade, you mention "administrators", "Labeller", and "reviewers". Will these replace the existing roles, or should we maintain backward compatibility?

Answer: Roles should be Administrator, Labeller, Reviewer, 

CosmosDB Structure: You mention we can create new tables/containers. Should we migrate the existing data to a new schema, or maintain compatibility with the existing database while adding new tables for the new features?

Answer: There is only one current container. The Schema is InputImages/Batches and the Items contain the coco files as records. Preserve the InputImages, however it is ok to create new databases and containers as required.

Deployment Strategy: For the upgrade path, would you prefer a gradual migration approach where both applications can run side-by-side, or a complete replacement?
Answer:  I think, Go for complete replacement as it should be faster. Consider writing in a way where we may need to further iterate to complete.

Authentication: The upgrade specifies Azure AD integration. Is this entirely new, or is there an existing authentication system that we need to maintain compatibility with?
Answer: Entirely new. We do have An Azure Subcription whihc is hosting the cosmosdb and Storage and does have accounts assigned to Azure subscription.

Python Utilities: You specified not to update the utils/ files and leave them as Python. How should these Python utilities be integrated with the .NET application? Through process invocation or would you prefer we create API endpoints for them?
Answer : These will be run seperately by administrators by the command lije


Charts & Analytics: For the dashboard charts, do you have any preferences for the charting library to use (e.g., Chart.js, Highcharts, D3.js)? Also, is there any existing reporting logic I should be aware of or will I need to create new queries against the CosmosDB data?
Answer: Please choose what is most appropriate for the task, please choose open source licences.
Only the record structure See below:

{
    "BatchID": "B1",
    "ImageID": "cam1_1742899193",
    "annotations": [],
    "categories": [],
    "images": [
        {
            "file_name": "B1/cam/cam1_1742899193.jpg",
            "height": 2160,
            "id": 1,
            "width": 3840
        }
    ],
    "info": {
        "date_created": "2025-04-01T22:43:18.705151",
        "description": "Facade Studio annotations"
    },
    "admin_metadata": {
        "Validation_User": "",
        "Validation_Date": "",
        "Validation_Action": "",
        "Notes": ""
    },
    "Sensor": {
        "Timestamp (UTC)": "2025-03-25 10:39:46",
        "Fix Type": 3,
        "Fix Status": "Fix Acquired",
        "Latitude (deg)": 51.504644,
        "Longitude (deg)": -0.0249946,
        "Altitude (meters)": 81.162,
        "Altitude Above Sea Level (meters)": 35.68,
        "Number of Satellites": 5,
        "Ground Speed (m/s)": 0.849,
        "Heading (degrees)": 0.0025767754,
        "Horizontal Accuracy (m)": 94.141,
        "Vertical Accuracy (m)": 115.599
    },
    "id": "cam1_1742899193",
    "_rid": "g6oQAL5mNKoOAAAAAAAAAA==",
    "_self": "dbs/g6oQAA==/colls/g6oQAL5mNKo=/docs/g6oQAL5mNKoOAAAAAAAAAA==/",
    "_etag": "\"0100b952-0000-1100-0000-67ec6c060000\"",
    "_attachments": "attachments/",
    "_ts": 1743547398
}

Azure AD Configuration: Are there any specific Azure AD configurations I should be aware of? For example, do you already have an App Registration set up, or should I provide instructions for creating one from scratch?
Answer: No applications reg set up. Feel free to provide instructions or CLI/YAML code.

UI Framework: For the new pages (dashboard, admin), do you have a preference for the UI approach? Options could include:
Answer: I have no preference. Use what you feel is the most appropriate and maintainable. Looka t the current index.html to see which is most compatible

Docker Configuration: Do you have any specific requirements for the Docker configuration, like exposed ports, environment variables, or volume mounts?
Answer:  It will need environment varibles to be supplied by azure app containers. The persistance is done by cosmosdb and direct access to azure blob storage, it doesnt not need mounts. Only open ports needed for the application.

IMPORTANT!!: If you have any concerns or further questions, clarifications, please ask before writing or editing any files !

