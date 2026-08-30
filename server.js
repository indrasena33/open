const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const cors = require('cors');

const app = express();

// --- FULLY OPEN CORS CONFIGURATION ---
// This allows requests from any origin (including your GitHub Pages site) and properly handles preflight OPTIONS requests.
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const BACKEND_URL = process.env.BACKEND_URL || 'https://myspace-rlak.onrender.com';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MYspace@5055";

let currentLiveContent = "";

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

        let streamUpload = (fileBuffer) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    { resource_type: "auto" },
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
                streamifier.createReadStream(fileBuffer).pipe(stream);
            });
        };

        let result = await streamUpload(req.file.buffer);

        return res.status(200).json({
            success: true,
            url: result.secure_url
        });

    } catch (err) {
        console.error("Backend Upload Error:", err);
        return res.status(500).json({ success: false, error: err.message || "Server crash during upload." });
    }
});

app.post('/api/content', (req, res) => {
    try {
        const { html, password } = req.body;
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }
        currentLiveContent = html;
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/content', (req, res) => {
    return res.status(200).json({ html: currentLiveContent });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (Public URL: ${BACKEND_URL})`);
});