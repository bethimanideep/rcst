import {
  IQueryFeaturesResponse,
  queryFeatures,
  updateFeatures,
} from "@esri/arcgis-rest-feature-layer";
import axios from "axios";
import { client } from "../Automatic";
import { request } from "@esri/arcgis-rest-request";

// Create a queue array to hold tasks
const queue: Array<any> = [];
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
// Function to get ArcGIS token
export async function getArcGISToken() {
  try {
    const clientId = process.env.ARCGIS_CLIENT_ID!;
    const clientSecret = process.env.ARCGIS_CLIENT_SECRET!;

    const tokenUrl = `https://www.arcgis.com/sharing/rest/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&f=json`;

    const response = await axios.get(tokenUrl);

    if (response.data ?? response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new Error("Failed to retrieve token");
    }
  } catch (error) {
    console.error("Error retrieving token:", error);
    throw error;
  }
}

// Function to update the `boxurls` field for a specific record by appending a new URL
export async function updateProjectName(
  token: string,
  featurelayerurl: string,
  objectid: string,
  sharedLink: string,
) {
  try {
    const queryResponse = await queryFeatures({
      url: featurelayerurl,
      where: `objectId = ${objectid}`,
      returnGeometry: false,
      outFields: ["boxurls"],
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const boxurlsvalue = (queryResponse as IQueryFeaturesResponse).features?.[0]
      .attributes;
    console.log({ boxurlsvalue });

    if (boxurlsvalue && boxurlsvalue.boxurls) {
      boxurlsvalue.boxurls = `${boxurlsvalue.boxurls};${sharedLink}`;
    } else {
      boxurlsvalue.boxurls = sharedLink;
    }

    const updateOptions = {
      url: featurelayerurl,
      features: [
        {
          attributes: {
            objectId: objectid,
            boxurls: boxurlsvalue.boxurls,
          },
        },
      ],
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const updateResponse = await updateFeatures(updateOptions);
    console.log("Update Results:", updateResponse.updateResults);
  } catch (error) {
    console.error("Error updating feature:", error);
    throw error;
  }
}

export async function createNewFolder(
  folderId: string,
  objectid: string,
  title: string,
  featureLayerUrl: string,
  token: string,
) {
  try {
    // Create a new folder inside the specified folder (folderId)
    const foldername = `${title} - ${objectid}`;
    console.log({ foldername });
    const newFolder = await client.folders.create(folderId, foldername);
    // Define the metadata template for the folder
    client.folders
      .setMetadata(newFolder.id, "enterprise_135768750", "arcgisboximages", {
        featurelayerurl: featureLayerUrl,
        objectid: objectid,
        title: title,
      })
      .then((metadata: any) => console.log({ metadata }));

    const queryResponse = await queryFeatures({
      url: featureLayerUrl,
      where: `objectId = ${objectid}`,
      returnGeometry: false,
      outFields: ["boxfolder"],
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const boxurlsvalue = (queryResponse as IQueryFeaturesResponse).features?.[0]
      .attributes;
    console.log({ boxurlsvalue });

    boxurlsvalue.boxfolder = `http://localhost:3000/box-content-explorer?folderid=${newFolder.id}`;

    const updateOptions = {
      url: featureLayerUrl,
      features: [
        {
          attributes: {
            objectId: objectid,
            boxfolder: boxurlsvalue.boxfolder,
          },
        },
      ],
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const updateResponse = await updateFeatures(updateOptions);
    console.log("Update Results:", updateResponse.updateResults);
  } catch (error) {
    console.error("Error creating folder or applying metadata:", error);
  }
}

export async function getFeatureLayerDetails(
  token: string,
  featureLayerUrl: string,
) {
  try {
    const featureLayerDetails = await request(featureLayerUrl, {
      params: {
        f: "json", // Get the details in JSON format,
        token: token,
      },
    });
    return featureLayerDetails.name;
  } catch (error) {
    console.error("Error fetching feature layer metadata:", error);
    throw error;
  }
}

export const addToQueue = (
  metadata: any,
  token: string,
  staticLink: string,
) => {
  // Wrap your logic in a function
  const task = async () => {
    const queryResponse: any = await queryFeatures({
      url: metadata.featurelayerurl,
      where: `objectId = ${metadata.objectid}`,
      returnGeometry: false,
      outFields: ["boxurls"],
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const attributes = queryResponse.features[0].attributes;
    console.log({ attributes });

    if (attributes ?? attributes.boxurls) {
      attributes.boxurls = `${attributes.boxurls};${staticLink}`;
    } else {
      attributes.boxurls = staticLink;
    }

    const updateOptions = {
      url: metadata.featurelayerurl,
      features: [
        {
          attributes: {
            objectId: metadata.objectid,
            boxurls: attributes.boxurls,
          },
        },
      ],
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const updateResponse = await updateFeatures(updateOptions);
    console.log("Update Results:", updateResponse.updateResults);
  };

  queue.push(task); // Add the task to the queue
  processQueue(); // Start processing the queue
};
