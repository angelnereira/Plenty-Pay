/**
 * Cloudinary configuration helper.
 * DEPRECATED: Cloudinary is no longer used in this project.
 * Keeping the structure to avoid breaking imports, but with all values null.
 */

export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
  apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || "",
  apiSecret: process.env.CLOUDINARY_API_SECRET || "",
}

export function isCloudinaryConfigured(): boolean {
  // Always return false to disable Cloudinary features across the app
  return false
}
