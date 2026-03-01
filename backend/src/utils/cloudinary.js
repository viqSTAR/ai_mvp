import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a local file to Cloudinary and returns a publicly accessible URL
 * @param {string} localFilePath 
 * @param {string} folder optional folder name 
 * @param {string} resourceType 'auto', 'image', 'video', or 'raw'
 * @returns {Promise<string>}
 */
export const uploadToCloudinary = async (localFilePath, folder = "ai_mvp", resourceType = "auto") => {
    try {
        if (!localFilePath) return null;

        // Upload the file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: resourceType,
            folder: folder,
            use_filename: true,    // Required for raw files to retain their .pdf/.docx extensions
            unique_filename: false // We already generate a unique timestamped filename in generation.service.js
        });

        console.log("☁️ Cloudinary Upload Success:", {
            public_id: response.public_id,
            resource_type: response.resource_type,
            format: response.format,
            secure_url: response.secure_url
        });

        // Note: Cloudinary raw resources may return 401 on some accounts.
        // Documents (PDF/DOCX/PPTX) are served from the backend directly.
        // Only images use Cloudinary (they work fine as "auto" resource type).

        // Return public URL
        return response.secure_url;
    } catch (error) {
        console.error("Cloudinary upload failed:", error);
        return null;
    } finally {
        // Optionally delete the local file after uploading to save space
        if (fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (e) {
                console.error("Failed to delete local file:", e);
            }
        }
    }
};

export default cloudinary;

