# Production Dockerfile for Z-TRACS FastAPI Backend on AWS EC2 / ECS
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostGIS, GIS libraries, and C compilers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gdal-bin \
    libgdal-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY app /app/app
COPY app/main.py /app/main.py

# Expose FastAPI port
EXPOSE 8000

# Run Gunicorn with Uvicorn workers for production scaling on AWS
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
