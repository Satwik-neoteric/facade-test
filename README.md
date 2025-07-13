# FacadeAI Studio (FastAPI Version)

This project is a web application for annotating images, with a focus on building facades. It is built using Python and the FastAPI framework.

## Project Structure

The project is organized as follows:

-   **/app/**: Contains the core FastAPI application.
    -   **`__init__.py`**: Initializes the `app` directory as a Python package.
    -   **`main.py`**: The main entry point for the FastAPI application, defining global configurations, middleware, and including routers.
    -   **/api/**: Contains API endpoint definitions (routers). Each file typically groups related endpoints (e.g., `batches.py`, `annotations.py`).
    -   **/core/**: Likely for core logic, such as configuration loading (`config.py`) or security settings.
    -   **/models/**: Defines Pydantic models for request/response data validation and serialization, and potentially database models if an ORM is used.
    -   **/services/**: Houses business logic and interactions with databases or external services (e.g., `cosmos_service.py`, `blob_storage_service.py`).
    -   **/utils/**: Utility functions and helper modules.
-   **`app.py`**: (Potentially an old Flask entry point or a script related to the current FastAPI app - to be reviewed. If it's the main FastAPI runner, it might be redundant if `app/main.py` serves this purpose with uvicorn).
-   **`run.py`**: (Likely a script to run the FastAPI application using Uvicorn, possibly for development).
-   **/static/**: Contains static assets like CSS, JavaScript, and images served directly by the web server.
    -   **/css/**: Stylesheets for the application.
    -   **/js/**: JavaScript files for client-side interactivity.
    -   **/images/**: Static images used in the UI.
-   **/templates/**: HTML templates, likely used with Jinja2 templating engine for server-side rendering of pages.
-   **`Dockerfile`**: Instructions for building a Docker image of the application, enabling containerized deployment.
-   **`requirements.txt`**: Lists Python package dependencies for the project.
-   **`.env` / `.env.sample`**: Environment variable files. `.env` (if present and gitignored) stores actual secrets and configurations, while `.env.sample` serves as a template.
-   **`azure.yaml`**: Configuration file for Azure Developer CLI (AZD), defining services and infrastructure.
-   **/infra/**: Contains Infrastructure as Code (IaC) files, likely Bicep (`main.bicep`, `main.parameters.json`), for provisioning Azure resources.
-   **`run-local.bat`**: Batch script to run the application locally.
-   **`setup.bat`**: Batch script for initial project setup (e.g., creating a virtual environment, installing dependencies).
-   **/Annotations/**: (Example directory) Likely used for storing or processing annotation data, possibly image batches.
-   **/docs/**: Project documentation.
-   **`Tickets.md`**: Tracks development tickets or tasks.
-   **`Upgrade.md`**: (As per instructions) Contains requirements for upgrading the project.

## Getting Started

1.  **Setup**: Run `setup.bat` to create a virtual environment and install dependencies from `requirements.txt`.
2.  **Configuration**: Create a `.env` file based on `.env.sample` and populate it with necessary configurations (e.g., database connection strings, API keys).
3.  **Run Locally**: Execute `run-local.bat` to start the FastAPI development server.
4.  **Access Application**: Open your browser and navigate to the local address provided by Uvicorn (typically `http://127.0.0.1:8000`).

## Deployment

The application is designed to be deployed to Azure, potentially using Azure Container Apps or Azure App Service.
-   The `Dockerfile` is used to containerize the application.
-   The `azure.yaml` and files in the `/infra/` directory are used by the Azure Developer CLI (`azd`) for provisioning resources and deploying the application.
-   Scripts like `build-and-push-acr.cmd` and `deploy-container-app.cmd` suggest manual or alternative deployment steps.

## Project Setup

### Prerequisites

-   **Python 3.8+**: Ensure you have Python installed. It's recommended to use the latest Python 3 version.
-   **Pip**: Python's package installer, should be included with your Python installation.
-   **Git**: For version control and managing the code repository.

### Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd facade-studio
    ```

2.  **Set up Python Virtual Environment:**

    It is highly recommended to use a virtual environment to manage project dependencies.

    *   Create a virtual environment (e.g., named `.venv`):
        ```bash
        python -m venv .venv
        ```

    *   Activate the virtual environment:
        *   On Windows (cmd.exe):
            ```bash
            .venv\\Scripts\\activate
            ```
        *   On Windows (PowerShell):
            ```powershell
            .venv\\Scripts\\Activate.ps1
            ```
        *   On macOS/Linux (bash/zsh):
            ```bash
            source .venv/bin/activate
            ```
        Your command prompt should now be prefixed with `(.venv)`.

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Environment Variables:**

    Copy the example environment file and adjust the settings as needed:

    ```bash
    cp .env.sample .env
    ```

    Edit the `.env` file to set up your local development environment variables.

5.  **Run the Application:**
    ```bash
    uvicorn app.main:app --reload
    ```
    Access the application at `http://127.0.0.1:8000`.

6.  **Database Setup:**

    If the project uses a database, ensure it's running and accessible. Update the database configuration in the `.env` file if necessary.

    For example, for a local PostgreSQL setup, you might have:
    ```env
    DATABASE_URL=postgresql://user:password@localhost/dbname
    ```

    Create the database and run any migrations as per the project documentation.

7.  **Testing:**

    To run the tests, use the following command:

    ```bash
    pytest
    ```
    Ensure all tests pass before making any changes or additions to the code.

8.  **Code Formatting and Linting:**

    Consistent code style is important. This project uses `black` for formatting and `flake8` for linting.

    To format the code, run:

    ```bash
    black .
    ```

    To check for linting issues, run:

    ```bash
    flake8 .
    ```

    Fix any issues reported by these tools.

9.  **Debugging:**

    For debugging, you can use the built-in capabilities of your code editor or IDE. Ensure to run the application in debug mode and set breakpoints as needed.

    For example, in VSCode, you can add a configuration in `launch.json` to run and debug the FastAPI app.

10. **API Documentation:**

    FastAPI automatically generates API documentation. Access it at `http://127.0.0.1:8000/docs` for Swagger UI, or `http://127.0.0.1:8000/redoc` for ReDoc.

    Ensure all endpoints are working as expected and document any changes made to the API.

11. **Static Files and Templates:**

    If the project uses static files or templates, ensure they are correctly placed in the `/static/` and `/templates/` directories respectively.

    Update any references to these files in the code to match their new locations if they are moved.

12. **Docker Development Setup (Optional):**

    If you prefer using Docker for development, ensure Docker is installed and running.

    Build and run the container:

    ```bash
    docker-compose up --build
    ```

    Access the application at `http://localhost:8000`.

    Note: Adjust any volume mappings in `docker-compose.yml` as necessary to match your local setup.

---

*This README focuses on the FastAPI Python project. ASP.NET Core and C# related code has been moved to the `/asp/` directory for archival purposes and is not part of the active FastAPI application.*