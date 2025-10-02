// Install required package:
// npm install @aws-sdk/client-s3

// ===== MinIO Service (src/services/minioService.js) =====
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const BUCKET_NAME = 'my-bucket';
const MINIO_ENDPOINT = 'http://localhost:9003';
const MINIO_REGION = 'us-east-1'; // Can be any value for MinIO

// Create S3 Client configured for MinIO
const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: MINIO_REGION,
  credentials: {
    accessKeyId: 'Admin',
    secretAccessKey: 'Admin!@34'
  },
  forcePathStyle: true // Required for MinIO
});

export const minioService = {
  // Upload image to MinIO
  async uploadImage(file) {
    try {
      const fileName = `${Date.now()}-${file.name}`;
      
      // Read file as ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: file.type,
        // Optional: Make object publicly accessible
        ACL: 'public-read'
      });

      await s3Client.send(command);

      return {
        success: true,
        fileName: fileName,
        url: `${MINIO_ENDPOINT}/${BUCKET_NAME}/${fileName}`
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // List all images from MinIO
  async listImages() {
    try {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME
      });

      const response = await s3Client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      // Filter only image files
      const images = response.Contents
        .filter(obj => obj.Key.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map(obj => ({
          name: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          url: `${MINIO_ENDPOINT}/${BUCKET_NAME}/${obj.Key}`
        }));

      return images;
    } catch (error) {
      console.error('List error:', error);
      return [];
    }
  },

  // Delete image from MinIO
  async deleteImage(fileName) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName
      });

      await s3Client.send(command);
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }
  }
};