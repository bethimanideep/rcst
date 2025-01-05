import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import depcheck from 'depcheck';

// Initialize express app
const app = express();
const port = 3000;

// Middleware to ensure 'temp/' directory exists before handling requests
app.use((req: Request, res: Response, next: NextFunction) => {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    next();
});

// Multer configuration to use memory storage (no need for uploads/ directory)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Function to run any command in the given directory
const runCommand = (command: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Check for specific exit code
                if (error.code === 1) {
                    // Handle the case where vulnerabilities are found
                    resolve(stdout); // You can also log stderr if needed
                } else {
                    // Handle other errors
                    reject(error);
                }
            } else {
                // Command was successful
                resolve(stdout);
            }
        });
    });
};

// Endpoint to handle file uploads
app.post('/upload', upload.array('files'), async (req: Request, res: any) => {
    // Create a new directory inside 'temp' with a unique name for each request
    const newFolderName = `upload_${Date.now()}`;
    const tempDirectory = path.join(__dirname,'..', 'temp', newFolderName);

    // Create the new directory to store files
    console.log(`Creating directory: ${tempDirectory}`);

    try {
        fs.mkdirSync(tempDirectory, { recursive: true });
    } catch (err: any) {
        return res.status(500).json({ error: 'Failed to create folder', details: err.message });
    }

    // Move files to the new folder from memory
    (req.files as Express.Multer.File[]).forEach((file) => {
        const destinationPath = path.join(tempDirectory, file.originalname);
        try {
            // Write the file to the new location in the temp folder
            fs.writeFileSync(destinationPath, file.buffer);
        } catch (err: any) {
            console.error(`Failed to write file: ${err.message}`);
            return res.status(500).json({ error: 'Failed to save file', details: err.message });
        }
    });

    // Check if package.json exists in the uploaded folder
    const packageJsonPath = path.join(tempDirectory, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return res.status(400).json({ error: 'No package.json file found in the uploaded folder!' });
    }

    // Frame the npm audit command with the correct path
    const command = `npm audit --prefix "${tempDirectory}"`;

    // Run npm audit
    try {
        const auditResult = await runCommand(command);
        console.log('npm audit result:\n', auditResult);
        depcheck(tempDirectory, {}).then((unused) => {
            console.log({unused});
          });
        res.json({ message: 'Scanning done', result: auditResult });
    } catch (e: any) {
        console.error('Error executing npm audit:', e);
        res.status(500).json({ error: 'Error executing npm audit', details: e.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
