FROM python:3.10.17
WORKDIR .
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api/demo .
CMD ["python3", "-m", "api.app"]