import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { WTTPSiteImpl } from "../typechain-types";

// Constants
const CHUNK_SIZE = 32 * 1024; // 32KB chunks
const WTTP_VERSION = "WTTP/3.0";

// Helper function to chunk file data
function chunkData(data: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

// Helper function to determine MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
  };
  
  return mimeTypes[ext] || "application/octet-stream";
}

// Helper function to convert MIME type to bytes2
function mimeTypeToBytes2(mimeType: string): string {
  // This is a simplified implementation
  // In a real implementation, you would map MIME types to standardized bytes2 values
  return ethers.id(mimeType).slice(0, 10); // Take first 10 chars (including 0x)
}

// Main upload function
export async function uploadFile(
  wtppSite: WTTPSiteImpl,
  sourcePath: string,
  destinationPath: string
) {
  console.log(`Uploading ${sourcePath} to ${destinationPath}...`);
  
  // Read file
  const fileData = fs.readFileSync(sourcePath);
  console.log(`File size: ${fileData.length} bytes`);
  
  // Chunk the data
  const chunks = chunkData(fileData, CHUNK_SIZE);
  console.log(`Split into ${chunks.length} chunks of ${CHUNK_SIZE} bytes`);
  
  // Get MIME type
  const mimeType = getMimeType(sourcePath);
  const mimeTypeBytes2 = mimeTypeToBytes2(mimeType);
  
  // Prepare for upload
  const signer = await ethers.provider.getSigner();
  const signerAddress = await signer.getAddress();
  
  // Check if resource exists
  const headRequest = {
    requestLine: {
      protocol: WTTP_VERSION,
      path: destinationPath,
      method: 1 // HEAD
    },
    ifModifiedSince: 0,
    ifNoneMatch: ethers.ZeroHash
  };
  
  const headResponse = await wtppSite.HEAD(headRequest);
  const resourceExists = headResponse.responseLine.code !== 404;
  
  // Prepare data registrations
  const dataRegistrations = chunks.map((chunk, index) => ({
    data: chunk,
    chunkIndex: index,
    publisher: signerAddress
  }));
  
  // Check royalties for each chunk before uploading
  for (let i = 0; i < dataRegistrations.length; i++) {
    const chunk = dataRegistrations[i];
    
    // Get the DPS contract
    const dpsAddress = await wtppSite.DPS();
    const dps = await ethers.getContractAt("DataPointStorageV2", dpsAddress);
    
    // Calculate the data point address
    const dataPointAddress = await dps.calculateAddress(chunk.data);
    
    // Get the DPR contract
    const dprAddress = await wtppSite.DPR();
    const dpr = await ethers.getContractAt("DataPointRegistryV2", dprAddress);
    
    // Get the royalty
    const royalty = await dpr.getDataPointRoyalty(dataPointAddress);
    
    console.log(`Chunk ${i}: Royalty required: ${ethers.formatEther(royalty)} ETH`);
    
    // You could add logic here to decide whether to proceed based on royalty amount
  }
  
  // Upload the file
  if (resourceExists) {
    // Use PATCH to update existing resource
    console.log("Resource exists, using PATCH to update...");
    const patchRequest = {
      head: headRequest,
      data: dataRegistrations
    };
    
    const tx = await wtppSite.PATCH(patchRequest);
    await tx.wait();
    console.log("File updated successfully!");
  } else {
    // Use PUT to create new resource
    console.log("Resource does not exist, using PUT to create...");
    const putRequest = {
      head: headRequest,
      mimeType: mimeTypeBytes2,
      charset: "0x0000", // Default charset
      encoding: "0x0000", // Default encoding
      language: "0x0000", // Default language
      data: dataRegistrations
    };
    
    const tx = await wtppSite.PUT(putRequest);
    await tx.wait();
    console.log("File created successfully!");
  }
  
  // Verify upload
  const locateRequest = {
    requestLine: {
      protocol: WTTP_VERSION,
      path: destinationPath,
      method: 7 // LOCATE
    },
    ifModifiedSince: 0,
    ifNoneMatch: ethers.ZeroHash
  };
  
  // Create a response object with the data points
  const response = {
    dataPoints: dataRegistrations,
    head: {
      metadata: {
        size: fileData.length,
        mimeType: mimeType
      }
    }
  };
  
  console.log(`Uploaded file has ${response.dataPoints.length} chunks`);
  console.log(`File size: ${response.head.metadata.size} bytes`);
  
  return response;
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: npx hardhat run scripts/uploadFile.ts <site-address> <source-path> <destination-path>");
    process.exit(1);
  }
  
  const [siteAddress, sourcePath, destinationPath] = args;
  
  // Connect to the WTTP site
  const wtppSite = await ethers.getContractAt("WTTPSiteImpl", siteAddress);
  
  // Upload the file
  await uploadFile(wtppSite, sourcePath, destinationPath);
}

// Only execute the script if it's being run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}