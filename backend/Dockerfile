# TODO: Add test stage to CI pipeline once tests are written
FROM cgr.dev/chainguard/python:latest-dev AS builder

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/dependencies -r requirements.txt

FROM cgr.dev/chainguard/python:latest

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/dependencies

COPY --from=builder /app/dependencies /app/dependencies
COPY . .

EXPOSE 8000
ENTRYPOINT ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
