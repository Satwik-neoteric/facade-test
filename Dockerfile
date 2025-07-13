# Dockerfile for FastAPI Facade Studio
FROM python:3.11-slim
 
WORKDIR /app
 
# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
 
 
# Copy the .env file into the container
COPY .env .env
 
# Copy application code
COPY app/ ./app/
COPY static/ ./static/
COPY templates/ ./templates/
COPY config/ ./config/
# COPY certs/ ./certs/
 
# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
 

# Set default environment to production
# ENV DEBUG=False
ENV PORT=8000

# Expose the application port
EXPOSE 8000

# Command to run the application
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
ENTRYPOINT ["uvicorn", "app.main:app", "--proxy-headers", "--forwarded-allow-ips=*", "--host", "0.0.0.0"]