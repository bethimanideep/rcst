import mongoose from 'mongoose';

// Define Schemas
const createProject = new mongoose.Schema({
  displayName: { type: String, required: true },
  projectKey: { type: String, required: true },
});

// Define SAST Analysis Schema
const sastAnalysis = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  data: { type: String, required: true },
  date: { type: Date, default: Date.now },
  // Additional fields as required
});

// Define SCA Analysis Schema
const scaAnalysis = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  data: { type: String, required: true },
  date: { type: Date, default: Date.now },
  // Additional fields as required
});

// Define Secret Detection Analysis Schema
const secretDetectionAnalysis = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  data: { type: String, required: true },
  date: { type: Date, default: Date.now },
  // Additional fields as required
});

// Define Dependency Analysis Schema
const dependencyAnalysis = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  data: { type: Object, required: true },
  date: { type: Date, default: Date.now },
  // Additional fields as required
});

// Export models
const Project = mongoose.model('Project', createProject);
const SastAnalysis = mongoose.model('SastAnalysis', sastAnalysis);
const ScaAnalysis = mongoose.model('ScaAnalysis', scaAnalysis);
const SecretDetectionAnalysis = mongoose.model('SecretDetectionAnalysis', secretDetectionAnalysis);
const DependencyAnalysis = mongoose.model('DependencyAnalysis', dependencyAnalysis);

export { Project, SastAnalysis, ScaAnalysis, SecretDetectionAnalysis, DependencyAnalysis };
