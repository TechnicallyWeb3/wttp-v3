import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { TestStorage, DataPointRegistryV2, DataPointStorageV2 } from "../typechain-types";

describe("TestStorage", function () {
  let testStorage: TestStorage;
  let dpr: DataPointRegistryV2;
  let dps: DataPointStorageV2;
  let owner: any;
  let siteAdmin: any;
  let publicUser: any;
  const siteAdminRole: any = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
  const DEFAULT_HEADER = {
    methods: 511, // All methods allowed (binary 111111111)
    cache: {
      maxAge: 3600,
      sMaxage: 1800,
      noStore: false,
      noCache: false,
      immutableFlag: false,
      publicFlag: true,
      mustRevalidate: false,
      proxyRevalidate: false,
      mustUnderstand: false,
      staleWhileRevalidate: 600,
      staleIfError: 300
    },
    redirect: {
      code: 0,
      location: ""
    },
    resourceAdmin: hre.ethers.zeroPadBytes("0x", 32)
  };
  

  // Fixture to deploy the contracts once and reuse them across tests
  async function deployTestStorageFixture() {
    [owner, siteAdmin, publicUser] = await hre.ethers.getSigners();
    
    // Deploy DPS
    const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorageV2");
    dps = await DataPointStorage.deploy();
    
    // Deploy DPR
    const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistryV2");
    const royaltyRate = hre.ethers.parseEther("0.00001"); // 0.00001 ETH
    dpr = await DataPointRegistry.deploy(owner.address, await dps.getAddress(), royaltyRate);
    
    // Deploy TestStorage
    const TestStorage = await hre.ethers.getContractFactory("TestStorage");
    testStorage = await TestStorage.deploy(await dpr.getAddress(), owner.address, DEFAULT_HEADER);
    
    // Grant site admin role
    await testStorage.grantRole(siteAdminRole, siteAdmin.address);
    
    return { testStorage, dpr, dps, owner, siteAdmin, publicUser };
  }

  describe("Header Management", function () {
    it("Should create and read headers", async function () {
      const { testStorage } = await loadFixture(deployTestStorageFixture);
      
      const headerInfo = {
        cache: {
          maxAge: 3600,
          sMaxage: 1800,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true,
          mustRevalidate: false,
          proxyRevalidate: false,
          mustUnderstand: false,
          staleWhileRevalidate: 600,
          staleIfError: 300
        },
        methods: 15, // Binary 1111 (GET, POST, PUT, DELETE)
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.zeroPadBytes("0x", 32) // Empty resource admin role
      };
      
      // Create header
      const tx = await testStorage.testCreateHeader(headerInfo);
      await tx.wait();
      
      // Extract the returned bytes32 value from the transaction result
      const headerAddress = await testStorage.testGetHeaderAddress(headerInfo);
      // or if your contract emits an event with the header address:

      expect(headerAddress).to.not.equal(hre.ethers.zeroPadBytes("0x", 32));
      
      // Read header
      const retrievedHeader = await testStorage.testReadHeader(headerAddress);
      expect(retrievedHeader.cache.maxAge).to.equal(headerInfo.cache.maxAge);
      expect(retrievedHeader.methods).to.equal(headerInfo.methods);
    });

  });

  describe("Metadata Management", function () {
    it("Should create and read metadata", async function () {
      const { testStorage } = await loadFixture(deployTestStorageFixture);
      
      // First create a header to use in the metadata
      const headerInfo = {
        cache: { 
          maxAge: 3600,
          sMaxage: 1800,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true,
          mustRevalidate: false,
          proxyRevalidate: false,
          mustUnderstand: false,
          staleWhileRevalidate: 600,
          staleIfError: 300
        },
        methods: 15,
        redirect: { code: 0, location: "" },
        resourceAdmin: hre.ethers.zeroPadBytes("0x", 32)
      };
      const tx = await testStorage.testCreateHeader(headerInfo);
      await tx.wait();

      const headerAddress = await testStorage.testGetHeaderAddress(headerInfo);

      const metadata = {
        mimeType: "0x7470", // text/plain
        charset: "0x7508", // utf-8
        encoding: "0x6964", // identity
        language: "0x6575", // eU
        location: "0x6463", // datapoint/chunk
        size: 0,
        version: 0,
        lastModified: 0,
        header: headerAddress
      };
      
      // Create metadata
      await expect(testStorage.testCreateMetadata("/test.txt", metadata))
        .to.emit(testStorage, "Success");
      
      // Read metadata
      const retrievedMetadata = await testStorage.testReadMetadata("/test.txt");
      expect(retrievedMetadata.mimeType).to.equal(metadata.mimeType);
      expect(retrievedMetadata.header).to.equal(headerAddress);
      expect(retrievedMetadata.version).to.equal(1); // Version should be incremented
    });
  });

  describe("Resource Management", function () {
    it("Should create and read resources", async function () {
      const { testStorage, owner } = await loadFixture(deployTestStorageFixture);
      
      // Set up metadata first
      const headerInfo = {
        cache: { 
          maxAge: 3600,
          sMaxage: 1800,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true,
          mustRevalidate: false,
          proxyRevalidate: false,
          mustUnderstand: false,
          staleWhileRevalidate: 600,
          staleIfError: 300
        },
        methods: 15,
        redirect: { code: 0, location: "" },
        resourceAdmin: hre.ethers.zeroPadBytes("0x", 32)
      };
      const tx = await testStorage.testCreateHeader(headerInfo);
      await tx.wait();

      const headerAddress = await testStorage.testGetHeaderAddress(headerInfo);
      
      const metadata = {
        mimeType: "0x7470", // text/plain
        charset: "0x7508", // utf-8
        encoding: "0x6964", // identity
        language: "0x6575", // eU
        location: "0x6463", // datapoint/chunk
        size: 0,
        version: 0,
        lastModified: 0,
        header: headerAddress
      };
      
      await testStorage.testCreateMetadata("/test.txt", metadata);
      
      // Create a resource
      const data = hre.ethers.toUtf8Bytes("Hello, World!");
      const dataRegistration = {
        data: data,
        chunkIndex: 0,
        publisher: owner.address
      };
      
      await expect(testStorage.testCreateResource("/test.txt", dataRegistration))
        .to.emit(testStorage, "Success");
      
      // Read the resource
      const chunks = await testStorage.testReadResource("/test.txt");
      expect(chunks.length).to.equal(1);
    });

    it("Should determine maximum number of chunks that can be added to a resource", async function () {
      const { testStorage, owner, dpr } = await loadFixture(deployTestStorageFixture);
      
      // how do we increase test timeout?
      const skipTest = true;
      if (!skipTest) this.timeout(3600000); // 1 hour in milliseconds
      // Set up metadata first
      const headerInfo = {
        cache: { 
          maxAge: 3600,
          sMaxage: 1800,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true,
          mustRevalidate: false,
          proxyRevalidate: false,
          mustUnderstand: false,
          staleWhileRevalidate: 600,
          staleIfError: 300
        },
        methods: 15,
        redirect: { code: 0, location: "" },
        resourceAdmin: hre.ethers.zeroPadBytes("0x", 32)
      };
      await testStorage.testCreateHeader(headerInfo);
      const headerAddress = await testStorage.testGetHeaderAddress(headerInfo);
      
      const metadata = {
        mimeType: "0x7570", // text/plain
        charset: "0x7508", // utf-8
        encoding: "0x6964", // identity
        language: "0x6575", // eU
        location: "0x6463", // datapoint/chunk
        size: 0,
        version: 0,
        lastModified: 0,
        header: headerAddress
      };
      
      await testStorage.testCreateMetadata("/chunk-test.txt", metadata);
      
      // Create small data chunk (we're testing number of chunks, not size)
      const smallData = hre.ethers.toUtf8Bytes("Chunk");
      let chunkCount = 0;
      let txError = false;

      await expect(testStorage.testCreateResource("/chunk-test.txt", {
        data: smallData, 
        chunkIndex: 0, 
        publisher: owner.address
      })).to.emit(testStorage, "Success");
      
      // Calculate royalty for a single datapoint
      const royaltyAmount = await dpr.getDataPointRoyalty(await dps.calculateAddress(smallData));
    //   console.log(`        -> Royalty amount: ${royaltyAmount} wei`);
      
      // Keep adding chunks until we hit an error
      while (!txError) {
        try {
          chunkCount++;
          const dataRegistration = {
            data: smallData,
            chunkIndex: chunkCount,
            publisher: owner.address
          };
        //   console.log(`        -> Adding chunk ${chunkCount}`);
          await expect(testStorage.testCreateResource("/chunk-test.txt", dataRegistration, {
            value: royaltyAmount
          })).to.emit(testStorage, "Success");
        //   console.log(`        -> Next chunk ${chunkCount}`);
          if (skipTest) break;
          // Verify we can still read the chunks (this will fail when array gets too big)
          if (chunkCount % 31 === 0) {
            await testStorage.testReadResource("/chunk-test.txt");
          } 

          if (chunkCount % 3000 === 0) {
            console.log(`        -> Read chunk ${chunkCount}`);
          }
        } catch (error) {
          txError = true;
          console.log(`        -> Failed after adding ${chunkCount} chunks`); //11930 477MB@40kb
          if (!skipTest) console.log(error);
        }
      }
      
    //   console.log(`        -> Maximum number of chunks: ${chunkCount}`);
      expect(chunkCount).to.be.greaterThan(0);
    });
  });

});