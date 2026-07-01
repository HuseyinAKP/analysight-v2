FROM python:3.11-slim

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Önce torch CPU-only kur (2GB GPU versiyonu değil, ~200MB)
RUN pip install --no-cache-dir \
    torch==2.2.2+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Geri kalan bağımlılıklar
COPY requirements_nodeps.txt .
RUN pip install --no-cache-dir -r requirements_nodeps.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
