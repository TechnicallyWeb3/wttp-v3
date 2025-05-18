import { expect } from "chai";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { uploadFile } from "../scripts/uploadFile";
import { fetchResource } from "../scripts/fetchResource";
import { Web3Site, WTTPGatewayV3 } from "../typechain-types";

const { ethers } = hre;

describe("Fetch Resource Tests", function () {
  // Test file path
  const testFilePath = path.join(__dirname, "test-fetch-file.txt");
  const testFileContent = "This is a test file for WTTP fetch functionality.\n".repeat(10);
  const destinationPath = "/test-fetch-file.txt";
  
  // Contracts
  let wtppSite: Web3Site;
  let gateway: WTTPGatewayV3;
  
  before(async function () {
    // Create a test file
    fs.writeFileSync(testFilePath, testFileContent);
    
    // Deploy contracts
    const DataPointStorage = await ethers.getContractFactory("DataPointStorageV2");
    const dataPointStorage = await DataPointStorage.deploy();
    
    const [owner] = await ethers.getSigners();
    const royaltyRate = ethers.parseEther("0.0001"); // 0.01% royalty rate
    
    const DataPointRegistry = await ethers.getContractFactory("DataPointRegistryV2");
    const dataPointRegistry = await DataPointRegistry.deploy(
      owner.address,
      dataPointStorage.target,
      royaltyRate
    );
    
    // Default header configuration
    const DEFAULT_HEADER = {
      methods: 511, // All methods allowed
      cache: {
        maxAge: 3600,
        noStore: false,
        noCache: false,
        immutableFlag: false,
        publicFlag: true
      },
      redirect: {
        code: 0,
        location: ""
      },
      resourceAdmin: ethers.ZeroHash
    };
    
    const WTTPSite = await ethers.getContractFactory("Web3Site");
    wtppSite = await WTTPSite.deploy(
      dataPointRegistry.target,
      DEFAULT_HEADER,
      owner.address
    );

    // Deploy Gateway
    const WTTPGateway = await ethers.getContractFactory("WTTPGatewayV3");
    gateway = await WTTPGateway.deploy();
    
    // Upload the test file
    await uploadFile(wtppSite, testFilePath, destinationPath);
  });
  
  after(function () {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
  
  it("Should fetch the entire resource", async function () {
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath);
    
    expect(response.head.responseLine.code).to.equal(200);
    expect(ethers.toUtf8String(response.data)).to.equal(testFileContent);
  });
  
  it("Should fetch a range of bytes from the resource", async function () {
    const start = 10;
    const end = 20;
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath, {
      range: { start, end }
    });
    
    expect(response.head.responseLine.code).to.equal(206); // Partial Content
    expect(ethers.toUtf8String(response.data)).to.equal(testFileContent.substring(start, end));
  });
  
  it("Should handle negative range indices", async function () {
    const start = -10; // Last 10 bytes
    const end = 0;     // To the end
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath, {
      range: { start, end }
    });
    
    expect(response.head.responseLine.code).to.equal(206); // Partial Content
    expect(ethers.toUtf8String(response.data)).to.equal(testFileContent.slice(testFileContent.length + start));
  });
  
  it("Should return 416 for out of bounds range", async function () {
    const start = testFileContent.length + 100; // Way beyond the end
    const end = start + 10;
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath, {
      range: { start, end }
    });
    
    expect(response.head.responseLine.code).to.equal(416); // Range Not Satisfiable
  });
  
  it("Should handle HEAD requests", async function () {
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath, {
      headRequest: true
    });
    
    expect(response.responseLine.code).to.equal(200);
    expect(response.metadata.size).to.equal(testFileContent.length);
    // No data should be returned for HEAD requests
    expect(response.data).to.be.undefined;
  });
  
  it("Should handle If-Modified-Since condition", async function () {
    // For this test, we'll just verify that the request goes through
    // Note: The actual 304 behavior would need to be mocked or tested in a contract test
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath, {
      ifModifiedSince: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    });
    
    // Should return 200 OK since the resource was modified after our timestamp
    expect(response.head.responseLine.code).to.equal(200);
  });
  
  it("Should handle If-None-Match condition", async function () {
    // For this test, we'll just verify that the request goes through
    // Note: The actual 304 behavior would need to be mocked or tested in a contract test
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath, {
      ifNoneMatch: ethers.randomBytes(32) // Random ETag that won't match
    });
    
    // Should return 200 OK since the ETag doesn't match
    expect(response.head.responseLine.code).to.equal(200);
  });
});