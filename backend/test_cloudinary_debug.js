
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

const testFile = 'test_debug.pdf';
// Create a dummy pdf content if it doesn't exist
if (!fs.existsSync(testFile)) {
    fs.writeFileSync(testFile, '%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
}

async function test() {
    console.log("Uploading test file...");
    try {
        const response = await cloudinary.uploader.upload(testFile, {
            resource_type: "auto",
            folder: "debug_test",
            use_filename: true,
            unique_filename: false
        });
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
