import { task } from "hardhat/config";
import { main as fetchResourceMain } from "../scripts/fetchResource";

task("fetch", "Fetch a resource from a WTTP site via the WTTPGateway")
  .addParam("wttp", "The address of the WTTPGateway")
  .addParam("site", "The address of the WTTP site")
  .addParam("path", "The path to the resource")
  .addOptionalParam("range", "Byte range in format 'start-end' (e.g., '10-20')")
  .addOptionalParam("ifModifiedSince", "Unix timestamp for If-Modified-Since header")
  .addOptionalParam("ifNoneMatch", "ETag value for If-None-Match header")
  .addFlag("head", "Perform a HEAD request instead of GET")
  .setAction(async (taskArgs, hre) => {
    const { wttp, site, path, range, ifModifiedSince, ifNoneMatch, head } = taskArgs;
    
    // Parse range if provided
    let rangeOption = undefined;
    if (range) {
      const [start, end] = range.split("-").map(n => parseInt(n.trim()));
      rangeOption = { start, end };
    }
    
    // Parse ifModifiedSince if provided
    const ifModifiedSinceOption = ifModifiedSince ? parseInt(ifModifiedSince) : undefined;
    
    // Fetch the resource
    const response = await fetchResourceMain(
      hre,
      wttp,
      site,
      path,
      {
        range: rangeOption,
        ifModifiedSince: ifModifiedSinceOption,
        ifNoneMatch,
        headRequest: head
      }
    );
    
    // Format and display the response
    console.log("\n=== WTTP Response ===");
    console.log(`Status: ${response.status}`);
    
    if (response.metadata) {
      console.log("\n=== Metadata ===");
      console.log(`MIME Type: ${hre.ethers.toUtf8String(response.metadata.mimeType)}`);
      console.log(`Charset: ${hre.ethers.toUtf8String(response.metadata.charset)}`);
      console.log(`Encoding: ${hre.ethers.toUtf8String(response.metadata.encoding)}`);
      console.log(`Language: ${hre.ethers.toUtf8String(response.metadata.language)}`);
      console.log(`Size: ${response.metadata.size} bytes`);
      console.log(`Version: ${response.metadata.version}`);
      console.log(`Last Modified: ${new Date(Number(response.metadata.lastModified) * 1000).toISOString()}`);
    }
    
    if (response.etag) {
      console.log(`ETag: ${response.etag}`);
    }
    
    if (response.content) {
      console.log("\n=== Content ===");
      // If content is too large, truncate it
      const maxContentLength = 1000;
      if (response.content.length > maxContentLength) {
        console.log(`${response.content.substring(0, maxContentLength)}... (truncated, ${response.content.length} bytes total)`);
      } else {
        console.log(response.content);
      }
    }
    
    return response;
  });

export default {};