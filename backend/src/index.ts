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
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

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
  const { projectKey } = req.query;
  console.log({ projectKey });

  const existingProject = await Project.findOne({ projectKey });

  console.log({ existingProject });
  if (existingProject) {
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // Create a new directory inside 'temp' with a unique name for each request
    const newFolderName = `upload_${Date.now()}`;
    const tempDirectory = path.join(__dirname, "..", "temp", newFolderName);

    // Create the new directory to store files
    console.log(`Creating directory: ${tempDirectory}`);

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
    const command = `npm audit --prefix "${tempDirectory}"`;
    const command1 = `cd ${tempDirectory} && npx @secretlint/quick-start "**/*"`;

    // Run npm audit
    try {
      const auditResult = await runCommand(command);
      await createScaAnalysis(existingProject._id, auditResult);
      const secretResult = await runCommand(command1);
      await createSecretDetectionAnalysis(existingProject._id, secretResult);
      console.log({secretResult});
      


      depcheck(tempDirectory, {}).then(async (unused) => {
        await createDependencyAnalysis(existingProject._id, unused);
        console.log({ unused });
      });

      // Fetch analysis data from all collections, sorted by date
      const sastData = await SastAnalysis.find({
        projectId: existingProject._id,
      }).sort({ date: -1 });
      const scaData = await ScaAnalysis.find({
        projectId: existingProject._id,
      }).sort({ date: -1 });
      const secretDetectionData = await SecretDetectionAnalysis.find({
        projectId: existingProject._id,
      }).sort({ date: -1 });
      const dependencyData = await DependencyAnalysis.find({
        projectId: existingProject._id,
      }).sort({ date: -1 });

      // Combine results into a single object
      const analysisData = {
        sastAnalysis: sastData,
        scaAnalysis: scaData,
        secretDetectionAnalysis: secretDetectionData,
        dependencyAnalysis: dependencyData,
      };

      /// Emit the event to all connected clients
      io.emit("analysisDataUpdate", {
        projectId: existingProject._id,
        analysisData: analysisData,
      });

      res.json({ message: "Scanning done", result: auditResult });
    } catch (e: any) {
      console.error("Error executing npm audit:", e);
      res
        .status(500)
        .json({ error: "Error executing npm audit", details: e.message });
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
