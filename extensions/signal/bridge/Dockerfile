FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    aiohttp>=3.9.0 \
    websockets>=12.0

# Copy bridge code
COPY requirements.txt .
COPY . .

# Run the bridge
CMD ["python3", "main.py"]
