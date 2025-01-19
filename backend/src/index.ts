import dotenv from "dotenv";
dotenv.config();
import express, { Request } from "express";
import multer from "multer";
import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import depcheck from "depcheck";
import { Server } from "socket.io";
import mongoose from "mongoose";
import projectRoutes from "./routes/routes";
import cors from "cors"; // Initialize express app
import {
  createDependencyAnalysis,
  createSastAnalysis,
  createScaAnalysis,
  createSecretDetectionAnalysis,
} from "./controllers/analysis";
import {
  Project,
  SastAnalysis,
  ScaAnalysis,
  SecretDetectionAnalysis,
  DependencyAnalysis,
} from "./models/schema"; // Assuming your schema is in models/Project.js

const app = express();
app.use(
  cors({
    origin: "*", // Update to your frontend's origin
  })
);
const port = 8080;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
// Socket.IO setup
// Socket.IO connection

app.use(express.json());
app.use("/", projectRoutes);
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
app.post("/upload", upload.array("files"), async (req: Request, res: any) => {
  const { projectKey, language, module } = req.query;

  console.log({ projectKey, language, module }, typeof language, typeof module);

  const existingProject = await Project.findOne({ projectKey });

  if (existingProject) {
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // Create a new directory inside 'temp' with a unique name for each request
    const newFolderName = `upload_${Date.now()}`;
    const tempDirectory = path.join(__dirname, "..", "temp", newFolderName);

    try {
      fs.mkdirSync(tempDirectory, { recursive: true });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "Failed to create folder", details: err.message });
    }

    // Move files to the new folder from memory
    (req.files as Express.Multer.File[]).forEach((file) => {
      const destinationPath = path.join(tempDirectory, file.originalname);
      try {
        // Write the file to the new location in the temp folder
        fs.writeFileSync(destinationPath, file.buffer);
      } catch (err: any) {
        console.error(`Failed to write file: ${err.message}`);
        return res
          .status(500)
          .json({ error: "Failed to save file", details: err.message });
      }
    });

    // Check if package.json exists in the uploaded folder
    const packageJsonPath = path.join(tempDirectory, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return res
        .status(400)
        .json({ error: "No package.json file found in the uploaded folder!" });
    }

    // Frame the npm audit command with the correct path
    const command1 = `npm audit --prefix "${tempDirectory}"`;
    const command2 = `cd ${tempDirectory} && npx @secretlint/quick-start "**/*"`;
    const command3 = `cd ${tempDirectory} && npx eslint .`;

    // Run npm audit
    try {
      // Create eslint.config.mjs based on the language and module parameters

      if (language == "TypeScript" && module == "ESM") {
        const command = `cd ${tempDirectory} && echo import globals from 'globals'; import pluginJs from '@eslint/js'; import tseslint from 'typescript-eslint'; /** @type {import('eslint').Linter.Config[]} */ export default [ { files: ['**/*.{js,mjs,cjs,ts}'] }, { languageOptions: { globals: globals.browser } }, pluginJs.configs.recommended, ...tseslint.configs.recommended, ]; > eslint.config.mjs`;
        try {
          await runCommand(command);
        } catch (err: any) {
          console.error("Error creating eslint.config.mjs:", err);
          return res.status(500).json({
            error: "Failed to create ESLint config file",
            details: err.message,
          });
        }
      } else if (language == "JavaScript" && module == "ESM") {
        const command = `cd ${tempDirectory} && echo import globals from 'globals'; import pluginJs from '@eslint/js'; /** @type {import('eslint').Linter.Config[]} */ export default [ { languageOptions: { globals: globals.browser } }, pluginJs.configs.recommended, ]; > eslint.config.mjs`;
        try {
          await runCommand(command);
        } catch (err: any) {
          console.error("Error creating eslint.config.mjs:", err);
          return res.status(500).json({
            error: "Failed to create ESLint config file",
            details: err.message,
          });
        }
      } else if (language == "TypeScript" && module == "CommonJS") {
        const command = `cd ${tempDirectory} && echo import globals from 'globals'; import pluginJs from '@eslint/js'; import tseslint from 'typescript-eslint'; /** @type {import('eslint').Linter.Config[]} */ export default [ { files: ['**/*.{js,mjs,cjs,ts}'] }, { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } }, { languageOptions: { globals: globals.browser } }, pluginJs.configs.recommended, ...tseslint.configs.recommended, ]; > eslint.config.mjs`;
        try {
          await runCommand(command);
        } catch (err: any) {
          console.error("Error creating eslint.config.mjs:", err);
          return res.status(500).json({
            error: "Failed to create ESLint config file",
            details: err.message,
          });
        }
      } else if (language == "JavaScript" && module == "CommonJS") {
        const command = `cd ${tempDirectory} && echo import globals from 'globals'; import pluginJs from '@eslint/js'; /** @type {import('eslint').Linter.Config[]} */ export default [ { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } }, { languageOptions: { globals: globals.browser } }, pluginJs.configs.recommended, ]; > eslint.config.mjs`;
        try {
          await runCommand(command);
        } catch (err: any) {
          console.error("Error creating eslint.config.mjs:", err);
          return res.status(500).json({
            error: "Failed to create ESLint config file",
            details: err.message,
          });
        }
      }

      const auditResult = await runCommand(command1);
      await createScaAnalysis(existingProject._id, auditResult);
      const scaData = await ScaAnalysis.find({
        projectId: existingProject._id,
      }).sort({ date: -1 });
      io.emit("analysisDataUpdate", {
        projectId: existingProject._id,
        key: "scaAnalysis",
        value: scaData,
      });
      

      
      const secretResult = await runCommand(command2);
      await createSecretDetectionAnalysis(existingProject._id, secretResult);
      const secretDetectionData = await SecretDetectionAnalysis.find({
        projectId: existingProject._id,
      }).sort({ date: -1 });
      io.emit("analysisDataUpdate", {
        projectId: existingProject._id,
        key: "secretDetectionAnalysis",
        value: secretDetectionData,
      });

      const sastResult = await runCommand(command3);
      await createSastAnalysis(existingProject._id, sastResult);
      // Fetch analysis data from all collections, sorted by date
      const sastData = await SastAnalysis.find({
        projectId: existingProject._id,
      }).sort({ date: -1 });
      // Emit updates for each analysis type separately
      io.emit("analysisDataUpdate", {
        projectId: existingProject._id,
        key: "sastAnalysis",
        value: sastData,
      });

      

      depcheck(tempDirectory, {}).then(async (unused) => {
        await createDependencyAnalysis(existingProject._id, unused);
        const dependencyData = await DependencyAnalysis.find({
          projectId: existingProject._id,
        }).sort({ date: -1 });
        io.emit("analysisDataUpdate", {
          projectId: existingProject._id,
          key: "dependencyAnalysis",
          value: dependencyData,
        });
      });
      
      

      fs.rmSync(tempDirectory, { recursive: true, force: true });
      res.json({ message: "Scanning done" });
    } catch (e: any) {
      console.error("Error Scanning", e);
      fs.rmSync(tempDirectory, { recursive: true, force: true });
      res.status(500).json({ error: "Error Scanning", details: e.message });
    }
  } else {
    res.status(404).json({ error: "Project not found" });
  }
});

// Start server
server.listen(process.env.PORT ?? 8080, async () => {
  try {
    console.log(
      `Server is running on http://localhost:${process.env.PORT ?? 8080}`
    );
    await mongoose.connect(`${process.env.MONGO_URI}`);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
});

// Properly handle process exit
process.on("SIGINT", async () => {
  console.log("Received SIGINT. Cleaning up...");
  await mongoose.disconnect(); // Close MongoDB connection
  console.log("Database connection closed");
  process.exit(0);
});
