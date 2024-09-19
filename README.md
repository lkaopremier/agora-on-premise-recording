# Agora On-Premise Recording Node.js with Docker

This project is a custom implementation of the Agora On-Premise Recording solution using Node.js, packaged with Docker for easy deployment and management.

## Overview

This application provides a simple RESTful API server that allows you to start, monitor, and stop Agora recordings in audio mode with an easy-to-use interface. The recordings are saved locally and can be automatically uploaded to a cloud storage like Minio.

## Prerequisites

- **Ubuntu 18.04+** or **CentOS 7+** (64-bit)
- **GCC 4.4+**
- **Node.js 18.x**
- Public IP (for server hosting)
- Bandwidth of **1MB+ per simultaneous recording channel**
- Access to Agora services for data transfer

### Additional Requirements

- Minio or S3 compatible storage for cloud storage of recorded files.

## Features

- **Recording API**: Simple endpoints to start, monitor, and stop recordings.
- **Cloud Storage**: Option to store recorded files in Minio or any compatible S3 storage.
- **Dockerized Deployment**: Runs entirely inside Docker for simple deployment and scaling.

## Setup and Installation

### Clone the repository

```bash
git clone https://github.com/yourusername/agora-on-premise-recording.git
cd agora-on-premise-recording
```

## Build and Run the Docker Container

### Build the Docker image:

```bash
docker build -t agora-on-premise-recording .
```

### Run the Docker container

```bash
docker run -d \
  --name agora_recorder \
  --restart unless-stopped \
  -v $(pwd)/output:/usr/src/app/output \
  -p 4001-4030:4001-4030/udp \
  -p 1080:1080/udp \
  -p 8000:8000/udp \
  -p 25000:25000/udp \
  -p 4000:4000/udp \
  -p 41000:41000/udp \
  -p 9700:9700/udp \
  -p 1080:1080/tcp \
  -p 8000:8000/tcp \
  -p 3000:3000/tcp \
  lkaopremier/agora-on-premise-recording:v1.0
```

### Alternatively, use Docker Compose
Create a compose.yml file and define the services as follows:

```yaml
services:
  agora_recorder:
    image: lkaopremier/agora-on-premise-recording:v1.0
    restart: unless-stopped
    volumes:
      - ./output:/usr/src/app/output
    ports:
      - "4001-4030:4001-4030/udp"
      - "1080:1080/udp"
      - "8000:8000/udp"
      - "25000:25000/udp"
      - "4000:4000/udp"
      - "41000:41000/udp"
      - "9700:9700/udp"
      - "1080:1080/tcp"
      - "8000:8000/tcp"
      - "3000:3000"
```

Integrate the Agora Recording SDK
You need to download the Agora Recording SDK for Linux, unzip it, and make sure it is included in the container.

- Download the Agora Recording SDK: [Agora Recording SDK for Linux](https://www.agora.io/en/download/).
- The SDK is automatically downloaded and compiled in the Docker image (from the `Dockerfile`).

## Using the RESTful API

Once the server is running, you can interact with the API using the following endpoints.

### Start Recording

```
POST /recorder/v1/start
```

#### Request Parameters:

| Name            | Type   | Required | Description                                       |
|-----------------|--------|----------|---------------------------------------------------|
| `appid`         | string | Yes      | Your Agora App ID                                 |
| `channel`       | string | Yes      | The Agora channel to record                       |
| `storageConfig` | object | No       | Cloud storage configuration for Minio             |
| `callbackUrl`   | string | No       | Callback URL to notify when recording is finished |

#### Example Request:

```bash
curl -X POST http://localhost:3000/recorder/v1/start \
-H "Content-Type: application/json" \
-d '{
  "appid": "YOUR_APP_ID",
  "channel": "testChannel"
}'
```

#### Example Response:

```json
{
  "success": true,
  "sid": "unique-session-id"
}
```

#### Stop Recording

```
POST /recorder/v1/stop
```

#### Request Parameters:

| Name    | Type    | Required | Description                 |
|---------|---------|----------|-----------------------------|
| `sid`   | string  | Yes      | Session ID of the recording |

#### Example Request:

```bash
curl -X POST http://localhost:3000/recorder/v1/stop \
-H "Content-Type: application/json" \
-d '{
  "sid": "unique-session-id"
}'
```

#### Example Response:

```json
{
  "success": true
}
```

#### Check Recording Status

````
POST /recorder/v1/status
````

#### Request Parameters:

| Name    | Type    | Required | Description                 |
|---------|---------|----------|-----------------------------|
| `sid`   | string  | Yes      | Session ID of the recording |

#### Example Request:

```bash
curl -X POST http://localhost:3000/recorder/v1/status \
-H "Content-Type: application/json" \
-d '{
  "sid": "unique-session-id"
}'
```

#### Example Response:

```json
{
  "success": true,
  "status": "RUNNING" // or "STOPPED"
}
```

#### Clean Up a Recording

```
POST /recorder/v1/clean
```

#### Request Parameters:

| Name    | Type    | Required | Description                 |
|---------|---------|----------|-----------------------------|
| `sid`   | string  | Yes      | Session ID of the recording |

#### Example Request:

```bash
curl -X POST http://localhost:3000/recorder/v1/clean \
-H "Content-Type: application/json" \
-d '{
  "sid": "unique-session-id"
}'
```

#### Example Response:

```json
{
  "success": true
}
```

## Cloud Storage Configuration

To upload recordings to a cloud service such as Minio or S3, provide a storageConfig object in the request body when starting a recording.

```json
{
  "appid": "YOUR_APP_ID",
  "channel": "testChannel",
  "storageConfig": {
    "endPoint": "play.minio.io",
    "port": 9000,
    "useSSL": true,
    "accessKey": "YOUR_ACCESS_KEY",
    "secretKey": "YOUR_SECRET_KEY",
    "bucket": "my-recordings"
  }
}
````

## Logs and Output

Recordings and logs are saved to the ./output directory (mapped from Docker). This includes raw recordings and any status updates during the recording process.

## Additional Resources

For a basic implementation of Agora On-Premise Recording, you can refer to the official Agora repository: [Agora Basic Recording](https://github.com/AgoraIO/Basic-Recording).


## License

This software is licensed under the MIT License. See the `LICENSE` file for more details.