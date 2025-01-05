const BoxSDK = require("box-node-sdk");
const config = require("./config.json"); // Import the whole config.json directly

var sdk = BoxSDK.getPreconfiguredInstance(config);

const client = sdk.getAppAuthClient('user', '6678098696');

//getting user details
client.users
  .get(client.CURRENT_USER_ID)
  .then((items) => {
    console.log(items);
  })
  .catch((err) => {a
    console.log(err);
  });

//get folder information

client.folders
  .getItems("258172543166")
  .then((items) => {
    console.log(items);
  })
  .catch((err) => {
    console.log(err);
  });
