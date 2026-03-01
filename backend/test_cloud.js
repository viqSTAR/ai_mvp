import { uploadToCloudinary } from "./src/utils/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testUpload = async () => {
    try {
        const testFile = path.join(__dirname, "test_image.txt");
        fs.writeFileSync(testFile, "Hello Cloudinary!");

        console.log("Uploading test file to Cloudinary...");
        const url = await uploadToCloudinary(testFile, "test_upload_folder");

        if (url) {
            console.log("SUCCESS! URL:", url);
        } else {
            console.log("Failed to upload. See error above.");
        }
    } catch (e) {
        console.error("Test script failed:", e);
    }
};

testUpload();
