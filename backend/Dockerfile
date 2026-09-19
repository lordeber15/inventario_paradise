# syntax=docker/dockerfile:1

# ---- Builder: installs system + Python deps into an isolated venv ----
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libzbar0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-dev.txt

# ---- Runtime: minimal image, no compilers, non-root user ----
FROM python:3.12-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        libzbar0 \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/appuser/.cache/huggingface

# Pre-create the CLIP weights cache dir owned by appuser: docker-compose mounts a
# named volume here, and Docker seeds a fresh named volume from whatever already
# exists at that path in the image (including ownership) — without this, the
# volume is created as an empty root-owned dir and the non-root runtime user
# can't write the downloaded model into it.
RUN mkdir -p /home/appuser/.cache/huggingface && chown -R appuser:appuser /home/appuser/.cache

WORKDIR /app
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8012

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8012/api/health || exit 1

# --forwarded-allow-ips='*': safe here because the backend is never reachable except
# through the bundled nginx (internal Docker network) or via 127.0.0.1 on the host
# (see docker-compose.yml's port binding) — both are within this app's own trust
# boundary. Without it, uvicorn ignores X-Forwarded-For from anyone but 127.0.0.1,
# so every request proxied by nginx looks like it comes from nginx's own container
# IP, collapsing slowapi's per-client rate limits (login, scan, public listing)
# into one shared bucket for every real user.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --forwarded-allow-ips='*'"]
