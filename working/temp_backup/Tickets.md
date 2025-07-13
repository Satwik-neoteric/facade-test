# Incremental Implementation Tickets for Facade Studio Upgrade

## Ticket 1: Convert `app.py` to ASP.NET Core Labelling Page
**Description**: Convert the functionality of the original `app.py` into an ASP.NET Core labelling page. Ensure compatibility with the existing static web content.
- [ ] Implement endpoints for image retrieval, annotation saving, and deletion.
- [ ] Use Razor Pages for the labelling interface.
- [ ] Ensure configurations are read from environment variables or `.env`.

**Test**: 
- Manual Test:
  1. Deploy the application locally using `run-http-only.bat`.
  2. Navigate to the labelling page.
  3. Verify that images can be retrieved, annotations can be saved, and deleted.
  4. Confirm that configurations are correctly loaded from `.env` or environment variables.

## Ticket 2: Implement Dashboard Page
**Description**: Create a dashboard page with dynamic charts for statistics.
- [ ] Display charts for images per batch, labeled/unlabeled images, label breakdown, review statistics, and user comparisons.
- [ ] Add a dropdown filter for `BatchID`.
- [ ] Use Chart.js or a similar library for visualization.

**Test**: 
- Manual Test:
  1. Deploy the application locally using `run-http-only.bat`.
  2. Navigate to the dashboard page.
  3. Verify that all charts are displayed correctly and dynamically update based on the data.
  4. Test the `BatchID` dropdown filter to ensure it filters the data correctly.

## Ticket 3: Implement Administrator Page
**Description**: Develop an admin page for user and system management.
- [ ] Add functionality to create, edit, and delete users.
- [ ] Integrate with Azure Active Directory for role management.
- [ ] Display system status (e.g., Azure Storage and Cosmos DB connection).

**Test**: 
- Manual Test:
  1. Deploy the application locally using `run-http-only.bat`.
  2. Navigate to the admin page.
  3. Verify that users can be created, edited, and deleted.
  4. Confirm Azure Active Directory integration by testing role-based access.
  5. Check the system status display for accurate information about Azure Storage and Cosmos DB connections.

## Ticket 4: Azure AD Integration
**Description**: Set up Azure Active Directory for authentication and role-based access control.
- [ ] Configure roles: Administrator, Labeller, Reviewer.
- [ ] Ensure role-based navigation and access control.
- [ ] Provide instructions for setting up Azure AD.

## Ticket 5: Cosmos DB Integration
**Description**: Ensure the application uses Cosmos DB for persistence.
- [ ] Use the `InputImages` database and `batches` container.
- [ ] Implement CRUD operations for annotations and batch data.
- [ ] Test with example records provided in `Upgrade.md`.

## Ticket 6: Local and Cloud Deployment
**Description**: Configure the application for local and cloud deployment.
- [ ] Use HTTP locally and HTTPS on the cloud.
- [ ] Create Dockerfile and `docker-compose.yml` for containerization.
- [ ] Provide deployment instructions for Azure Container Apps.

## Ticket 7: Update Documentation
**Description**: Update project documentation to reflect new functionality.
- [ ] Expand `README.md` with configuration and deployment instructions.
- [ ] Write `functions.md` summarizing each function.
- [ ] Update `instructions.md` with Azure AD setup and troubleshooting steps.

## Ticket 8: Debugging and Testing
**Description**: Add debugging options and test the application.
- [ ] Implement a debug mode for detailed logs.
- [ ] Write unit and integration tests for all features.
- [ ] Ensure compatibility with both Windows and Linux environments.

---

These tickets should be implemented sequentially, with thorough testing at each step to ensure compliance with the requirements in `Upgrade.md`. Each ticket builds upon the previous ones to incrementally complete the project.
