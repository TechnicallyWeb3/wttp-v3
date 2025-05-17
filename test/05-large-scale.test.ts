import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { WTTPSiteV3, DataPointRegistryV2, DataPointStorageV2, WTTPGatewayV3 } from "../typechain-types";

describe("WTTPGateway Large-Scale Testing", function () {
  // Set timeout to 12 hours
  this.timeout(12 * 60 * 60 * 1000); // 12 hours in milliseconds

  // Constants for the test
  const CHUNK_SIZE = 40 * 1024; // 40kb per chunk 
  const TARGET_CHUNKS = 11925; // Target number of chunks, near the observed limit
  const TEST_PATH = "/large-scale-test";
  
  let dps: DataPointStorageV2;
  let dpr: DataPointRegistryV2;
  let wttpSite: WTTPSiteV3;
  let gateway: WTTPGatewayV3;
  let owner: any;
  let siteAdmin: any;
  
  const siteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
  const DEFAULT_HEADER = {
    methods: 511, // All methods enabled
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
    resourceAdmin: hre.ethers.zeroPadBytes("0x", 32) // siteAdmin
  };

  // Fixture to deploy contracts
  async function deployWTTPGatewayFixture() {
    const [owner, siteAdmin, publicUser] = await hre.ethers.getSigners();

    // Deploy DataPointStorage
    const dataPointStorageFactory = await hre.ethers.getContractFactory("DataPointStorageV2");
    dps = await dataPointStorageFactory.deploy();

    // Deploy DataPointRegistry
    const dataPointRegistryFactory = await hre.ethers.getContractFactory("DataPointRegistryV2");
    dpr = await dataPointRegistryFactory.deploy(owner.address, dps.target, 1000000n);

    // Deploy WTTPSite
    const wttpSiteFactory = await hre.ethers.getContractFactory("TestSite");
    wttpSite = await wttpSiteFactory.deploy(
      dpr.target,
      owner.address,
      DEFAULT_HEADER
    );

    // Grant role to siteAdmin
    await wttpSite.grantRole(siteAdminRole, siteAdmin.address);
    expect(await wttpSite.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;

    // Deploy WTTPGateway
    const wttpGatewayFactory = await hre.ethers.getContractFactory("WTTPGatewayV3");
    gateway = await wttpGatewayFactory.deploy();

    return { dpr, dps, wttpSite, gateway, owner, siteAdmin, publicUser };
  }

  // Helper function to generate a chunk of fixed size
  function generateChunk(index: number, size: number = CHUNK_SIZE): Uint8Array {
    const data = new Uint8Array(size);
    // Add some identifiable content (index at the beginning)
    const indexString = `Chunk ${index}: `;
    const indexBuffer = new TextEncoder().encode(indexString);
    
    // Copy index string to start of data
    for (let i = 0; i < indexBuffer.length; i++) {
      data[i] = indexBuffer[i];
    }
    
    // Fill rest with random data
    for (let i = indexBuffer.length; i < size; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    
    return data;
  }

  // Helper to calculate total royalty for multiple chunks
  async function calculateTotalRoyalty(chunks: Uint8Array[]): Promise<bigint> {
    let totalRoyalty = 0n;
    
    for (const chunk of chunks) {
      const dataPointAddress = await dps.calculateAddress(chunk);
      const royalty = await dpr.getDataPointRoyalty(dataPointAddress);
      totalRoyalty += royalty;
    }
    
    // Add some buffer for gas fluctuations
    return totalRoyalty * 110n / 100n; // 10% buffer
  }

  // Helper function to create a resource with header
  async function defineResource(path: string) {
    const defineRequest = {
      data: DEFAULT_HEADER,
      head: {
        requestLine: {
          path: path,
          protocol: "WTTP/3.0",
          method: 8 // DEFINE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      }
    };
    
    await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
    console.log(`Defined resource at path: ${path}`);
  }

  // Helper function to upload chunks in batches
  async function uploadChunksInBatches(siteAdmin: SignerWithAddress, path: string, totalChunks: number, batchSize: number = 10) {
    console.log(`Starting upload of ${totalChunks} chunks (${(totalChunks * CHUNK_SIZE) / (1024 * 1024)} MB total)`);
    
    const startTime = Date.now();
    let processedChunks = 0;
    
    while (processedChunks < totalChunks) {
      const batchCount = Math.min(batchSize, totalChunks - processedChunks);
      const chunkBatch = [];
      
      for (let i = 0; i < batchCount; i++) {
        const chunkIndex = processedChunks + i;
        const chunkData = generateChunk(chunkIndex);
        
        chunkBatch.push({
          data: chunkData,
          publisher: siteAdmin.address,
          chunkIndex: chunkIndex
        });
      }
      
      // Calculate royalty for this batch
      const totalRoyalty = await calculateTotalRoyalty(chunkBatch.map(item => item.data));
      
      // Create PUT request for this batch
      const putRequest = {
        head: {
          requestLine: {
            path: path,
            protocol: "WTTP/3.0",
            method: 3 // PUT for first batch, PATCH for subsequent batches
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470", // text/plain
        charset: "0x7538", // utf-8
        encoding: "0x6964", // identity
        language: "0x6575", // en-US
        location: "0x6463", // default
        data: chunkBatch
      };
      
      // Use PUT for first batch, PATCH for subsequent batches
      if (processedChunks === 0) {
        await wttpSite.connect(siteAdmin).PUT(putRequest, { value: totalRoyalty });
      } else {
        const patchRequest = {
          head: putRequest.head,
          data: putRequest.data
        };
        patchRequest.head.requestLine.method = 4; // PATCH
        await wttpSite.connect(siteAdmin).PATCH(patchRequest, { value: totalRoyalty });
      }
      
      processedChunks += batchCount;
      
      // Log progress every 100 chunks
      if (processedChunks % 100 === 0 || processedChunks === totalChunks) {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const chunksPerSecond = processedChunks / elapsedSeconds;
        const estimatedTotalTime = totalChunks / chunksPerSecond;
        const estimatedRemainingTime = estimatedTotalTime - elapsedSeconds;
        
        console.log(`Uploaded ${processedChunks}/${totalChunks} chunks (${(processedChunks * 100 / totalChunks).toFixed(2)}%)`);
        console.log(`Elapsed time: ${formatTime(elapsedSeconds)}`);
        console.log(`Estimated time remaining: ${formatTime(estimatedRemainingTime)}`);
        console.log(`Upload speed: ${chunksPerSecond.toFixed(2)} chunks/second (${((chunksPerSecond * CHUNK_SIZE) / (1024 * 1024)).toFixed(2)} MB/second)`);
        console.log("---");
      }
    }
    
    const endTime = Date.now();
    const totalTimeSeconds = (endTime - startTime) / 1000;
    console.log(`Completed upload of ${totalChunks} chunks in ${formatTime(totalTimeSeconds)}`);
    console.log(`Average upload speed: ${(totalChunks / totalTimeSeconds).toFixed(2)} chunks/second (${((totalChunks * CHUNK_SIZE) / (1024 * 1024) / totalTimeSeconds).toFixed(2)} MB/second)`);
    
    return { startTime, endTime, totalTimeSeconds };
  }

  // Helper function to format time (seconds to HH:MM:SS)
  function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  describe("Large-Scale Data Handling Tests", function() {
    // We'll run with a much smaller number for CI environments
    const REDUCED_CHUNKS = process.env.CI ? 50 : TARGET_CHUNKS;
    
    it(`Should upload and retrieve ${REDUCED_CHUNKS} chunks of ${CHUNK_SIZE/1024}kb data`, async function() {
      const { wttpSite, gateway, siteAdmin } = await loadFixture(deployWTTPGatewayFixture);
      
      // Define resource header first
    //   await defineResource(TEST_PATH);
      
      // Upload chunks in batches
      console.log(`Testing with ${REDUCED_CHUNKS} chunks (adjust via TARGET_CHUNKS constant or set CI=true for quick tests)`);
      const uploadStats = await uploadChunksInBatches(siteAdmin, TEST_PATH, REDUCED_CHUNKS);
      
      // Verify the resource metadata and count
      const locateRequest = {
        head: {
          requestLine: {
            path: TEST_PATH,
            protocol: "WTTP/3.0",
            method: 6 // LOCATE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeChunks: {
          start: 0,
          end: 0 // Full range
        }
      };
      
      console.log("Verifying resource metadata and chunk count...");
      const locateResponse = await gateway.LOCATE(wttpSite.target, locateRequest);
      
      expect(locateResponse.head.responseLine.code).to.equal(200);
      expect(locateResponse.dataPoints.length).to.equal(REDUCED_CHUNKS);
      console.log(`Successfully verified ${locateResponse.dataPoints.length} chunks`);
      
      // Test GET with various byte ranges
      console.log("\nTesting GET with progressively larger byte ranges:");
      
      const testRanges = [
        { name: "First 1MB", start: 0, end: 1 * 1024 * 1024 },
        { name: "First 10MB", start: 0, end: 10 * 1024 * 1024 },
        { name: "Middle 10MB", start: REDUCED_CHUNKS * CHUNK_SIZE / 2, end: (REDUCED_CHUNKS * CHUNK_SIZE / 2) + (10 * 1024 * 1024) },
        { name: "Last 10MB", start: REDUCED_CHUNKS * CHUNK_SIZE - (10 * 1024 * 1024), end: REDUCED_CHUNKS * CHUNK_SIZE },
        { name: "Full content", start: 0, end: REDUCED_CHUNKS * CHUNK_SIZE }
      ];
      
      for (const range of testRanges) {
        // Skip full content test if too large (over 100MB)
        if (range.name === "Full content" && REDUCED_CHUNKS * CHUNK_SIZE > 100 * 1024 * 1024) {
          console.log(`Skipping full content test (${(REDUCED_CHUNKS * CHUNK_SIZE / (1024 * 1024)).toFixed(2)} MB is too large)`);
          continue;
        }
        
        console.log(`\nTesting range: ${range.name} (${((range.end - range.start) / (1024 * 1024)).toFixed(2)} MB)`);
        
        const getRequest = {
          head: {
            requestLine: {
              path: TEST_PATH,
              protocol: "WTTP/3.0",
              method: 0 // GET
            },
            ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
            ifModifiedSince: 0
          },
          rangeBytes: {
            start: range.start,
            end: range.end
          }
        };
        
        const startTime = Date.now();
        const getResponse = await gateway.GET(wttpSite.target, getRequest);
        const endTime = Date.now();
        const retrievalTimeSeconds = (endTime - startTime) / 1000;
        
        // Verify response
        if (range.end > REDUCED_CHUNKS * CHUNK_SIZE) {
          expect(getResponse.head.responseLine.code).to.equal(416); // Range Not Satisfiable
          console.log("Range exceeded content size, received 416 as expected");
        } else {
          expect(getResponse.head.responseLine.code).to.equal(range.name === "Full content" ? 200 : 206);
          expect(getResponse.data.length).to.equal(range.end - range.start);
          
          // Verify first chunk content if retrieving from the beginning
          if (range.start === 0) {
            const firstChunkHeader = new TextEncoder().encode("Chunk 0: ");
            let matches = true;
            for (let i = 0; i < firstChunkHeader.length; i++) {
              if (getResponse.data !== hre.ethers.toUtf8String(firstChunkHeader)) {
                matches = false;
                break;
              }
            }
            expect(matches).to.be.true;
          }
          
          const mbRetrieved = getResponse.data.length / (1024 * 1024);
          const mbPerSecond = mbRetrieved / retrievalTimeSeconds;
          
          console.log(`Retrieved ${mbRetrieved.toFixed(2)} MB in ${formatTime(retrievalTimeSeconds)}`);
          console.log(`Retrieval speed: ${mbPerSecond.toFixed(2)} MB/second`);
        }
      }
      
      console.log("\nLarge-scale test completed successfully");
    });
  });
}); 