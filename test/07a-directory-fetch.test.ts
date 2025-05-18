import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { Web3Site, WTTPGatewayV3 } from "../typechain-types";
import { uploadDirectory } from "../scripts/uploadDirectory";
import { fetchResource } from "../scripts/fetchResource";

describe("Directory Fetch Tests", function () {
  let wtppSite: Web3Site;
  let gateway: WTTPGatewayV3;
  const testDirPath = path.join(__dirname, "test-dir-fetch");
  const testSubDirPath = path.join(testDirPath, "subdir");
  const destinationPath = "/test-dir-fetch/";

  // Helper function to create test directories and files
  function createTestDirectories() {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDirPath)) {
      fs.mkdirSync(testDirPath, { recursive: true });
    }

    // Create subdirectory if it doesn't exist
    if (!fs.existsSync(testSubDirPath)) {
      fs.mkdirSync(testSubDirPath, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(path.join(testDirPath, "index.html"), "<html><body>Test Index</body></html>");
    fs.writeFileSync(path.join(testDirPath, "styles.css"), "body { color: red; }");
    fs.writeFileSync(path.join(testSubDirPath, "test.js"), "console.log('Hello World');");
  }

  // Helper function to clean up test directories
  function cleanupTestDirectories() {
    if (fs.existsSync(testDirPath)) {
      fs.rmSync(testDirPath, { recursive: true, force: true });
    }
  }

  before(async function () {
    // Deploy the contracts
    const DataPointStorageFactory = await ethers.getContractFactory("DataPointStorageV2");
    const dataPointStorage = await DataPointStorageFactory.deploy();

    const [owner] = await ethers.getSigners();
    const DataPointRegistryFactory = await ethers.getContractFactory("DataPointRegistryV2");
    const dataPointRegistry = await DataPointRegistryFactory.deploy(
      owner.address,
      await dataPointStorage.getAddress(),
      0 // royalty rate
    );

    const Web3SiteFactory = await ethers.getContractFactory("Web3Site");
    const defaultHeader = {
      methods: 65535, // All methods allowed (2^16 - 1)
      cache: {
        maxAge: 0,
        noStore: false,
        noCache: false,
        immutableFlag: false,
        publicFlag: false
      },
      redirect: {
        code: 0,
        location: ""
      },
      resourceAdmin: ethers.ZeroHash
    };
    
    wtppSite = await Web3SiteFactory.deploy(
      await dataPointRegistry.getAddress(),
      defaultHeader,
      owner.address
    );

    // Deploy the gateway
    const GatewayFactory = await ethers.getContractFactory("WTTPGatewayV3");
    gateway = await GatewayFactory.deploy();

    // Create test directories and files
    createTestDirectories();

    // Upload the directory
    await uploadDirectory(wtppSite, testDirPath, destinationPath);
  });

  after(function () {
    // Clean up test directories
    cleanupTestDirectories();
  });

  it("should fetch a directory and verify it has the correct mime type", async function () {
    // Fetch the directory
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath);
    
    // Log the response structure to debug
    console.log("Response metadata mimeType:", response.head.metadata.mimeType);
    console.log("Response code:", response.head.responseLine.code.toString());
    
    // Check the response
    // For directories, the mime type should be 0x0001
    expect(response.head.metadata.mimeType).to.equal("0x0001"); // Directory mime type
  });

  it("should fetch a subdirectory and verify it has the correct mime type", async function () {
    // Fetch the subdirectory
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath + "subdir/");
    
    // Check the response
    // For directories, the mime type should be 0x0001
    expect(response.head.metadata.mimeType).to.equal("0x0001"); // Directory mime type
  });

  it("should upload the same directory twice without failing", async function () {
    // Upload the directory again
    await uploadDirectory(wtppSite, testDirPath, destinationPath);
    
    // Fetch the directory
    const response = await fetchResource(gateway, await wtppSite.getAddress(), destinationPath);
    
    // Check the response
    // For directories, the mime type should be 0x0001
    expect(response.head.metadata.mimeType).to.equal("0x0001"); // Directory mime type
  });
});
