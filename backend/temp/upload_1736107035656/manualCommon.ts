import {
  IFeature,
  queryFeatures,
  updateFeatures,
} from "@esri/arcgis-rest-feature-layer";
import { request } from "@esri/arcgis-rest-request";
import axios from "axios";

interface IExtendedFeature extends IFeature {
  boxurls?: string;
  feature?: any;
}

// Create a queue array to hold tasks
const queue: any = [];
let isProcessing = false; // Flag to indicate if processing is in progress

// Function to process the queue
const processQueue = async () => {
  if (isProcessing) return; // If already processing, exit

  isProcessing = true; // Mark processing as in progress

  while (queue.length > 0) {
    const currentTask = queue.shift(); // Get the next task from the queue
    try {
      await currentTask(); // Execute the task and wait for it to finish
    } catch (error) {
      console.error("Error processing task:", error); // Handle any errors
    }
  }

  isProcessing = false; // Mark processing as finished
};
// Function to get feature layer metadata (like title, description, etc.)
export async function getFeatureLayerDetails(token: string) {
  try {
    const featureServiceUrl = process.env.ARCGIS_FEATURE_LAYER_URL!;
    const featureLayerDetails = await request(featureServiceUrl, {
      params: {
        f: "json", // Get the details in JSON format
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return featureLayerDetails;
  } catch (error) {
    console.error("Error fetching feature layer metadata:", error);
    throw error;
  }
}

// Function to get ArcGIS token
export async function getArcGISToken() {
  try {
    const clientId = process.env.ARCGIS_CLIENT_ID!;
    const clientSecret = process.env.ARCGIS_CLIENT_SECRET!;

    const tokenUrl = `https://www.arcgis.com/sharing/rest/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&f=json`;

    const response = await axios.get(tokenUrl);

    if (response.data && response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new Error("Failed to retrieve token");
    }
  } catch (error) {
    console.error("Error retrieving token:", error);
    throw error;
  }
}

// Function to query the existing value of a field for a specific record
export const addToQueue = (
  metadata: any,
  token: string,
  staticLink: string
) => {    
  const task = async () => {
    try {
      const featureLayerUrl = process.env.ARCGIS_FEATURE_LAYER_URL!; // Ensure to set this in .env

      // Query the feature layer using the title field
      const queryResponse:any = await queryFeatures({
        url: featureLayerUrl,
        where: `title = '${metadata.title}'`,
        f: "json",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const attributes=queryResponse.features[0].attributes
      console.log({attributes});
      


    if (attributes && attributes.boxurls) {
      attributes.boxurls = `${attributes.boxurls};${staticLink}`;
    } else {
      attributes.boxurls = staticLink;
    }

    const updateOptions = {
      url: featureLayerUrl,
      features: [
        {
          attributes: {
            objectId: attributes.OBJECTID,
            boxurls: attributes.boxurls,
          },
        },
      ],
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const updateResponse = await updateFeatures(updateOptions);
    console.log('Update Results:', updateResponse.updateResults);
    } catch (error) {
      console.error("Error querying feature:", error);
      throw error;
    }
  };
  queue.push(task); // Add the task to the queue
  processQueue();
};
