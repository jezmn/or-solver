FROM node:20-slim AS css-builder
WORKDIR /app
COPY package.json package-lock.json tailwind.config.js input.css ./
COPY frontend ./frontend
RUN npm ci && npm run css

FROM python:3.12-slim
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY --from=css-builder /app/frontend ./frontend
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
