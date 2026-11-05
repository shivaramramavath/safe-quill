FROM python:3.11-slim

WORKDIR /app

COPY apps/ml/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ml .

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

