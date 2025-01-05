import express, { Request, Response } from "express";
import BoxSDK from "box-node-sdk";
import {
  queryFeatures,
  IQueryFeaturesResponse,
} from "@esri/arcgis-rest-feature-layer";
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { getArcGISToken } from "./helpers/manualCommon";
import {
  addToQueue,
  getFeatureLayerDetails,
} from "./helpers/manualCommon";

// Load environment variables

// Initialize Express app
const app = express();
app.use(express.json());

// Box SDK setup
const config = require("../config/boxconfig.json");
const sdk = BoxSDK.getPreconfiguredInstance(config);
const client = sdk.getAppAuthClient("user", "6678098696");

// Route to get features by title
app.get("/features/title/:title", async (req: Request, res: Response) => {
  const { title } = req.params;
  
  try {
    const token = await getArcGISToken();
    const featureLayerUrl = process.env.ARCGIS_FEATURE_LAYER_URL!; // Ensure to set this in .env

    // Query the feature layer using the title field
    const response = await queryFeatures({
      url: featureLayerUrl,
      where: `title = '${title}'`,
      f: "json",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Type assertion to IQueryFeaturesResponse
    const features = (response as IQueryFeaturesResponse).features;

    if (features && features.length > 0) {
      res.json({
        success: true,
        feature: features[0], // Return the first matching feature
      });
    } else {
      res.status(404).json({
        success: false,
        message: `No features found with title: ${title}`,
      });
    }
  } catch (error) {
    console.error("Error querying features:", error);
    res.status(500).json({
      success: false,
      message: "Error querying features",
      error: error,
    });
  }
});

// Route to handle Box webhook events
app.post("/boxwebhook", async (req: Request, res: Response) => {
  try {
    const fileId = req.body.source.id;
    console.log({ fileId });

    // Attempt to create a shared link
    const sharedLinkResponse = await client.files.update(req.body.source.id, {
      shared_link: {
        access: 'open', // or 'company', or 'password'
        unshared_at: null, // Set to a date if you want to unshare after a specific time
      },
    });
    // Check if the response is valid
    if (!sharedLinkResponse || !sharedLinkResponse.shared_link) {
      throw new Error('Failed to create shared link: Invalid response');
    }

    // Format the URL to match the desired static URL format
    const staticLink = sharedLinkResponse.shared_link.url.replace(/\/s\//, '/shared/static/');
    console.log(staticLink);
    const metadata = await client.folders.getMetadata(
      req.body.source.parent.id,
      "enterprise_135768750",
      "arcgisboximages"
    );

    console.log({ metadata });
    const token = await getArcGISToken();
    addToQueue(metadata,token ,staticLink);

    res.status(200).json({ message: "Webhook received and processed" });
  } catch (error) {
    console.error("Error processing webhook:", (error as Error).message);
    res.status(500).json({
      error: "Error processing webhook",
      details: (error as Error).message,
    });
  }
});

// Route to get feature layer metadata
app.get("/feature-layer", async (req: Request, res: Response) => {
  try {
    const token = await getArcGISToken();
    const layerMetadata = await getFeatureLayerDetails(token);

    res.status(200).json(layerMetadata);
  } catch (error) {
    console.error(
      "Error fetching feature layer metadata:",
      (error as Error).message
    );
    res.status(500).json({
      error: "Error fetching feature layer metadata",
      details: (error as Error).message,
    });
  }
});

// Route to handle ArcGIS webhook events
app.post("/arcgiswebhook", async (req: Request, res: Response) => {
  try {
    console.log("Webhook received:", req.body);
    const token = await getArcGISToken();

    const decodeurl = decodeURIComponent(req.body[0].changesUrl);
    console.log({ decodeurl });

    let urlWithParams = `${decodeurl}&f=json&token=${token}`;
    console.log({ urlWithParams });

    let response = await axios.get(urlWithParams);
    let changes = response.data;
    console.log("Changes response:", changes);

    const statusUrl = changes.statusUrl;
    console.log({ statusUrl });

    if (!statusUrl) {
      throw new Error("Status URL not found in changes response");
    }

    // Poll the status URL until the job is complete
    let jobCompleted = false;
    let resultUrl = "";
    let retryCount = 0;
    const maxRetries = 12;

    while (!jobCompleted && retryCount < maxRetries) {
      urlWithParams = `${statusUrl}?f=json&token=${token}`;
      console.log({ urlWithParams });

      response = await axios.get(urlWithParams);
      changes = response.data;
      console.log("Status response:", changes);

      if (changes.status === "Pending") {
        console.log("Job is still pending. Waiting...");
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 5-second delay
        retryCount++;
      } else if (changes.status === "Completed") {
        jobCompleted = true;
        resultUrl = changes.resultUrl;
        console.log("Job completed. Result URL:", resultUrl);
      } else {
        throw new Error(`Job failed with status: ${changes.status}`);
      }
    }

    if (retryCount >= maxRetries) {
      throw new Error("Max retries exceeded. Job still pending.");
    }

    if (resultUrl) {
      urlWithParams = `${resultUrl}?f=json&token=${token}`;
      console.log({ urlWithParams });

      response = await axios.get(urlWithParams);
      const changeFileData = response.data;
      console.log("Change File Data:", changeFileData);

      const objectId =
        changeFileData.edits?.[0]?.features?.adds?.[0]?.attributes?.OBJECTID;

      if (objectId) {
        console.log("OBJECTID:", objectId);
      } else {
        console.log("OBJECTID not found or invalid structure.");
      }
    } else {
      throw new Error("Invalid result URL or job failed.");
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({
      error: "Error processing webhook",
      details: error,
    });
  }
});

// Start the server
app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
