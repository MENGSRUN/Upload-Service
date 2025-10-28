// ===== MinIO Service (src/services/minioService.js) =====
import { 
  S3Client, 
  PutObjectCommand, 
  ListObjectsV2Command, 
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuration - Use environment variables for better security
const BUCKET_NAME = import.meta.env.VITE_MINIO_BUCKET;
const MINIO_ENDPOINT = import.meta.env.VITE_MINIO_ENDPOINT;
const MINIO_REGION = import.meta.env.VITE_MINIO_REGION;
const ACCESS_KEY = import.meta.env.VITE_MINIO_ACCESS_KEY;
const SECRET_KEY = import.meta.env.VITE_MINIO_SECRET_KEY;

// Debug configuration
console.log('MinIO Configuration:', {
  BUCKET_NAME,
  MINIO_ENDPOINT,
  MINIO_REGION,
  ACCESS_KEY: ACCESS_KEY ? '***configured***' : 'missing',
  SECRET_KEY: SECRET_KEY ? '***configured***' : 'missing'
});

// Create S3 Client configured for MinIO
const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: MINIO_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY
  },
  forcePathStyle: true // Required for MinIO
});

export const minioService = {
  /**
   * Upload file to MinIO
   * @param {File} file - File object from input
   * @param {Object} options - Optional settings
   * @param {string} options.folder - Subfolder path (e.g., 'images/avatars')
   * @param {Function} options.onProgress - Progress callback (progress) => {}
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(file, options = {}) {
    try {
      const { folder = '', onProgress } = options;
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = folder 
        ? `${folder}/${timestamp}-${randomStr}-${sanitizedName}`
        : `${timestamp}-${randomStr}-${sanitizedName}`;
      
      // Read file as ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      
      // Prepare upload command
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: file.type,
        Metadata: {
          'original-name': file.name,
          'upload-date': new Date().toISOString()
        }
      });

      // Upload file
      await s3Client.send(command);

      // Simulate progress (AWS SDK doesn't provide real-time progress in browser)
      if (onProgress) {
        onProgress(100);
      }

      return {
        success: true,
        fileName: fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: `${MINIO_ENDPOINT}/${BUCKET_NAME}/${fileName}`
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message || 'Upload failed'
      };
    }
  },

  /**
   * Upload image specifically (with validation)
   * @param {File} file - Image file
   * @param {Object} options - Optional settings
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(file, options = {}) {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
      };
    }

    // Validate file size (max 10MB by default)
    const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`
      };
    }

    return this.uploadFile(file, { ...options, folder: options.folder || 'images' });
  },

  /**
   * List all files from bucket
   * @param {Object} options - Filter options
   * @param {string} options.prefix - Folder prefix to filter
   * @param {number} options.limit - Maximum number of files to return
   * @returns {Promise<Array>} List of files
   */
  async listFiles(options = {}) {
    try {
      const { prefix = '', limit = 1000 } = options;
      
      console.log('Listing files with options:', { prefix, limit });
      
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: limit
      });

      console.log('Sending ListObjectsV2Command to bucket:', BUCKET_NAME);
      const response = await s3Client.send(command);
      console.log('List response:', response);
      
      if (!response.Contents || response.Contents.length === 0) {
        console.log('No files found in bucket');
        return [];
      }

      const files = response.Contents.map(obj => ({
        name: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        url: `${MINIO_ENDPOINT}/${BUCKET_NAME}/${obj.Key}`,
        // Extract file extension
        extension: obj.Key.split('.').pop().toLowerCase()
      }));

      console.log('Found files:', files);
      return files;
    } catch (error) {
      console.error('List error:', error);
      return [];
    }
  },

  /**
   * List only images from bucket
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of image files
   */
  async listImages(options = {}) {
    const files = await this.listFiles(options);
    
    // Filter only image files
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    return files.filter(file => imageExtensions.includes(file.extension));
  },

  /**
   * Delete file from MinIO
   * @param {string} fileName - File key/path to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(fileName) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName
      });

      await s3Client.send(command);
      return { 
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      console.error('Delete error:', error);
      return { 
        success: false, 
        error: error.message || 'Delete failed'
      };
    }
  },

  /**
   * Delete multiple files
   * @param {Array<string>} fileNames - Array of file keys to delete
   * @returns {Promise<Object>} Delete results
   */
  async deleteMultipleFiles(fileNames) {
    try {
      const results = await Promise.all(
        fileNames.map(fileName => this.deleteFile(fileName))
      );
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      return {
        success: failed === 0,
        deleted: successful,
        failed: failed,
        results: results
      };
    } catch (error) {
      console.error('Batch delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Check if bucket exists and is accessible
   * @returns {Promise<boolean>} Bucket accessibility status
   */
  async checkConnection() {
    try {
      console.log('Checking connection to bucket:', BUCKET_NAME);
      const command = new HeadBucketCommand({
        Bucket: BUCKET_NAME
      });
      
      await s3Client.send(command);
      console.log('Connection successful!');
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  },

  /**
   * Get file metadata
   * @param {string} fileName - File key/path
   * @returns {Promise<Object>} File metadata
   */
  async getFileInfo(fileName) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName
      });
      
      const response = await s3Client.send(command);
      
      return {
        success: true,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata
      };
    } catch (error) {
      console.error('Get file info error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Generate public URL for a file
   * @param {string} fileName - File key/path
   * @returns {string} Public URL
   */
  getPublicUrl(fileName) {
    return `${MINIO_ENDPOINT}/${BUCKET_NAME}/${fileName}`;
  },

  /**
   * Generate signed URL for a file (for private access)
   * @param {string} fileName - File key/path
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(fileName, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName
      });
      
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return this.getPublicUrl(fileName); // Fallback to public URL
    }
  },

  /**
   * Search files by name pattern
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching files
   */
  async searchFiles(searchTerm, options = {}) {
    const files = await this.listFiles(options);
    
    const term = searchTerm.toLowerCase();
    return files.filter(file => 
      file.name.toLowerCase().includes(term)
    );
  },

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats
   */
  async getStorageStats() {
    try {
      const files = await this.listFiles();
      
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const totalFiles = files.length;
      
      // Group by file type
      const byType = files.reduce((acc, file) => {
        const ext = file.extension;
        if (!acc[ext]) {
          acc[ext] = { count: 0, size: 0 };
        }
        acc[ext].count++;
        acc[ext].size += file.size;
        return acc;
      }, {});
      
      return {
        success: true,
        totalFiles,
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        byType
      };
    } catch (error) {
      console.error('Stats error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Alias for backward compatibility
minioService.deleteImage = minioService.deleteFile;

export default minioService;