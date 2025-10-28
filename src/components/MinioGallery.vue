<template>
  <div class="minio-gallery">
    <h1>MinIO Image Gallery</h1>

    <!-- Connection Status -->
    <div v-if="connectionStatus !== null" :class="['connection-status', connectionStatus ? 'connected' : 'disconnected']">
      {{ connectionStatus ? '✓ Connected to MinIO' : '✗ Connection Failed' }}
    </div>

    <!-- Access Warning -->
    <div v-if="connectionStatus && images.length > 0" class="access-warning">
      ⚠️ <strong>If images show "Access Denied":</strong> The MinIO bucket needs public read access. 
      Contact your MinIO administrator to run: <code>mc anonymous set download myminio/upload-service</code>
    </div>

    <!-- Upload Section -->
    <div class="upload-section">
      <h2>Upload Images</h2>
      
      <!-- Drag & Drop Area -->
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragging }"
        @drop.prevent="handleDrop"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
      >
        <input 
          type="file" 
          @change="handleFileSelect" 
          accept="image/*"
          multiple
          ref="fileInput"
          id="file-input"
          style="display: none;"
        />
        <label for="file-input" class="drop-zone-label">
          <span class="upload-icon">📁</span>
          <p>Drag & drop images here or click to browse</p>
          <small>Supported: JPEG, PNG, GIF, WebP (Max 10MB each)</small>
        </label>
      </div>

      <!-- Selected Files Preview -->
      <div v-if="selectedFiles.length > 0" class="selected-files">
        <h3>Selected Files ({{ selectedFiles.length }})</h3>
        <div class="file-list">
          <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
            <img v-if="file.preview" :src="file.preview" alt="Preview" />
            <div class="file-info">
              <p class="file-name">{{ file.name }}</p>
              <p class="file-size">{{ formatSize(file.size) }}</p>
            </div>
            <button @click="removeSelectedFile(index)" class="btn-remove">×</button>
          </div>
        </div>
        
        <button 
          @click="uploadAllFiles" 
          :disabled="uploading"
          class="btn-upload"
        >
          {{ uploading ? `Uploading... ${uploadProgress}%` : `Upload ${selectedFiles.length} File(s)` }}
        </button>
      </div>

      <!-- Upload Messages -->
      <div v-if="uploadMessages.length > 0" class="messages">
        <div v-for="(msg, index) in uploadMessages" :key="index" :class="['message', msg.type]">
          {{ msg.text }}
        </div>
      </div>
    </div>

    <!-- Gallery Section -->
    <div class="gallery-section">
      <div class="gallery-header">
        <h2>Gallery ({{ images.length }} images)</h2>
        
        <!-- Search Bar -->
        <input 
          v-model="searchTerm" 
          type="text" 
          placeholder="Search images..."
          class="search-input"
        />
        
        <!-- Actions -->
        <div class="actions">
          <button @click="loadImages" class="btn-refresh" :disabled="loading">
            {{ loading ? 'Loading...' : '🔄 Refresh' }}
          </button>
          <button @click="showStats" class="btn-stats">
            📊 Stats
          </button>
          <button 
            v-if="selectedImages.length > 0" 
            @click="deleteSelected" 
            class="btn-delete-selected"
          >
            🗑️ Delete Selected ({{ selectedImages.length }})
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading">Loading images...</div>

      <!-- Empty State -->
      <div v-if="filteredImages.length === 0 && !loading" class="empty">
        {{ searchTerm ? 'No images match your search' : 'No images found. Upload your first image!' }}
      </div>

      <!-- Gallery Grid -->
      <div class="gallery-grid">
        <div 
          v-for="image in filteredImages" 
          :key="image.name" 
          class="gallery-item"
          :class="{ selected: selectedImages.includes(image.name) }"
        >
          <div class="image-wrapper">
            <input 
              type="checkbox" 
              :checked="selectedImages.includes(image.name)"
              @change="toggleImageSelection(image.name)"
              class="image-checkbox"
            />
            <img 
              :src="image.url" 
              :alt="image.name"
              @click="openLightbox(image)"
              @error="handleImageError"
              loading="lazy"
            />
          </div>
          <div class="image-info">
            <p class="image-name" :title="image.name">{{ image.name }}</p>
            <p class="image-size">{{ formatSize(image.size) }}</p>
            <p class="image-date">{{ formatDate(image.lastModified) }}</p>
            <div class="image-actions">
              <button @click="copyUrl(image.url)" class="btn-copy" title="Copy URL">
                📋
              </button>
              <button @click="deleteImage(image.name)" class="btn-delete">
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox Modal -->
    <div v-if="lightboxImage" class="lightbox" @click="closeLightbox">
      <div class="lightbox-content" @click.stop>
        <button class="lightbox-close" @click="closeLightbox">×</button>
        <img :src="lightboxImage.url" :alt="lightboxImage.name" />
        <div class="lightbox-info">
          <p>{{ lightboxImage.name }}</p>
          <p>{{ formatSize(lightboxImage.size) }} • {{ formatDate(lightboxImage.lastModified) }}</p>
        </div>
      </div>
    </div>

    <!-- Stats Modal -->
    <div v-if="showStatsModal" class="modal" @click="showStatsModal = false">
      <div class="modal-content" @click.stop>
        <h2>Storage Statistics</h2>
        <div v-if="stats" class="stats-content">
          <div class="stat-item">
            <span class="stat-label">Total Files:</span>
            <span class="stat-value">{{ stats.totalFiles }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Size:</span>
            <span class="stat-value">{{ stats.totalSizeMB }} MB</span>
          </div>
          <div v-if="stats.byType" class="stat-types">
            <h3>By Type:</h3>
            <div v-for="(data, type) in stats.byType" :key="type" class="type-item">
              <span>.{{ type }}</span>: {{ data.count }} files ({{ (data.size / 1024 / 1024).toFixed(2) }} MB)
            </div>
          </div>
        </div>
        <button @click="showStatsModal = false" class="btn-close">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import minioService from '../services/minioService';

// State
const selectedFiles = ref([]);
const fileInput = ref(null);
const isDragging = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadMessages = ref([]);
const images = ref([]);
const loading = ref(false);
const searchTerm = ref('');
const selectedImages = ref([]);
const lightboxImage = ref(null);
const connectionStatus = ref(null);
const showStatsModal = ref(false);
const stats = ref(null);

// Computed
const filteredImages = computed(() => {
  if (!searchTerm.value) return images.value;
  const term = searchTerm.value.toLowerCase();
  return images.value.filter(img => 
    img.name.toLowerCase().includes(term)
  );
});

// Handle file selection
const handleFileSelect = (event) => {
  const files = Array.from(event.target.files);
  addFiles(files);
};

// Handle drag & drop
const handleDrop = (event) => {
  isDragging.value = false;
  const files = Array.from(event.dataTransfer.files);
  addFiles(files);
};

// Add files to selection
const addFiles = (files) => {
  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      selectedFiles.value.push({
        file,
        name: file.name,
        size: file.size,
        preview: URL.createObjectURL(file)
      });
    }
  });
};

// Remove selected file
const removeSelectedFile = (index) => {
  URL.revokeObjectURL(selectedFiles.value[index].preview);
  selectedFiles.value.splice(index, 1);
};

// Upload all selected files
const uploadAllFiles = async () => {
  if (selectedFiles.value.length === 0) return;

  uploading.value = true;
  uploadMessages.value = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < selectedFiles.value.length; i++) {
    const fileData = selectedFiles.value[i];
    uploadProgress.value = Math.round(((i + 1) / selectedFiles.value.length) * 100);
    
    const result = await minioService.uploadImage(fileData.file);
    
    if (result.success) {
      successCount++;
      uploadMessages.value.push({
        type: 'success',
        text: `✓ ${fileData.name} uploaded successfully`
      });
    } else {
      failCount++;
      uploadMessages.value.push({
        type: 'error',
        text: `✗ ${fileData.name} failed: ${result.error}`
      });
    }
  }

  // Cleanup
  selectedFiles.value.forEach(f => URL.revokeObjectURL(f.preview));
  selectedFiles.value = [];
  uploading.value = false;
  uploadProgress.value = 0;
  
  if (fileInput.value) {
    fileInput.value.value = '';
  }

  // Show summary
  uploadMessages.value.push({
    type: 'info',
    text: `Upload complete: ${successCount} succeeded, ${failCount} failed`
  });

  // Refresh gallery
  await loadImages();

  // Clear messages after 5 seconds
  setTimeout(() => {
    uploadMessages.value = [];
  }, 5000);
};

// Load images from MinIO
const loadImages = async () => {
  console.log('Loading images from MinIO...');
  loading.value = true;
  images.value = await minioService.listImages();
  console.log('Loaded images:', images.value);
  loading.value = false;
};

// Delete single image
const deleteImage = async (fileName) => {
  if (!confirm(`Delete ${fileName}?`)) return;

  const result = await minioService.deleteFile(fileName);
  if (result.success) {
    await loadImages();
  } else {
    alert(`Delete failed: ${result.error}`);
  }
};

// Toggle image selection
const toggleImageSelection = (fileName) => {
  const index = selectedImages.value.indexOf(fileName);
  if (index > -1) {
    selectedImages.value.splice(index, 1);
  } else {
    selectedImages.value.push(fileName);
  }
};

// Delete selected images
const deleteSelected = async () => {
  if (!confirm(`Delete ${selectedImages.value.length} image(s)?`)) return;

  const result = await minioService.deleteMultipleFiles(selectedImages.value);
  
  if (result.success) {
    selectedImages.value = [];
    await loadImages();
  } else {
    alert(`Delete failed: ${result.failed} file(s) could not be deleted`);
  }
};

// Copy URL to clipboard
const copyUrl = async (url) => {
  try {
    await navigator.clipboard.writeText(url);
    alert('URL copied to clipboard!');
  } catch (err) {
    prompt('Copy this URL:', url);
  }
};

// Lightbox
const openLightbox = (image) => {
  lightboxImage.value = image;
};

const closeLightbox = () => {
  lightboxImage.value = null;
};

// Show statistics
const showStats = async () => {
  stats.value = await minioService.getStorageStats();
  showStatsModal.value = true;
};

// Check connection
const checkConnection = async () => {
  console.log('Checking MinIO connection...');
  connectionStatus.value = await minioService.checkConnection();
  console.log('Connection status:', connectionStatus.value);
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

// Handle image loading errors
const handleImageError = (event) => {
  console.error('Image failed to load:', event.target.src);
  event.target.style.border = '2px solid red';
  event.target.style.backgroundColor = '#ffe6e6';
  event.target.style.padding = '10px';
  event.target.alt = 'Access Denied - Image not accessible';
  
  // Replace with error message
  const errorDiv = document.createElement('div');
  errorDiv.innerHTML = `
    <div style="color: red; font-size: 12px; text-align: center; padding: 5px;">
      ❌ Access Denied<br>
      <small>Bucket policy needs admin fix</small>
    </div>
  `;
  event.target.parentNode.replaceChild(errorDiv, event.target);
};

// Lifecycle
onMounted(async () => {
  await checkConnection();
  await loadImages();
});
</script>

<style scoped>
.minio-gallery {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.minio-gallery h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
  font-size: 2.5rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
}

.connection-status {
  padding: 15px 25px;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 25px;
  font-weight: 600;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
}

.connected {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  color: #155724;
  border-left: 5px solid #28a745;
}

.disconnected {
  background: linear-gradient(135deg, #f8d7da 0%, #f1b0b7 100%);
  color: #721c24;
  border-left: 5px solid #dc3545;
}

.access-warning {
  padding: 15px 25px;
  border-radius: 8px;
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  color: #856404;
  border-left: 5px solid #ffc107;
  margin-bottom: 25px;
  font-size: 14px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.access-warning code {
  background: rgba(0,0,0,0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.upload-section, .gallery-section {
  background: white;
  border-radius: 15px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  transition: transform 0.3s ease;
}

.upload-section h2, .gallery-section h2 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.upload-section:hover, .gallery-section:hover {
  transform: translateY(-2px);
}

.drop-zone {
  border: 3px dashed #3498db;
  border-radius: 15px;
  padding: 50px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #fafafa 0%, #f0f8ff 100%);
  position: relative;
  overflow: hidden;
}

.drop-zone p {
  color: #2c3e50;
  font-size: 18px;
  font-weight: 500;
  margin: 10px 0;
}

.drop-zone small {
  color: #7f8c8d;
  font-size: 14px;
}

.drop-zone::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg, transparent, rgba(52, 152, 219, 0.1), transparent);
  transform: rotate(45deg);
  transition: all 0.3s ease;
  opacity: 0;
}

.drop-zone.drag-over {
  border-color: #2980b9;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  transform: scale(1.02);
}

.drop-zone.drag-over::before {
  opacity: 1;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
  100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
}

.upload-icon {
  font-size: 60px;
  display: block;
  margin-bottom: 15px;
  filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
}

.selected-files h3 {
  color: #2c3e50;
  margin-bottom: 15px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
  border-radius: 10px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
}

.file-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.file-item img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.file-info {
  flex-grow: 1;
}

.file-name {
  color: #2c3e50;
  font-weight: 600;
  margin: 0 0 5px 0;
}

.file-size {
  color: #7f8c8d;
  font-size: 14px;
  margin: 0;
}

.btn-remove {
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-remove:hover {
  background: #c0392b;
  transform: scale(1.1);
}

.btn-upload {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 25px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
  margin-top: 20px;
}

.btn-upload:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
}

.btn-upload:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  flex-wrap: wrap;
  gap: 15px;
}

.search-input {
  padding: 12px 20px;
  border: 2px solid #e9ecef;
  border-radius: 25px;
  font-size: 16px;
  min-width: 250px;
  transition: all 0.3s ease;
  color: #2c3e50;
}

.search-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.search-input::placeholder {
  color: #7f8c8d;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-refresh, .btn-stats, .btn-delete-selected {
  padding: 10px 20px;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-refresh {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  color: white;
  box-shadow: 0 3px 10px rgba(46, 204, 113, 0.3);
}

.btn-stats {
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
  color: white;
  box-shadow: 0 3px 10px rgba(243, 156, 18, 0.3);
}

.btn-delete-selected {
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
  color: white;
  box-shadow: 0 3px 10px rgba(231, 76, 60, 0.3);
}

.btn-refresh:hover, .btn-stats:hover, .btn-delete-selected:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
  margin-top: 25px;
}

.gallery-item {
  background: white;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
  position: relative;
}

.gallery-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(0,0,0,0.15);
}

.gallery-item.selected {
  outline: 3px solid #3498db;
  outline-offset: 2px;
}

.image-wrapper {
  position: relative;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.image-wrapper:hover img {
  transform: scale(1.05);
}

.image-checkbox {
  position: absolute;
  top: 15px;
  left: 15px;
  width: 20px;
  height: 20px;
  cursor: pointer;
  z-index: 10;
  accent-color: #3498db;
}

.image-info {
  padding: 20px;
}

.image-name {
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 16px;
}

.image-size, .image-date {
  font-size: 12px;
  color: #7f8c8d;
  margin: 4px 0;
}

.image-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.btn-copy, .btn-delete {
  padding: 8px 12px;
  border: none;
  border-radius: 15px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-copy {
  background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
  color: white;
}

.btn-delete {
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
  color: white;
}

.btn-copy:hover, .btn-delete:hover {
  transform: scale(1.05);
  filter: brightness(1.1);
}

.lightbox {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.lightbox-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  animation: lightboxOpen 0.3s ease;
}

.lightbox-content img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 10px;
}

.lightbox-info {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 0 0 10px 10px;
  text-align: center;
}

.lightbox-info p {
  margin: 5px 0;
  color: white;
}

@keyframes lightboxOpen {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.lightbox-close {
  position: absolute;
  top: -50px;
  right: 0;
  background: rgba(255, 255, 255, 0.9);
  color: #2c3e50;
  border: none;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.lightbox-close:hover {
  background: white;
  transform: scale(1.1);
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.modal-content {
  background: white;
  padding: 40px;
  border-radius: 20px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: modalOpen 0.3s ease;
  color: #2c3e50;
}

.modal-content h2 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.stats-content {
  color: #2c3e50;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
  padding: 10px 0;
  border-bottom: 1px solid #e9ecef;
}

.stat-label {
  color: #7f8c8d;
  font-weight: 500;
}

.stat-value {
  color: #2c3e50;
  font-weight: 600;
}

.type-item {
  margin: 8px 0;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 5px;
  color: #2c3e50;
}

.btn-close {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 20px;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s ease;
}

.btn-close:hover {
  background: #2980b9;
  transform: translateY(-2px);
}

@keyframes modalOpen {
  from { opacity: 0; transform: translateY(-50px); }
  to { opacity: 1; transform: translateY(0); }
}

.messages {
  margin-top: 20px;
}

.message {
  padding: 12px 20px;
  margin: 8px 0;
  border-radius: 8px;
  font-weight: 500;
}

.message.success {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  color: #155724;
  border-left: 4px solid #28a745;
}

.message.error {
  background: linear-gradient(135deg, #f8d7da 0%, #f1b0b7 100%);
  color: #721c24;
  border-left: 4px solid #dc3545;
}

.message.info {
  background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
  color: #0c5460;
  border-left: 4px solid #17a2b8;
}

.loading, .empty {
  text-align: center;
  padding: 60px 20px;
  color: #7f8c8d;
  font-size: 18px;
  font-style: italic;
}

@media (max-width: 768px) {
  .minio-gallery {
    padding: 15px;
  }
  
  .gallery-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input {
    min-width: auto;
    width: 100%;
  }
  
  .actions {
    justify-content: center;
  }
  
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
  }
}
</style>
