import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const testFile = 'test_raw_upload.pdf';
if (!fs.existsSync(testFile)) {
    fs.writeFileSync(testFile, '%PDF-1.4\n1 0 obj\n<< /Title (Test Raw) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
}

async function test() {
    console.log("Uploading test file as 'raw'...");
    try {
        const response = await cloudinary.uploader.upload(testFile, {
            resource_type: "raw",
            folder: "debug_test_raw",
            use_filename: true,
            unique_filename: false
        });
        console.log("✅ Upload Success!");
        console.log("URL:", response.secure_url);
        console.log("Resource Type:", response.resource_type);

        // Cleanup
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    } catch (err) {
        console.error("❌ Upload Failed:", err);
    }
}

test();
