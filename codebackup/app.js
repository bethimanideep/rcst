const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * Recursively collects all files from a directory.
 * Skips `node_modules`.
 * @param {string} dirPath - Directory to scan.
 * @param {string[]} fileList - Collected file paths.
 * @returns {string[]} - List of file paths.
 */
function getAllFiles(dirPath, fileList = []) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip `node_modules`
        if (entry.name === 'node_modules') continue;

        if (entry.isDirectory()) {
            getAllFiles(fullPath, fileList); // Recursively scan subdirectories
        } else {
            fileList.push(fullPath); // Add file to list
        }
    }

    return fileList;
}

/**
 * Sends files to the backend.
 * @param {string[]} files - List of file paths.
 * @param {string} currentPath - The root directory path.
 */
function uploadFiles(files, currentPath) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/upload',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
    };

    const req = http.request(options, res => {
        res.on('data', data => console.log('Response:', data.toString()));
        res.on('end', () => console.log('Upload completed!'));
    });

    req.on('error', error => console.error('Error:', error.message));

    // Write multipart form data
    files.forEach(filePath => {
        const relativePath = path.relative(currentPath, filePath);
        const fileContent = fs.readFileSync(filePath);

        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="files"; filename="${relativePath}"\r\n`);
        req.write('Content-Type: application/octet-stream\r\n\r\n');
        req.write(fileContent);
        req.write('\r\n');
    });

    req.write(`--${boundary}--\r\n`);
    req.end();
}

// Main execution
const currentPath = process.cwd(); // Get the current working directory
const filesToUpload = getAllFiles(currentPath);

if (filesToUpload.length === 0) {
    console.log('No files to upload!');
} else {
    uploadFiles(filesToUpload, currentPath);
}
