import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { uploadFile } from "../scripts/uploadFile";
import { Web3Site } from "../typechain-types";

describe("File Upload Tests", function () {
  // Test file path
  const testFilePath = path.join(__dirname, "test-file.txt");
  const testFileContent = "This is a test file for WTTP file upload functionality.\n".repeat(100);
  const destinationPath = "/test-file.txt";
  
  // Contracts
  let wtppSite: Web3Site;
  
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
  });
  
  after(function () {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
  
  it("Should deploy the WTTP site correctly", async function () {
    expect(await wtppSite.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
  
  it("Should upload a file to the WTTP site", async function () {
    // Upload the file
    const response = await uploadFile(wtppSite, testFilePath, destinationPath);
    
    // Verify the upload
    expect(response.dataPoints.length).to.be.greaterThan(0);
    expect(response.head.metadata.size).to.equal(testFileContent.length);
  });
  
  it("Should update an existing file on the WTTP site", async function () {
    await uploadFile(wtppSite, testFilePath, destinationPath);
    // Modify the test file
    const updatedContent = testFileContent + "Updated content.\n";
    fs.writeFileSync(testFilePath, updatedContent);
    
    // Upload the updated file
    const response = await uploadFile(wtppSite, testFilePath, destinationPath);
    
    // Verify the update
    expect(response.dataPoints.length).to.be.greaterThan(0);
    expect(response.head.metadata.size).to.equal(updatedContent.length);
  });
  
});