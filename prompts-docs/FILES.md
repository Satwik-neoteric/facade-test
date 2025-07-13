# Project File Structure and Purpose (FastAPI Version)

This document outlines the purpose of the key files and directories in the FacadeAI Studio FastAPI project.

## Root Directory

-   **`.dockerignore`**: Specifies files and directories that should be ignored by Docker when building an image. This helps in creating smaller and more secure Docker images by excluding build artifacts, local configurations, or version control folders.
-   **`.env`**: (Typically gitignored) Stores environment-specific configuration variables and secrets (e.g., API keys, database URLs). The application reads these at runtime.
-   **`.env.sample`**: A template file for `.env`. It lists the required environment variables without their actual values, serving as a guide for setting up the environment.
-   **`.gitignore`**: Specifies intentionally untracked files that Git should ignore (e.g., `venv/`, `__pycache__/`, `.env`, IDE-specific files).
-   **`app.py`**: This file's role needs clarification based on your project's evolution. It might be:
    *   An old Flask application entry point (from the original Python project mentioned in your instructions).
    *   The primary script to run the FastAPI application using `uvicorn` (though `run.py` or direct `uvicorn` commands via `app/main.py` are also common patterns).
    *   The main file being actively developed for the FastAPI application.
-   **`Azure-Resources.txt`**: An informational text file, likely listing Azure resources associated with this project. Its maintenance and relevance should be reviewed.
-   **`azure.yaml`**: Configuration file for the Azure Developer CLI (`azd`). It defines the application's services, their language, host, and how they map to Azure resources, enabling streamlined provisioning and deployment.
-   **`build-and-push-acr.cmd`**: A Windows batch script to automate building the Docker image (using `Dockerfile`) and pushing it to an Azure Container Registry (ACR).
-   **`build-test.bat`**: A Windows batch script, likely for building the project and running tests. Its exact commands and relevance to the current FastAPI setup should be verified.
-   **`deploy-container-app.cmd`**: A Windows batch script to deploy the containerized application to Azure Container Apps.
-   **`Dockerfile`**: Contains instructions to build a Docker image for the FastAPI application. It specifies the base image, copies application code, installs dependencies, and defines the command to run the application.
-   **`functions.md`**: A Markdown file, presumably documenting functions within the application or system.
-   **`Instructions.md`**: A Markdown file containing general instructions for the project setup, development, or deployment.
-   **`README.md`**: The main informational file for the project, providing an overview, setup instructions, and project structure.
-   **`requirements.txt`**: Lists all Python package dependencies required by the project. Used by `pip install -r requirements.txt` to set up the environment.
-   **`run-debug.bat`**: A Windows batch script to run the application in debug mode. For FastAPI, this might involve setting `uvicorn` to reload on code changes.
-   **`run-http-only.bat`**: A Windows batch script to run the application using HTTP only, possibly for local development environments where HTTPS is not configured.
-   **`run-local.bat`**: A Windows batch script to start the FastAPI application locally, typically using `uvicorn`.
-   **`run.py`**: A Python script likely used to launch the FastAPI application (e.g., `import uvicorn; uvicorn.run("app.main:app", ...)` or `uvicorn.run("app:app", ...)` if `app.py` is the entry point). This provides a Python-based way to start the server.
-   **`setup.bat`**: A Windows batch script for initial project setup. This usually includes creating a Python virtual environment and installing dependencies from `requirements.txt`.
-   **`Tickets.md`**: A Markdown file used for tracking development tasks, issues, or feature requests (tickets).
-   **`Upgrade.md`**: (As per user instructions) A Markdown file detailing the requirements and steps for upgrading or transitioning the project.

## Directories

-   **`-p/`**: The purpose of this directory is unclear from the listing. It should be investigated.
-   **`.azure/`**: Created and used by the Azure Developer CLI (`azd`). It typically stores environment configurations, including details about provisioned Azure resources for different `azd` environments.
-   **`.github/`**: Contains files related to GitHub integration, such as:
    -   `/workflows/`: GitHub Actions workflow files for CI/CD, automated testing, etc.
-   **`Annotations/`**: A directory intended for storing or processing image annotation data.
    -   `B1/`: An example subdirectory, possibly representing a batch of images or a specific annotation set.
-   **`app/`**: The core directory for the FastAPI application source code.
    -   **`__init__.py`**: Makes the `app` directory a Python package.
    -   **`main.py`**: Often the main entry point for the FastAPI application if a modular structure is used. It initializes the `FastAPI` instance, includes routers from `app/api/`, configures middleware, and may define global exception handlers or startup/shutdown events.
    -   **`__pycache__/`**: (Typically gitignored) Contains Python bytecode files (`.pyc`) automatically generated by the interpreter.
    -   **`api/`**: Contains API route definitions. Typically, files in this directory (e.g., `batches.py`, `users.py`) define `APIRouter` instances for different resource types or functionalities, which are then included in `app/main.py`.
    -   **`core/`**: Holds core application logic, such as:
        -   `config.py`: For loading and managing application settings (e.g., from environment variables).
        -   Security configurations, global dependencies.
    -   **`models/`**: Defines Pydantic models used for data validation, serialization (request/response bodies), and potentially ORM models if a database is used with an Object-Relational Mapper.
    -   **`services/`**: Contains the business logic of the application. Service modules interact with data sources (databases, external APIs) and perform operations requested by the API endpoints.
    -   **`utils/`**: Contains utility functions and helper modules that are used across different parts of the application.
    -   `README.md`, `Tickets.md`, `Upgrade.md`: Potentially older versions of the root files.
    -   `saved/`: A subdirectory for saved items.
-   **`docker-build/`**: The purpose of this directory is unclear. It might contain context or helper scripts for the Docker build process.
-   **`docs/`**: Contains project documentation.
    -   `instructions.md`: Specific instructions, possibly a more detailed version or a subset of the main `Instructions.md` or `README.md`.
-   **`infra/`**: Contains Infrastructure as Code (IaC) files for provisioning Azure resources.
    -   `main.bicep`: The main Bicep template defining the Azure resources (e.g., App Service, Cosmos DB, Storage Account).
    -   `main.parameters.json`: A JSON file providing default parameter values for the `main.bicep` template.
-   **`original_old/`**: (Archival) Contains the original Python/Flask project files (`facade-studio/`) that serve as a reference for HTML, CSS, JS, and some Python logic. This directory is intended to be ignored by the current FastAPI project.
-   **`screenshots/`**: Contains screenshots of the application, useful for documentation or demos.
-   **`static/`**: Contains static files that are served directly to the client's browser.
    -   `css_test.html`, `direct_test.html`: HTML files for testing CSS or direct access, likely candidates for removal or archival.
    -   `css/`: Contains CSS stylesheets for the application.
    -   `images/`: Contains static images used in the application's UI.
    -   `js/`: Contains JavaScript files for client-side logic and interactivity.
-   **`templates/`**: Contains HTML templates, typically used with a templating engine like Jinja2, for server-side rendering of web pages by FastAPI.
    -   `admin.html`, `base.html`, `dashboard.html`, `index.html`, `label.html`: Core HTML templates for the application's views.
    -   `css_test.html`: An HTML file for testing CSS within templates, likely a candidate for removal or archival.
    -   `original_index.html`, `original_label.html`: HTML templates from the original project, possibly for reference or yet to be fully integrated/replaced. Candidates for archival if superseded.
-   **`venv/`**: (Typically gitignored) The Python virtual environment directory for this project, containing the Python interpreter and installed packages specific to this project.
-   **`working/`**: A directory designated for temporary files, work-in-progress, or files to be archived before potential deletion (this script will create it).

