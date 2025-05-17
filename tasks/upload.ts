import { task } from "hardhat/config";

task("upload", "Upload a file to a WTTP site")
  .addParam("site", "The address of the WTTP site")
  .addParam("source", "The source file path")
  .addParam("destination", "The destination path on the WTTP site")
  .setAction(async (taskArgs, hre) => {
    const { site, source, destination } = taskArgs;
    
    // Import the upload function
    const { uploadFile } = require("../scripts/uploadFile");
    
    // Connect to the WTTP site
    const wtppSite = await hre.ethers.getContractAt("WTTPSiteImpl", site);
    
    // Upload the file
    await uploadFile(wtppSite, source, destination);
  });

export default {};