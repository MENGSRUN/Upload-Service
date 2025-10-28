# 🚨 URGENT: MinIO Bucket Access Fix Required

## Problem
You're getting `AccessDenied` errors when trying to view images because the MinIO bucket doesn't allow public read access.

## SOLUTION 1: MinIO Console (Web Interface) - RECOMMENDED

### Step 1: Access MinIO Console
1. Open your browser and go to: **http://192.168.1.210:9001** 
   (Note: This is usually port 9001 for console, not 9003)
2. If that doesn't work, try: **http://192.168.1.210:9000**
3. Login with admin credentials (not the app credentials)

### Step 2: Fix Bucket Policy
1. Go to **Buckets** in the left sidebar
2. Click on **upload-service** bucket
3. Click on **Manage** → **Access Rules** (or **Anonymous**)
4. Set policy to **Public** or **Read Only**
5. Click **Save**

### Step 3: Alternative - Set Custom Policy
If you can't find "Access Rules", try:
1. Go to **Buckets** → **upload-service**
2. Click **Browse** 
3. Look for **Bucket Policy** or **Access Policy** button
4. Paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::upload-service/*"
    }
  ]
}
```

## SOLUTION 2: Command Line (Requires Admin Access)

If you have admin credentials, ask your admin to run:

```bash
# Replace with actual admin credentials
mc alias set admin http://192.168.1.210:9003 [ADMIN_ACCESS_KEY] [ADMIN_SECRET_KEY]
mc anonymous set download admin/upload-service
```

## SOLUTION 3: Quick Test Commands

To verify the fix works, test these URLs in your browser:

**Before fix (should show XML error):**
http://192.168.1.210:9003/upload-service/1759907604196-Screenshot from 2025-09-04 12-14-01.png

**After fix (should show the image):**
Same URL should display the image directly

## SOLUTION 4: Alternative Admin Methods

### Using MinIO Admin API:
```bash
# If you have admin access
mc admin policy set myminio public-read-policy /path/to/policy.json
mc admin policy attach myminio public-read-policy --user=upload-service
```

### Using Docker/Environment:
If MinIO is running in Docker, you might need to restart with public access:
```bash
docker exec -it [minio_container] mc anonymous set download local/upload-service
```

## Verification Steps

1. **Test direct image access:**
   ```bash
   curl -I "http://192.168.1.210:9003/upload-service/1759907604196-Screenshot from 2025-09-04 12-14-01.png"
   ```
   Should return `HTTP/1.1 200 OK` instead of `403 Forbidden`

2. **Test in browser:**
   Open the image URL directly - should show the image

3. **Test your app:**
   - Run `npm run dev`
   - Images should now load properly instead of showing "Access Denied"

## Current Status

- ✅ Application code is working correctly
- ✅ Connection to MinIO is successful  
- ✅ Files exist in the bucket
- ❌ **BLOCKER:** Bucket policy denies public read access
- ❌ Current credentials lack admin privileges

## Who Can Fix This?

You need someone with:
- MinIO admin credentials
- Access to MinIO Console web interface
- Server admin access to modify MinIO configuration

## Temporary Workaround

If you can't get admin access immediately:
1. Ask admin to create a new bucket with public access
2. Update your `.env` file to use the new bucket name
3. Re-upload your images to the new bucket

---

**The application is ready and working - it just needs the MinIO server configured properly for public read access!**