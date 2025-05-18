import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { Web3Site } from "../typechain-types";
import { uploadDirectory } from "../scripts/uploadDirectory";
import { uploadFile } from "../scripts/uploadFile";

describe("Directory Upload Tests", function () {
  let wtppSite: Web3Site;
  const testDirPath = path.join(__dirname, "test-directory");
  const testSubDirPath = path.join(testDirPath, "subdir");
  const destinationPath = "/test-dir/";

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

    // Create test directories and files
    createTestDirectories();
  });

  after(function () {
    // Clean up test directories
    cleanupTestDirectories();
  });

  it("should upload a directory with index.html", async function () {
    // Upload the directory
    await uploadDirectory(wtppSite, testDirPath, destinationPath);

    // Check if the directory was uploaded correctly
    const WTTP_VERSION = "WTTP/3.0";
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
    
    // Check if the directory exists
    expect(headResponse.responseLine.code).to.not.equal(404n);
    
    // Check if the directory has the correct status code (200 for HEAD request)
    expect(headResponse.responseLine.code).to.equal(200n);
    
    // Check metadata
    expect(headResponse.metadata.mimeType).to.equal("0x0001");
    expect(headResponse.metadata.charset).to.equal("0x0000");
    expect(headResponse.metadata.encoding).to.equal("0x0000");
    expect(headResponse.metadata.language).to.equal("0x0000");
  });

  it("should upload all files in the directory", async function () {
    // Check if index.html was uploaded
    const indexHeadRequest = {
      requestLine: {
        protocol: "WTTP/3.0",
        path: destinationPath + "index.html",
        method: 1 // HEAD
      },
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const indexHeadResponse = await wtppSite.HEAD(indexHeadRequest);
    expect(indexHeadResponse.responseLine.code).to.not.equal(404n);
    
    // Check if styles.css was uploaded
    const cssHeadRequest = {
      requestLine: {
        protocol: "WTTP/3.0",
        path: destinationPath + "styles.css",
        method: 1 // HEAD
      },
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const cssHeadResponse = await wtppSite.HEAD(cssHeadRequest);
    expect(cssHeadResponse.responseLine.code).to.not.equal(404n);
  });

  it("should upload subdirectories", async function () {
    // Check if the subdirectory was uploaded
    const subdirHeadRequest = {
      requestLine: {
        protocol: "WTTP/3.0",
        path: destinationPath + "subdir/",
        method: 1 // HEAD
      },
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const subdirHeadResponse = await wtppSite.HEAD(subdirHeadRequest);
    expect(subdirHeadResponse.responseLine.code).to.not.equal(404n);
    
    // Check if the file in the subdirectory was uploaded
    const jsHeadRequest = {
      requestLine: {
        protocol: "WTTP/3.0",
        path: destinationPath + "subdir/test.js",
        method: 1 // HEAD
      },
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const jsHeadResponse = await wtppSite.HEAD(jsHeadRequest);
    expect(jsHeadResponse.responseLine.code).to.not.equal(404n);
  });

  it("should handle a directory without index.html", async function () {
    // Create a new test directory without index.html
    const noIndexDirPath = path.join(__dirname, "test-no-index");
    const noIndexDestPath = "/test-no-index/";
    
    if (!fs.existsSync(noIndexDirPath)) {
      fs.mkdirSync(noIndexDirPath, { recursive: true });
    }
    
    // Create a test file that's not index.html
    fs.writeFileSync(path.join(noIndexDirPath, "main.js"), "console.log('No index');");
    
    // Upload the directory
    await uploadDirectory(wtppSite, noIndexDirPath, noIndexDestPath);
    
    // Check if the directory was uploaded correctly
    const headRequest = {
      requestLine: {
        protocol: "WTTP/3.0",
        path: noIndexDestPath,
        method: 1 // HEAD
      },
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const headResponse = await wtppSite.HEAD(headRequest);
    
    // Check if the directory exists
    expect(headResponse.responseLine.code).to.not.equal(404n);
    
    // Check if the directory has the correct status code (200 for HEAD request)
    expect(headResponse.responseLine.code).to.equal(200n);
    
    // Clean up
    fs.rmSync(noIndexDirPath, { recursive: true, force: true });
  });

  it("should integrate with the upload task", async function () {
    // This test would normally use the Hardhat task runner
    // Since we can't easily test the task runner directly, we'll simulate it
    
    // Create a new test directory for task testing
    const taskTestDirPath = path.join(__dirname, "task-test-dir");
    const taskTestDestPath = "/task-test/";
    
    if (!fs.existsSync(taskTestDirPath)) {
      fs.mkdirSync(taskTestDirPath, { recursive: true });
    }
    
    // Create a test file
    fs.writeFileSync(path.join(taskTestDirPath, "task-test.txt"), "Task test content");
    
    // Simulate the task by checking if the path is a directory and calling the appropriate function
    const isDirectory = fs.statSync(taskTestDirPath).isDirectory();
    
    if (isDirectory) {
      await uploadDirectory(wtppSite, taskTestDirPath, taskTestDestPath);
    } else {
      await uploadFile(wtppSite, taskTestDirPath, taskTestDestPath);
    }
    
    // Check if the directory was uploaded correctly
    const headRequest = {
      requestLine: {
        protocol: "WTTP/3.0",
        path: taskTestDestPath,
        method: 1 // HEAD
      },
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const headResponse = await wtppSite.HEAD(headRequest);
    expect(headResponse.responseLine.code).to.not.equal(404n);
    
    // Clean up
    fs.rmSync(taskTestDirPath, { recursive: true, force: true });
  });
});
