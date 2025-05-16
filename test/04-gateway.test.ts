import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { WTTPSiteV3, DataPointRegistryV2, DataPointStorageV2, WTTPGatewayV3 } from "../typechain-types";

describe("WTTPGateway", function () {
  let dps: DataPointStorageV2;
  let dpr: DataPointRegistryV2;
  let wttpSite: WTTPSiteV3;
  let gateway: WTTPGatewayV3;
  let owner: any;
  let siteAdmin: any;
  let publicUser: any;
  
  const siteAdminRole: any = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
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

  async function deployWTTPGatewayFixture() {
    // Get signers
    [owner, siteAdmin, publicUser] = await hre.ethers.getSigners();

    const DPSFactory = await hre.ethers.getContractFactory("DataPointStorageV2");
    dps = await DPSFactory.deploy();

    // Deploy DataPointRegistry and Storage
    const DPRFactory = await hre.ethers.getContractFactory("DataPointRegistryV2");
    dpr = await DPRFactory.deploy(
        owner.address,
        dps.target,
        1
    );

    // Deploy WTTPSite
    const WTTPSiteFactory = await hre.ethers.getContractFactory("TestSite");
    wttpSite = await WTTPSiteFactory.deploy(
      dpr.target, 
      owner.address, 
      DEFAULT_HEADER
    );

    // Grant site admin role to siteAdmin
    await wttpSite.grantRole(siteAdminRole, siteAdmin.address);

    // Deploy WTTPGateway
    const WTTPGatewayFactory = await hre.ethers.getContractFactory("WTTPGatewayV3");
    gateway = await WTTPGatewayFactory.deploy();

    return { wttpSite, dpr, dps, gateway, owner, siteAdmin, publicUser };
  }

  // Helper function to create a test resource
  async function createTestResource(path: string, content: string) {
    const contentBytes = hre.ethers.toUtf8Bytes(content);
    
    // Define header
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
    
    // PUT content
    const putRequest = {
      head: {
        requestLine: {
          path: path,
          protocol: "WTTP/3.0",
          method: 3 // PUT
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      },
      mimeType: "0x7470", // text/plain
      charset: "0x7538", // utf-8
      encoding: "0x6964", // identity
      language: "0x6575", // en-US
      location: "0x6463", // default
      data: [
        {
          data: contentBytes,
          publisher: siteAdmin.address,
          chunkIndex: 0
        }
      ]
    };
    
    return wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
  }

  // Helper function to create a test resource with multiple chunks
  async function createMultiChunkResource(path: string, chunks: string[]) {
    // Define header
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
    
    // PUT content with multiple chunks
    const dataRegistrations = chunks.map((chunk, index) => {
      return {
        data: hre.ethers.toUtf8Bytes(chunk),
        publisher: siteAdmin.address,
        chunkIndex: index
      };
    });
    
    const putRequest = {
      head: {
        requestLine: {
          path: path,
          protocol: "WTTP/3.0",
          method: 3 // PUT
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      },
      mimeType: "0x7470", // text/plain
      charset: "0x7538", // utf-8
      encoding: "0x6964", // identity
      language: "0x6575", // en-US
      location: "0x6463", // default
      data: dataRegistrations
    };
    
    return wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
  }

  describe("LOCATE with Range", function() {
    it("Should return full data when no range is specified", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      // Create a test resource with multiple chunks
      await createMultiChunkResource("/test-chunks", ["Chunk1", "Chunk2", "Chunk3", "Chunk4", "Chunk5"]);
      
      // Create a LOCATE request with no range
      const locateRequest = {
        head: {
          requestLine: {
            path: "/test-chunks",
            protocol: "WTTP/3.0",
            method: 6 // LOCATE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeChunks: {
          start: 0,
          end: 0
        }
      };
      
      const locateResponse = await gateway.LOCATE(await wttpSite.getAddress(), locateRequest);
      
      // Verify response
      expect(locateResponse.head.responseLine.code).to.equal(200);
      expect(locateResponse.dataPoints.length).to.equal(5); // All 5 chunks
    });
    
    it("Should return partial data for positive range", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      // Create a test resource with multiple chunks
      await createMultiChunkResource("/test-chunks", ["Chunk1", "Chunk2", "Chunk3", "Chunk4", "Chunk5"]);
      
      // Create a LOCATE request with positive range (chunks 1-3)
      const locateRequest = {
        head: {
          requestLine: {
            path: "/test-chunks",
            protocol: "WTTP/3.0",
            method: 6 // LOCATE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeChunks: {
          start: 1,
          end: 4
        }
      };
      
      const locateResponse = await gateway.LOCATE(await wttpSite.getAddress(), locateRequest);
      
      // Verify response
      expect(locateResponse.head.responseLine.code).to.equal(206); // Partial content
      expect(locateResponse.dataPoints.length).to.equal(3); // Chunks 1, 2, 3
    });
    
    it("Should handle negative indices correctly", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      // Create a test resource with multiple chunks
      await createMultiChunkResource("/test-chunks", ["Chunk1", "Chunk2", "Chunk3", "Chunk4", "Chunk5"]);
      
      // Create a LOCATE request with negative range (last 2 chunks)
      const locateRequest = {
        head: {
          requestLine: {
            path: "/test-chunks",
            protocol: "WTTP/3.0",
            method: 6 // LOCATE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeChunks: {
          start: -2,
          end: 0
        }
      };
      
      const locateResponse = await gateway.LOCATE(await wttpSite.getAddress(), locateRequest);
      
      // Verify response
      expect(locateResponse.head.responseLine.code).to.equal(206); // Partial content
      expect(locateResponse.dataPoints.length).to.equal(2); // Last 2 chunks
    });
    
    it("Should return 416 for out of bounds range", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      // Create a test resource with multiple chunks
      await createMultiChunkResource("/test-chunks", ["Chunk1", "Chunk2", "Chunk3"]);
      
      // Create a LOCATE request with out of bounds range
      const locateRequest = {
        head: {
          requestLine: {
            path: "/test-chunks",
            protocol: "WTTP/3.0",
            method: 6 // LOCATE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeChunks: {
          start: 5,
          end: 10
        }
      };
      
      const locateResponse = await gateway.LOCATE(await wttpSite.getAddress(), locateRequest);
      
      // Verify response
      expect(locateResponse.head.responseLine.code).to.equal(416); // Range Not Satisfiable
    });
  });

  describe("GET with Range", function() {
    it("Should return full content when no range is specified", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      const content = "This is test content for the GET function";
      await createTestResource("/test-content", content);
      
      // Create a GET request with no range
      const getRequest = {
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 0 // GET
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeBytes: {
          start: 0,
          end: 0
        }
      };
      
      const getResponse = await gateway.GET(wttpSite.target, getRequest);
      
      // Verify response
      expect(getResponse.head.responseLine.code).to.equal(200);
      expect(hre.ethers.toUtf8String(getResponse.data)).to.equal(content);
    });
    
    it("Should return partial content for byte range", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      const content = "This is test content for the GET function";
      await createTestResource("/test-content", content);
      
      // Create a GET request with byte range (bytes 5-14)
      const getRequest = {
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 0 // GET
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeBytes: {
          start: 5,
          end: 15
        }
      };
      
      const getResponse = await gateway.GET(wttpSite.target, getRequest);
      
      // Verify response
      expect(getResponse.head.responseLine.code).to.equal(206); // Partial Content
      expect(hre.ethers.toUtf8String(getResponse.data)).to.equal("is test co");
    });
    
    it("Should handle negative byte indices correctly", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      const content = "This is test content for the GET function";
      await createTestResource("/test-content", content);
      
      // Create a GET request with negative byte range (last 8 bytes)
      const getRequest = {
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 0 // GET
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeBytes: {
          start: -8,
          end: 0
        }
      };
      
      const getResponse = await gateway.GET(wttpSite.target, getRequest);
      
      // Verify response
      expect(getResponse.head.responseLine.code).to.equal(206); // Partial Content
      expect(hre.ethers.toUtf8String(getResponse.data)).to.equal("function");
    });
    
    it("Should handle multi-chunk content with byte ranges", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      // Create a test resource with multiple chunks
      const chunks = ["Chunk1: Hello, ", "Chunk2: this is ", "Chunk3: multi-chunk ", "Chunk4: content!"];
      await createMultiChunkResource("/multi-chunk", chunks);
      
      // Create a GET request crossing chunk boundaries
      const getRequest = {
        head: {
          requestLine: {
            path: "/multi-chunk",
            protocol: "WTTP/3.0",
            method: 0 // GET
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeBytes: {
          start: 10,
          end: 30
        }
      };
      
      const getResponse = await gateway.GET(wttpSite.target, getRequest);
      
      // Verify response
      expect(getResponse.head.responseLine.code).to.equal(206); // Partial Content
      
      // The actual bytes should cross chunk boundaries
      const expectedContent = "llo, Chunk2: this is";
      expect(hre.ethers.toUtf8String(getResponse.data)).to.equal(expectedContent);
    });
    
    it("Should return 416 for out of bounds byte range", async function() {
      const { wttpSite, gateway } = await loadFixture(deployWTTPGatewayFixture);
      
      const content = "This is test content";
      await createTestResource("/test-content", content);
      
      // Create a GET request with out of bounds range
      const getRequest = {
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 0 // GET
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        rangeBytes: {
          start: 100,
          end: 200
        }
      };
      
      const getResponse = await gateway.GET(wttpSite.target, getRequest);
      
      // Verify response
      expect(getResponse.head.responseLine.code).to.equal(416); // Range Not Satisfiable
    });
  });
});