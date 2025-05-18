// Import ethers from the hardhat runtime environment when running
// but allow direct import from ethers package when imported
import type { WTTPGatewayV3 } from "../typechain-types";
import type { ethers } from "ethers";

/**
 * Fetches a resource from a WTTP site via the WTTPGateway
 * 
 * @param gateway - The WTTPGateway contract instance
 * @param site - The address of the WTTP site
 * @param path - The path to the resource
 * @param options - Optional parameters for the request
 * @returns The response from the gateway
 */
export async function fetchResource(
  gateway: WTTPGatewayV3,
  site: string,
  path: string,
  options: {
    range?: { start: number, end: number },
    ifModifiedSince?: number,
    ifNoneMatch?: string,
    headRequest?: boolean
  } = {}
) {
  // Default options
  const { range, ifModifiedSince = 0, ifNoneMatch = ethers.ZeroHash, headRequest = false } = options;

  // Create the base request
  const requestLine = {
    path: path,
    protocol: "WTTP/3.0",
    method: headRequest ? 0 : 1 // HEAD = 0, GET = 1
  };

  // Create the head request
  const head = {
    requestLine,
    ifModifiedSince,
    ifNoneMatch
  };

  // If it's a HEAD request, just call HEAD
  if (headRequest) {
    console.log(`Sending HEAD request for ${path}`);
    return gateway.HEAD(site, { requestLine: head.requestLine, ifModifiedSince, ifNoneMatch });
  }

  // Otherwise, create a GET request
  const getRequest = {
    head,
    rangeBytes: range ? {
      start: range.start,
      end: range.end
    } : {
      start: 0,
      end: 0
    }
  };

  console.log(`Fetching resource at ${path}${range ? ` with range ${range.start}-${range.end}` : ''}`);
  const response = await gateway.GET(site, getRequest);

  // Log the response status
  console.log(`Response status: ${response.head.responseLine.code}`);
  
  return response;
}

/**
 * Main function to fetch a resource
 */
export async function main(
  hre: any,
  gatewayAddress: string,
  siteAddress: string,
  path: string,
  options: {
    range?: { start: number, end: number },
    ifModifiedSince?: number,
    ifNoneMatch?: string,
    headRequest?: boolean
  } = {}
) {
  // Connect to the gateway contract
  const gateway = await hre.ethers.getContractAt("WTTPGatewayV3", gatewayAddress);
  
  // Fetch the resource
  const response = await fetchResource(gateway, siteAddress, path, options);
  
  // If it's a HEAD request, just return the metadata
  if (options.headRequest) {
    return {
      status: response.responseLine.code,
      metadata: response.metadata,
      etag: response.etag
    };
  }
  
  // For GET requests, return the data as well
  let content: string | null = null;
  if (response.head.responseLine.code === 200 || response.head.responseLine.code === 206) {
    // Convert the response data to a string if it's text
    const mimeType = response.head.metadata.mimeType;
    const isText = hre.ethers.toUtf8String(mimeType) === "tp"; // text/plain
    
    if (isText) {
      content = hre.ethers.toUtf8String(response.data);
    } else {
      content = `<Binary data: ${response.data.length} bytes>`;
    }
  }
  
  return {
    status: response.head.responseLine.code,
    metadata: response.head.metadata,
    etag: response.head.etag,
    content,
    rawData: response.data
  };
}
