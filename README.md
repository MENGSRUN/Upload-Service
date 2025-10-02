# Upload-Service

A simple Vue 3 service for testing image uploads and retrieving image lists. Supports AWS S3 and MinIO backends.

## Features

- Upload images to S3-compatible storage (MinIO, also support AWS S3)
- View and retrieve uploaded image lists
- Modern Vue 3 + Vite stack

## Prerequisites

- **Node.js**: ^20.19.0 or >=22.12.0
- **Minio**: seflhosting Minio docker container

## Getting Started

Install dependencies:

```sh
npm install
```

### Development

Start the development server with hot reload:

```sh
npm run dev
```

### Production

Build the project for production:

```sh
npm run build
```
