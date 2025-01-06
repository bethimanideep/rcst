import express, { Request, Response } from "express";
import BoxSDK from "box-node-sdk";
import featurelayersdata from "../config/featurelayerconfig.json";
import config from "../config/boxconfig.json";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config(); // Load environment variables
import cors from "cors";
import {
  addToQueue,
  createNewFolder,
  getArcGISToken,
} from "./helpers/autocommon";

const app = express();
app.use(cors());
app.set("view engine", "ejs");
const sdk = BoxSDK.getPreconfiguredInstance(config);
export const client = sdk.getAppAuthClient("user", "6678098696");

app.use(express.json());

app.get("/box-content-explorer", async (req: Request, res: Response) => {
  const folderid = req.query.folderid; // Get folderid from query parameter
  console.log({ folderid });

  const scopes = [
    "base_explorer",
    "base_picker",
    "base_preview",
    "base_sidebar",
    "base_upload",
    "item_delete",
    "item_download",
    "item_preview",
    "item_rename",
    "item_share",
    "item_upload",
  ];

  const resource = `https://api.box.com/2.0/folders/${folderid}`;

  client
    .exchangeToken(scopes, resource)
    .then((data: any) => {
      console.log({ data: data.accessToken });
      res.render("box", { folderid, accessToken: data.accessToken });
    })
    .catch((err: any) => {
      console.error(err);
    });
});

app.post("/boxwebhook", async (req: Request, res: Response) => {
  try {
    // Check if fileId is present
    console.log({ fileid: req.body.source.id });

    if (!req.body.source.id) {
      throw new Error("File ID is missing in the webhook payload");
    }
    const metadata = await client.folders.getMetadata(
      req.body.source.parent.id,
      "enterprise_135768750",
      "arcgisboximages",
    );
    console.log({ metadata });
    if (!metadata) {
      throw new Error("No metadata");
    }

    const token = await getArcGISToken(); // Get the ArcGIS token
    console.log({ token });

    // Attempt to create a shared link
    const sharedLinkResponse = await client.files.update(req.body.source.id, {
      shared_link: {
        access: "open", // or 'company', or 'password'
        unshared_at: null, // Set to a date if you want to unshare after a specific time
      },
    });
    // Check if the response is valid
    if (!sharedLinkResponse || !sharedLinkResponse.shared_link) {
      throw new Error("Failed to create shared link: Invalid response");
    }

    // Format the URL to match the desired static URL format
    const staticLink = sharedLinkResponse.shared_link.url.replace(
      /\/s\//,
      "/shared/static/",
    );
    console.log(staticLink);
    addToQueue(metadata, token, staticLink); // Add the task to the queue
    res.status(200).json({ message: "Webhook received and processed" });
  } catch (error) {
    console.error("Error processing webhook:", (error as Error).message);
    res.status(500).json({
      error: "Error processing webhook",
      details: (error as Error).message,
    });
  }
});

app.post("/arcgiswebhook", async (req: Request, res: Response) => {
  try {
    const token = await getArcGISToken(); // Get the ArcGIS /token

    // Extract the changesUrl from the webhook response
    const decodeurl = decodeURIComponent(req.body[0].changesUrl);
    console.log({ decodeurl });

    let urlWithParams = `${decodeurl}&f=json&token=${token}`;
    console.log({ urlWithParams });

    // Make the GET request to changesUrl
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
    const maxRetries = 12; // Poll for 1 minute with 5-second intervals

    while (!jobCompleted && retryCount < maxRetries) {
      urlWithParams = `${statusUrl}?f=json&token=${token}`;
      console.log({ urlWithParams });

      response = await axios.get(urlWithParams);
      changes = response.data;
      console.log("Status response:", changes);

      if (changes.status === "Pending") {
        console.log("Job is still pending. Waiting before checking again...");
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
      console.log({ changeFileData: JSON.stringify(changeFileData) });

      const objectId =
        changeFileData.edits[0].features.adds[
          changeFileData.edits[0].features.adds.length - 1
        ].attributes?.OBJECTID;
      const title =
        changeFileData.edits[0].features.adds[
          changeFileData.edits[0].features.adds.length - 1
        ].attributes?.title;
      if (objectId) {
        console.log("OBJECTID:", objectId);
        //retreiving boxid
        const FeatureLayerUrl = decodeurl.split("/extractChanges")[0] + "/0";

        // Logging the formatted feature layer URL
        console.log(FeatureLayerUrl);
        let boxid: any = null;
        for (const [key, value] of Object.entries(featurelayersdata)) {
          console.log({ key, FeatureLayerUrl });

          // Convert both key and FeatureLayerUrl to lowercase for comparison
          if (key.toLowerCase() === FeatureLayerUrl.toLowerCase()) {
            console.log("Match found:", { key, value });
            boxid = value;
            break;
          }
        }

        console.log({ boxid });
        if (boxid !== null) {
          await createNewFolder(
            boxid,
            objectId.toString(),
            title,
            FeatureLayerUrl,
            token,
          );
        }
      } else {
        console.log("OBJECTID not found or invalid structure.");
      }
    } else {
      throw new Error("Invalid result URL or job failed.");
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Error processing webhook", details: error });
  }
});

// Start the server
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
