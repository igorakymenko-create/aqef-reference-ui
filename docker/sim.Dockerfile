FROM python:3.12.12-slim
WORKDIR /app
COPY sim ./sim
ENV PYTHONUNBUFFERED=1
EXPOSE 9100
CMD ["python", "-m", "sim.server", "--host", "0.0.0.0"]
