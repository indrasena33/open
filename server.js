const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const BACKEND_URL = process.env.BACKEND_URL || 'https://open-jad2.onrender.com';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MYspace@5055";

// Helper function to stream buffer data to Cloudinary
const streamUpload = (fileBuffer, options) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

app.post('/api/login', (req, res) => {
    try {
        const { password } = req.body;
        if (password === ADMIN_PASSWORD) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(401).json({ success: false, error: "Invalid Password" });
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/upload-media', upload.single('mediaFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No file provided." });
        }

        let result = await streamUpload(req.file.buffer, { resource_type: "auto", folder: "live_display_media" });

        return res.status(200).json({
            success: true,
            url: result.secure_url
        });
    } catch (err) {
        console.error("Backend Upload Error:", err);
        return res.status(500).json({ success: false, error: err.message || "Server crash during upload." });
    }
});

// Publish HTML content permanently by saving it as a file on Cloudinary
app.post('/api/content', async (req, res) => {
    try {
        const { html, password } = req.body;
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        // Convert the HTML string into a buffer file stream
        const buffer = Buffer.from(html, 'utf-8');
        
        // Upload/Overwrite live_content.html on Cloudinary
        const result = await streamUpload(buffer, {
            resource_type: "raw",
            public_id: "live_display_content/active_content",
            overwrite: true,
            invalidate: true
        });

        return res.status(200).json({ success: true, url: result.secure_url });
    } catch (err) {
        console.error("Publish Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Fetch the current live content URL or fetch the HTML file text directly from Cloudinary
app.get('/api/content', async (req, res) => {
    try {
        // Construct the permanent raw file URL on Cloudinary
        // Format: https://res.cloudinary.com/<cloud_name>/raw/upload/v1/live_display_content/active_content
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const htmlUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/live_display_content/active_content?ts=${Date.now()}`;
        
        const response = await fetch(htmlUrl);
        if (!response.ok) {
            return res.status(200).json({ html: "" }); // No content published yet
        }
        const htmlContent = await response.text();
        return res.status(200).json({ html: htmlContent });
    } catch (err) {
        return res.status(200).json({ html: "" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (Public URL: ${BACKEND_URL})`);
});