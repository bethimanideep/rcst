import { ScaAnalysis, SastAnalysis, SecretDetectionAnalysis, DependencyAnalysis } from '../models/schema';
import mongoose from 'mongoose';

const createScaAnalysis = async (projectId: mongoose.Types.ObjectId, data: string) => {
  try {
    const newScaAnalysis = new ScaAnalysis({
      projectId: projectId,
      data: data,
      date: new Date(),
    });

    await newScaAnalysis.save();
    console.log("SCA Analysis created and saved successfully");
  } catch (error) {
    console.error("Error creating SCA Analysis:", error);
  }
};

const createSastAnalysis = async (projectId: mongoose.Types.ObjectId, data: string) => {
  try {
    const newSastAnalysis = new SastAnalysis({
      projectId: projectId,
      data: data,
      date: new Date(),
    });

    await newSastAnalysis.save();
    console.log("SAST Analysis created and saved successfully");
  } catch (error) {
    console.error("Error creating SAST Analysis:", error);
  }
};

const createSecretDetectionAnalysis = async (projectId: mongoose.Types.ObjectId, data: string) => {
  try {
    const newSecretDetectionAnalysis = new SecretDetectionAnalysis({
      projectId: projectId,
      data: data,
      date: new Date(),
    });

    await newSecretDetectionAnalysis.save();
    console.log("Secret Detection Analysis created and saved successfully");
  } catch (error) {
    console.error("Error creating Secret Detection Analysis:", error);
  }
};

const createDependencyAnalysis = async (projectId: mongoose.Types.ObjectId, data: Object) => {
  try {
    const newDependencyAnalysis = new DependencyAnalysis({
      projectId: projectId,
      data: data,
      date: new Date(),
    });

    await newDependencyAnalysis.save();
    console.log("Dependency Analysis created and saved successfully");
  } catch (error) {
    console.error("Error creating Dependency Analysis:", error);
  }
};

export { createScaAnalysis, createSastAnalysis, createSecretDetectionAnalysis, createDependencyAnalysis };
