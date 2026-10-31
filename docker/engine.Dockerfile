FROM python:3.12.12-slim
WORKDIR /app
COPY vendor/engine/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY vendor/engine/engine ./engine
COPY config ./config
COPY scripts ./scripts
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "scripts/run_engine.py"]
