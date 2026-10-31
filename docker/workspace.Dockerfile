FROM python:3.12.12-slim
WORKDIR /app
RUN pip install --no-cache-dir pyyaml==6.0.3
COPY workspace_service ./workspace_service
COPY examples/aster ./examples/aster
EXPOSE 9200
CMD ["python", "-m", "workspace_service.server", "--root", "/workspace", "--host", "0.0.0.0"]
