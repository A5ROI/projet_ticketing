FROM python:3.11-slim
 
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
&& rm -rf /var/lib/apt/lists/*
 
WORKDIR /projet_ticketing
COPY . /projet_ticketing
RUN pip install -r requirements.txt
EXPOSE 5000
CMD ["python", "main.py"]