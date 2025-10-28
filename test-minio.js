// Test MinIO signed URLs
import { 
  S3Client, 
  ListObjectsV2Command,
  GetObjectCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fetch from 'node-fetch';
import fs from 'fs';

// Load environment variables from .env file
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    envVars[key.trim()] = value.trim();
  }
});

const BUCKET_NAME = envVars.VITE_MINIO_BUCKET;
const MINIO_ENDPOINT = envVars.VITE_MINIO_ENDPOINT;
const MINIO_REGION = envVars.VITE_MINIO_REGION;
const ACCESS_KEY = envVars.VITE_MINIO_ACCESS_KEY;
const SECRET_KEY = envVars.VITE_MINIO_SECRET_KEY;

console.log('Configuration:', {
  BUCKET_NAME,
  MINIO_ENDPOINT,
  MINIO_REGION,
  ACCESS_KEY: ACCESS_KEY ? '***configured***' : 'missing',
  SECRET_KEY: SECRET_KEY ? '***configured***' : 'missing'
});

console.log(`\n🔍 Testing bucket-specific credentials for bucket: ${BUCKET_NAME}`);

const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: MINIO_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY
  },
  forcePathStyle: true
});

async function testMinIOAccess() {
  console.log('\nTesting MinIO access with bucket-specific credentials...');
  
  try {
    // Test listing all objects in the bucket (not just images folder)
    console.log('1. Testing bucket access and listing contents...');
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 10
    });
    const response = await s3Client.send(listCommand);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log(`✅ SUCCESS: Found ${response.Contents.length} objects in '${BUCKET_NAME}' bucket`);
      
      // Show first few objects
      response.Contents.slice(0, 3).forEach((obj, index) => {
        console.log(`   ${index + 1}. ${obj.Key} (${(obj.Size / 1024).toFixed(1)} KB)`);
      });
      
      const firstObject = response.Contents[0];
      console.log(`\n2. Testing direct URL access for: ${firstObject.Key}`);
      
      // Test direct URL (should work if bucket has public read access)
      const directUrl = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${firstObject.Key}`;
      console.log(`   Direct URL: ${directUrl}`);
      
      try {
        const urlResponse = await fetch(directUrl, { method: 'HEAD' });
        if (urlResponse.ok) {
          console.log(`✅ SUCCESS: Direct URL accessible (${urlResponse.status})`);
          console.log('🎉 Your bucket has public read access - images should work!');
        } else {
          console.log(`❌ Direct URL blocked (${urlResponse.status})`);
          console.log('⚠️  Bucket needs public read policy for images to display');
          
          // Test signed URL as fallback
          console.log('\n3. Testing signed URL generation...');
          const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: firstObject.Key
          });
          
          const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
          console.log('✅ Signed URL generated successfully');
          console.log('   URL preview:', signedUrl.substring(0, 100) + '...');
          
          const signedResponse = await fetch(signedUrl, { method: 'HEAD' });
          if (signedResponse.ok) {
            console.log('✅ Signed URL works - images can be accessed with authentication');
          } else {
            console.log('❌ Even signed URLs are blocked');
          }
        }
      } catch (fetchError) {
        console.log('❌ URL fetch failed:', fetchError.message);
      }
      
    } else {
      console.log(`⚠️  No objects found in '${BUCKET_NAME}' bucket (or bucket is empty)`);
      console.log('   You may need to upload some test images first');
    }
    
  } catch (error) {
    console.error('❌ Error accessing bucket:', error.message);
    if (error.$metadata) {
      console.error('   Error details:', error.$metadata.httpStatusCode, error.name);
    }
    
    if (error.name === 'NoSuchBucket') {
      console.log(`   The bucket '${BUCKET_NAME}' does not exist`);
    } else if (error.name === 'AccessDenied') {
      console.log(`   These credentials don't have access to bucket '${BUCKET_NAME}'`);
    }
  }
}

testMinIOAccess();