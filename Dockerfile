# Use official Python slim image (pip works perfectly here)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system deps (gcc needed for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download NLTK data at build time
RUN python -c "\
import nltk; \
nltk.download('stopwords', quiet=True); \
nltk.download('punkt', quiet=True); \
nltk.download('wordnet', quiet=True); \
nltk.download('punkt_tab', quiet=True); \
print('NLTK data downloaded successfully')"

# Copy all project files
COPY . .

# Make sure Python can find project modules
ENV PYTHONPATH=/app

# Railway injects PORT automatically
EXPOSE 8000

# Start Flask via gunicorn
CMD gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120
