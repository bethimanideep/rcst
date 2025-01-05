import { Router } from 'express';
import { Project,SastAnalysis, ScaAnalysis, SecretDetectionAnalysis, DependencyAnalysis } from '../models/schema';  // Assuming your schema is in models/Project.js
import mongoose from 'mongoose';

const router = Router();

// Create project route
router.post('/createproject', async (req, res) => {
  const { displayName, projectKey } = req.body;
  try {
    // Create a new project
    const newProject = new Project({
      displayName,
      projectKey,
    });

    // Save the project to the database
    await newProject.save();

    // Return success response
    res.status(201).json({ message: 'Project created successfully', project: newProject });
  } catch (err:any) {
    // Handle any errors
    console.error(err);
    res.status(500).json({ message: 'Error creating project', error: err.message });
  }
});

router.get('/getprojects', async (req, res) => {
  try {
    // Retrieve all projects from the database
    const projects = await Project.find();

    // Send the retrieved projects as the response
    res.status(200).json(projects);
  } catch (err) {
    // Handle any errors
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});


router.post('/analysisdata', async (req: any, res: any) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Validate if the provided projectId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid Project ID" });
    }

   // Fetch analysis data from all collections, sorted by date
const sastData = await SastAnalysis.find({ projectId }).sort({ date: -1 });
const scaData = await ScaAnalysis.find({ projectId }).sort({ date: -1 });
const secretDetectionData = await SecretDetectionAnalysis.find({ projectId }).sort({ date: -1 });
const dependencyData = await DependencyAnalysis.find({ projectId }).sort({ date: -1 });


    // Combine results into a single object
    const analysisData = {
      sastAnalysis: sastData,
      scaAnalysis: scaData,
      secretDetectionAnalysis: secretDetectionData,
      dependencyAnalysis: dependencyData,
    };

    // Send the combined analysis data as a response
    res.status(200).json(analysisData);
  } catch (err) {
    console.error('Error retrieving analysis data:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});



export default router;
