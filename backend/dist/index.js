"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const depcheck_1 = __importDefault(require("depcheck"));
// Initialize express app
const app = (0, express_1.default)();
const port = 3000;
// Middleware to ensure 'temp/' directory exists before handling requests
app.use((req, res, next) => {
    const tempDir = path_1.default.join(__dirname, '...', 'temp');
    if (!fs_1.default.existsSync(tempDir)) {
        fs_1.default.mkdirSync(tempDir, { recursive: true });
    }
    next();
});
// Multer configuration to use memory storage (no need for uploads/ directory)
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
// Function to run any command in the given directory
const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, (error, stdout, stderr) => {
            if (error) {
                // Check for specific exit code
                if (error.code === 1) {
                    // Handle the case where vulnerabilities are found
                    resolve(stdout); // You can also log stderr if needed
                }
                else {
                    // Handle other errors
                    reject(error);
                }
            }
            else {
                // Command was successful
                resolve(stdout);
            }
        });
    });
};
// Endpoint to handle file uploads
app.post('/upload', upload.array('files'), async (req, res) => {
    // Create a new directory inside 'temp' with a unique name for each request
    const newFolderName = `upload_${Date.now()}`;
    const tempDirectory = path_1.default.join(__dirname, '...', 'temp', newFolderName);
    // Create the new directory to store files
    console.log(`Creating directory: ${tempDirectory}`);
    try {
        fs_1.default.mkdirSync(tempDirectory, { recursive: true });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to create folder', details: err.message });
    }
    // Move files to the new folder from memory
    req.files.forEach((file) => {
        const destinationPath = path_1.default.join(tempDirectory, file.originalname);
        try {
            // Write the file to the new location in the temp folder
            fs_1.default.writeFileSync(destinationPath, file.buffer);
        }
        catch (err) {
            console.error(`Failed to write file: ${err.message}`);
            return res.status(500).json({ error: 'Failed to save file', details: err.message });
        }
    });
    // Check if package.json exists in the uploaded folder
    const packageJsonPath = path_1.default.join(tempDirectory, 'package.json');
    if (!fs_1.default.existsSync(packageJsonPath)) {
        return res.status(400).json({ error: 'No package.json file found in the uploaded folder!' });
    }
    // Frame the npm audit command with the correct path
    const command = `npm audit --prefix "${tempDirectory}"`;
    // Run npm audit
    try {
        const auditResult = await runCommand(command);
        console.log('npm audit result:\n', auditResult);
        (0, depcheck_1.default)(tempDirectory, {}).then((unused) => {
            console.log({ unused });
        });
        res.json({ message: 'Scanning done', result: auditResult });
    }
    catch (e) {
        console.error('Error executing npm audit:', e);
        res.status(500).json({ error: 'Error executing npm audit', details: e.message });
    }
});
// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
