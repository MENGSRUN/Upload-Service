 <!-- ===== Vue 3 Component (src/components/MinioGallery.vue) ===== -->
<template>
  <div class="minio-gallery">
    <h1>MinIO Image Gallery</h1>

    <!-- Upload Section -->
    <div class="upload-section">
      <h2>Upload Image</h2>
      <input 
        type="file" 
        @change="handleFileSelect" 
        accept="image/*"
        ref="fileInput"
      />
      <button 
        @click="uploadImage" 
        :disabled="!selectedFile || uploading"
        class="btn-upload"
      >
        {{ uploading ? 'Uploading...' : 'Upload' }}
      </button>
      
      <!-- Preview -->
      <div v-if="previewUrl" class="preview">
        <h3>Preview:</h3>
        <img :src="previewUrl" alt="Preview" />
      </div>

      <!-- Upload Status -->
      <div v-if="uploadMessage" :class="['message', uploadStatus]">
        {{ uploadMessage }}
      </div>
    </div>

    <!-- Gallery Section -->
    <div class="gallery-section">
      <h2>Image Gallery</h2>
      <button @click="loadImages" class="btn-refresh">
        Refresh Gallery
      </button>

      <div v-if="loading" class="loading">Loading images...</div>

      <div v-if="images.length === 0 && !loading" class="empty">
        No images found. Upload your first image!
      </div>

      <div class="gallery-grid">
        <div v-for="image in images" :key="image.name" class="gallery-item">
          <img :src="image.url" :alt="image.name" />
          <div class="image-info">
            <p class="image-name">{{ image.name }}</p>
            <p class="image-size">{{ formatSize(image.size) }}</p>
            <p class="image-date">{{ formatDate(image.lastModified) }}</p>
            <button @click="deleteImage(image.name)" class="btn-delete">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { minioService } from '../services/minioService';

const selectedFile = ref(null);
const previewUrl = ref('');
const uploading = ref(false);
const uploadMessage = ref('');
const uploadStatus = ref('');
const images = ref([]);
const loading = ref(false);
const fileInput = ref(null);

// Handle file selection
const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
    uploadMessage.value = '';
  }
};

// Upload image
const uploadImage = async () => {
  if (!selectedFile.value) return;

  uploading.value = true;
  uploadMessage.value = '';

  const result = await minioService.uploadImage(selectedFile.value);

  if (result.success) {
    uploadMessage.value = 'Image uploaded successfully!';
    uploadStatus.value = 'success';
    selectedFile.value = null;
    previewUrl.value = '';
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    await loadImages();
  } else {
    uploadMessage.value = `Upload failed: ${result.error}`;
    uploadStatus.value = 'error';
  }

  uploading.value = false;
};

// Load images from MinIO
const loadImages = async () => {
  loading.value = true;
  images.value = await minioService.listImages();
  loading.value = false;
};

// Delete image
const deleteImage = async (fileName) => {
  if (confirm(`Are you sure you want to delete ${fileName}?`)) {
    const result = await minioService.deleteImage(fileName);
    if (result.success) {
      await loadImages();
    } else {
      alert(`Delete failed: ${result.error}`);
    }
  }
};

// Format file size
const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Format date
const formatDate = (date) => {
  return new Date(date).toLocaleString();
};

// Load images on mount
onMounted(() => {
  loadImages();
});
</script>

<style scoped>
.minio-gallery {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

h2 {
  color: #555;
  border-bottom: 2px solid #007bff;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.upload-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 40px;
}

input[type="file"] {
  margin-right: 10px;
  padding: 8px;
}

.btn-upload, .btn-refresh, .btn-delete {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.btn-upload {
  background-color: #007bff;
  color: white;
}

.btn-upload:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-upload:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-refresh {
  background-color: #28a745;
  color: white;
  margin-bottom: 20px;
}

.btn-refresh:hover {
  background-color: #218838;
}

.btn-delete {
  background-color: #dc3545;
  color: white;
  width: 100%;
  margin-top: 10px;
}

.btn-delete:hover {
  background-color: #c82333;
}

.preview {
  margin-top: 20px;
}

.preview img {
  max-width: 300px;
  max-height: 300px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 5px;
  font-weight: bold;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 18px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.gallery-item {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.3s;
}

.gallery-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.gallery-item img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.image-info {
  padding: 15px;
}

.image-name {
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-size, .image-date {
  font-size: 12px;
  color: #666;
  margin: 3px 0;
}
</style>
*/