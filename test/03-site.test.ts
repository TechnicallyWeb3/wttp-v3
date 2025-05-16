import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { WTTPSiteV3, DataPointRegistryV2, DataPointStorageV2 } from "../typechain-types";

describe("WTTPSite", function () {
  let wttpSite: WTTPSiteV3;
  let dpr: DataPointRegistryV2;
  let dps: DataPointStorageV2;
  let owner: any;
  let siteAdmin: any;
  let resourceAdmin: any;
  let publicUser: any;
  
  const siteAdminRole: any = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
  const DEFAULT_HEADER = {
    methods: 511, // Should be GET, HEAD, OPTIONS, PUT, PATCH, DELETE and DEFINE
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
  
  // Fixture to deploy the contracts once and reuse them across tests
  async function deployWTTPFixture() {
    [owner, siteAdmin, resourceAdmin, publicUser] = await hre.ethers.getSigners();
    
    // Deploy DPS
    const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorageV2");
    dps = await DataPointStorage.deploy();
    
    // Deploy DPR
    const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistryV2");
    const royaltyRate = hre.ethers.parseEther("0.00001"); // 0.00001 ETH
    dpr = await DataPointRegistry.deploy(owner.address, await dps.getAddress(), royaltyRate);
    
    // Deploy a concrete implementation of WTTPSiteV3
    // You'll need to have or create a concrete implementation of WTTPSiteV3 for testing
    // For example, you might have a TestSite contract similar to TestPermissions and TestStorage
    const TestSite = await hre.ethers.getContractFactory("TestSite");
    wttpSite = await TestSite.deploy(await dpr.getAddress(), owner.address, DEFAULT_HEADER);
    
    // Grant site admin role
    await wttpSite.grantRole(siteAdminRole, siteAdmin.address);
    
    // Create a resource admin role for testing
    const resourceAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
    await wttpSite.connect(siteAdmin).createResourceRole(resourceAdminRole);
    await wttpSite.connect(siteAdmin).grantRole(resourceAdminRole, resourceAdmin.address);
    
    return { wttpSite, dpr, dps, owner, siteAdmin, resourceAdmin, publicUser, resourceAdminRole };
  }

  // Helper function to create header for tests
  async function createCustomHeader(withResourceAdmin = false, adminRole?: string) {
    const headerInfo = {
      methods: 511, // All methods allowed (binary 111111111)
      cache: {
        maxAge: 600,
        sMaxage: 300,
        noStore: false,
        noCache: false,
        immutableFlag: false,
        publicFlag: true,
        mustRevalidate: false,
        proxyRevalidate: false,
        mustUnderstand: false,
        staleWhileRevalidate: 180,
        staleIfError: 60
      },
      redirect: {
        code: 0,
        location: ""
      },
      resourceAdmin: withResourceAdmin && adminRole 
        ? adminRole
        : hre.ethers.zeroPadBytes("0x", 32) // Empty resource admin role
    };
    
    return headerInfo;
  }

  describe("Protocol Version Compatibility", function () {
    it("Should correctly check WTTP version compatibility", async function () {
      const { wttpSite } = await loadFixture(deployWTTPFixture);
      
      // Assuming protocol version is "1.0" or "3.0"
      expect(await wttpSite.compatibleWTTPVersion("WTTP/3.0")).to.be.true;
      expect(await wttpSite.compatibleWTTPVersion("WTTP/1.0")).to.be.false;
    });
    it("Should correctly check WTTP version compatibility using OPTIONS and SuperAdmin", async function () {
      const { wttpSite, owner } = await loadFixture(deployWTTPFixture);
      const optionsRequest = {
          path: "/test-resource",
          protocol: "WTTP/3.0",
          method: 1, // OPTIONS
        };

      const optionsResponse = await wttpSite.connect(owner).OPTIONS(optionsRequest);
      // console.log(optionsResponse);
      expect(optionsResponse.responseLine.code).to.equal(204);
      expect(optionsResponse.allow).to.equal(DEFAULT_HEADER.methods);
    });
    it("Should correctly check WTTP version compatibility using OPTIONS and ResourceAdmin", async function () {
      const { wttpSite, resourceAdmin } = await loadFixture(deployWTTPFixture);
      const optionsRequest = {
          path: "/test-resource",
          protocol: "WTTP/3.0",
          method: 1, // OPTIONS
      };

      const optionsResponse = await wttpSite.connect(resourceAdmin).OPTIONS(optionsRequest);
      // console.log(optionsResponse);
      expect(optionsResponse.responseLine.code).to.equal(204);
      expect(optionsResponse.allow).to.equal(DEFAULT_HEADER.methods);
    });
    
    it("Should correctly call read-only methods as a PublicUser", async function () {
      const { wttpSite, publicUser } = await loadFixture(deployWTTPFixture);
      // create a test resource
      const putRequest = {
        head: {
          requestLine: {
            path: "/test-resource",
            protocol: "WTTP/3.0",
            method: 3, // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: hre.ethers.toUtf8Bytes("Test content"),
            publisher: publicUser.address,
            chunkIndex: 0
          }
        ]
        
      };

      const putResponse = await wttpSite.PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      const receipt = await putResponse.wait();
      // console.log(receipt);
      
      const events = receipt?.logs.map(log => {
        try {
          const parsed = wttpSite.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsed;
        } catch {
          return null;
        }
      }).filter(event => event !== null);

      const putSuccessEvent = events?.find(event => event.name === "PUTSuccess");
      // console.log("All events:", events?.map(e => e.name));
      const responseCode = putSuccessEvent?.args.putResponse.head.responseLine.code;
      expect(responseCode).to.equal(201);
      
      const optionsRequest = {
        path: "/test-resource",
        protocol: "WTTP/3.0",
        method: 1, // OPTIONS
      };

      const optionsResponse = await wttpSite.connect(publicUser).OPTIONS(optionsRequest);
      expect(optionsResponse.responseLine.code).to.equal(204);
      expect(optionsResponse.allow).to.equal(DEFAULT_HEADER.methods);
      
      const headRequest = {
        requestLine: {
          path: "/test-resource",
          protocol: "WTTP/3.0",
          method: 0, // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };

      const headResponse = await wttpSite.connect(publicUser).HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(200);

      const locateRequest = {
        requestLine: {
          path: "/test-resource",
          protocol: "WTTP/3.0",
          method: 2, // LOCATE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };

      const locateResponse = await wttpSite.connect(publicUser).LOCATE(locateRequest);
      expect(locateResponse.head.responseLine.code).to.equal(200);

      // const putRequest = {
      //   head: {
      //     requestLine: {
      //       path: "/test-resource",
      //       protocol: "WTTP/3.0",
      //       method: 3, // PUT
      //     },
      //     ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
      //     ifModifiedSince: 0
      //   },
      //   mimeType: "0x7470",
      //   charset: "0x7538",
      //   encoding: "0x6964",
      //   language: "0x6575",
      //   location: "0x6463",
      //   data: [
      //     {
      //       data: hre.ethers.toUtf8Bytes("Test content"),
      //       publisher: publicUser.address,
      //       chunkIndex: 0
      //     }
      //   ]
      // };

      // const putResponse = await wttpSite.connect(publicUser).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      // const receipt = await putResponse.wait();
      // const putSuccessEvent = receipt?.logs.find(log => {
      //   try {
      //     const parsed = wttpSite.interface.parseLog({
      //       topics: log.topics,
      //       data: log.data
      //     });
      //     return parsed?.name === "PUTSuccess";
      //   } catch {
      //     return false;
      //   }
      // });

      // const putSuccessArgs = wttpSite.interface.parseLog({
      //   topics: putSuccessEvent.topics,
      //   data: putSuccessEvent.data
      // }).args;

      // expect(putSuccessArgs.path).to.equal("/test-resource");
      // expect(putSuccessArgs.code).to.equal(201);

      // const headResponseWithContent = await wttpSite.connect(publicUser).HEAD(headRequest);
      // expect(headResponseWithContent.responseLine.code).to.equal(200);
      // expect(headResponseWithContent.headerInfo.methods).to.equal(DEFAULT_HEADER.methods);
      // expect(headResponseWithContent.headerInfo.resourceAdmin).to.equal(hre.ethers.zeroPadBytes("0x", 32));
        

    });
  });

  describe("HEAD Requests", function () {
    it("Should handle HEAD requests for non-existent resources", async function () {
      const { wttpSite } = await loadFixture(deployWTTPFixture);
      
      const headRequest = {
        requestLine: {
          path: "/non-existent-path",
          protocol: "WTTP/3.0",
          method: 0, // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const response = await wttpSite.HEAD(headRequest);
      
      // Should return 404 for non-existent resource
      expect(response.responseLine.code).to.equal(404);
    });
  });

  describe("DEFINE Requests", function () {
    it("Should allow site admin to define resource headers", async function () {
      const { wttpSite, siteAdmin, resourceAdminRole } = await loadFixture(deployWTTPFixture);
      
      const headerInfo = await createCustomHeader(true, resourceAdminRole);
      // console.log(headerInfo);
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/test-resource",
            protocol: "WTTP/3.0",
            method: 8, // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      const tx = await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      const receipt = await tx.wait();
      
      // Get all emitted events from the receipt
    //   const events = receipt?.logs.map(log => {
    //     try {
    //       return wttpSite.interface.parseLog({
    //         topics: log.topics,
    //         data: log.data
    //       });
    //     } catch {
    //       return null;
    //     }
    //   }).filter(Boolean);

    //   // Log all decoded events
    //   console.log("Emitted Events:", events?.map(event => ({
    //     name: event?.name,
    //     args: event?.args
    //   })));
      
      // Verify the result with a HEAD request
      const headRequest = {
        requestLine: {
          path: "/test-resource",
          protocol: "WTTP/3.0",
          method: 0, // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const headResponse = await wttpSite.HEAD(headRequest);
      // console.log(headResponse);
      // console.log(resourceAdminRole);

      // Resource exists with headers but no content yet
      expect(headResponse.responseLine.code).to.equal(404);
      // Don't check header values since they aren't returned with 404

      // Let's add content to verify headers are returned correctly when resource exists
      const content = hre.ethers.toUtf8Bytes("Test content");
      const putRequest = {
        head: {
          requestLine: {
            path: "/test-resource",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };

      const putTx = await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      const putReceipt = await putTx.wait();

      const events = putReceipt?.logs.map(log => {
        try {
          return wttpSite.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
        } catch {
          return null;
        }
      }).filter(Boolean);

      const putSuccessEvent = events?.find(event => event?.name === "PUTSuccess");  
      // console.log(putSuccessEvent?.args.putResponse.head.headerInfo);

      // Now check the resource with content
      const headResponseWithContent = await wttpSite.HEAD(headRequest);
      // console.log(headResponseWithContent);
      // console.log(headResponseWithContent.metadata);
      expect(headResponseWithContent.responseLine.code).to.equal(200);
      expect(headResponseWithContent.headerInfo.methods).to.equal(headerInfo.methods);
      expect(headResponseWithContent.headerInfo.resourceAdmin).to.equal(resourceAdminRole);
    });
    
    it("Should prevent non-admins from defining resource headers", async function () {
      const { wttpSite, publicUser } = await loadFixture(deployWTTPFixture);
      
      const headerInfo = await createCustomHeader();
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/restricted-resource",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      // Regular user shouldn't be able to define headers
      await expect(wttpSite.connect(publicUser).DEFINE(defineRequest))
        .to.be.revertedWithCustomError(wttpSite, "Forbidden")
        .withArgs("/restricted-resource", publicUser.address);
    });
  });

  describe("PUT Requests", function () {
    it("Should allow creating new resources", async function () {
      const { wttpSite, siteAdmin, resourceAdminRole } = await loadFixture(deployWTTPFixture);
      
      // First define headers
      const headerInfo = await createCustomHeader(true, resourceAdminRole);
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // Then PUT content
      const content = hre.ethers.toUtf8Bytes("Hello, WTTP World!");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      const tx = await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      const receipt = await tx.wait();
      
      // Verify the event was emitted
      const putSuccessEvent = receipt?.logs.find(
        log => wttpSite.interface.parseLog(log)?.name === "PUTSuccess"
      );
      expect(putSuccessEvent).to.not.be.undefined;
      
      // Check the resource with HEAD
      const headRequest = {
        requestLine: {
          path: "/test-content",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const headResponse = await wttpSite.HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.metadata.size).to.equal(content.length);
    });
    
    it("Should enforce permissions for resource modification", async function () {
      const { wttpSite, siteAdmin, publicUser, resourceAdmin, resourceAdminRole } = await loadFixture(deployWTTPFixture);
      
      // Define headers with specific resource admin
      const headerInfo = await createCustomHeader(true, resourceAdminRole);
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/protected-resource",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // Public user tries to PUT content
      const content = hre.ethers.toUtf8Bytes("Unauthorized content");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/protected-resource",
            protocol: "WTTP/3.0",
            method: 3, // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6576",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: publicUser.address,
            chunkIndex: 0
          }
        ]
      };
      
      // Should fail because method is not allowed for public user
      const methodBit = 1 << 3; // Method.PUT = 3
      expect(headerInfo.methods & methodBit).to.not.equal(0); // PUT is allowed in header
      
      // But public user isn't authorized to use it on this resource
      await expect(wttpSite.connect(publicUser).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") }))
        .to.be.reverted;
        
      // Resource admin should be able to PUT
      const adminPutRequest = {
        head: {
          requestLine: {
            path: "/protected-resource",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: hre.ethers.toUtf8Bytes("Authorized content"),
            publisher: resourceAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
    //   await expect(wttpSite.connect(resourceAdmin).PUT(adminPutRequest, { value: hre.ethers.parseEther("0.0001") }))
    //     .to.not.be.reverted;
      await wttpSite.connect(resourceAdmin).PUT(adminPutRequest, { value: hre.ethers.parseEther("0.0001") })
    });
  });

  describe("PATCH Requests", function () {
    it("Should allow updating existing resources", async function () {
      const { wttpSite, siteAdmin } = await loadFixture(deployWTTPFixture);
      
      // First create a resource
      const headerInfo = await createCustomHeader();
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/patchable-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // PUT initial content
      const initialContent = hre.ethers.toUtf8Bytes("Initial content");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/patchable-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: initialContent,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      
      // Now PATCH the content
      const updatedContent = hre.ethers.toUtf8Bytes("Updated content");
      
      const patchRequest = {
        head: {
          requestLine: {
            path: "/patchable-content",
            protocol: "WTTP/3.0",
            method: 4 // PATCH
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        data: [
          {
            data: updatedContent,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      const tx = await wttpSite.connect(siteAdmin).PATCH(patchRequest, { value: hre.ethers.parseEther("0.0001") });
      const receipt = await tx.wait();
      
      // Verify the event was emitted
      const patchSuccessEvent = receipt?.logs.find(
        log => wttpSite.interface.parseLog(log)?.name === "PATCHSuccess"
      );
      expect(patchSuccessEvent).to.not.be.undefined;
      
      // Check the resource with HEAD to see it was updated
      const headRequest = {
        requestLine: {
          path: "/patchable-content",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const headResponse = await wttpSite.HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.metadata.size).to.equal(updatedContent.length);
    });
  });

  describe("DELETE Requests", function () {
    it("Should allow resource deletion by admins", async function () {
      const { wttpSite, siteAdmin } = await loadFixture(deployWTTPFixture);
      
      // First create a resource
      const headerInfo = await createCustomHeader();
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/deletable-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // PUT content
      const content = hre.ethers.toUtf8Bytes("Content to be deleted");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/deletable-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      
      // Verify resource exists
      let headRequest = {
        requestLine: {
          path: "/deletable-content",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      let headResponse = await wttpSite.HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(200);
      
      // Now DELETE the resource
      const deleteRequest = {
        requestLine: {
          path: "/deletable-content",
          protocol: "WTTP/3.0",
          method: 5 // DELETE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const tx = await wttpSite.connect(siteAdmin).DELETE(deleteRequest);
      const receipt = await tx.wait();
      
      // Verify the event was emitted
      const deleteSuccessEvent = receipt?.logs.find(
        log => wttpSite.interface.parseLog(log)?.name === "DELETESuccess"
      );
      expect(deleteSuccessEvent).to.not.be.undefined;
      
      // Check the resource is gone
      headResponse = await wttpSite.HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(404);
    });
    
    it("Should prevent non-admins from deleting resources", async function () {
      const { wttpSite, siteAdmin, publicUser } = await loadFixture(deployWTTPFixture);
      
      // First create a resource
      const headerInfo = await createCustomHeader();
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/protected-deletable-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // PUT content
      const content = hre.ethers.toUtf8Bytes("Protected content");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/protected-deletable-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      
      // Public user tries to DELETE
      const deleteRequest = {
        requestLine: {
          path: "/protected-deletable-content",
          protocol: "WTTP/3.0",
          method: 5 // DELETE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      // Should fail because user isn't authorized
      await expect(wttpSite.connect(publicUser).DELETE(deleteRequest))
        .to.be.reverted;
    });
  });

  describe("LOCATE Requests", function () {
    it("Should provide storage locations for resources", async function () {
      const { wttpSite, siteAdmin } = await loadFixture(deployWTTPFixture);
      
      // First create a resource
      const headerInfo = await createCustomHeader();
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/locatable-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // PUT content
      const content = hre.ethers.toUtf8Bytes("Content for location");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/locatable-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      
      // Request LOCATE info
      const locateRequest = {
        requestLine: {
          path: "/locatable-content",
          protocol: "WTTP/3.0",
          method: 7 // LOCATE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const locateResponse = await wttpSite.LOCATE(locateRequest);
      
      // Check LOCATE response
      expect(locateResponse.head.responseLine.code).to.equal(200);
      expect(locateResponse.dataPoints.length).to.equal(1); // One content chunk
      expect(locateResponse.dataPoints[0]).to.not.equal(hre.ethers.zeroPadBytes("0x", 32)); // Valid data point address
    });
  });

  describe("Advanced Scenarios", function () {
    it("Should handle conditional requests with ETag matching", async function () {
      const { wttpSite, siteAdmin } = await loadFixture(deployWTTPFixture);
      
      // Create and populate a resource
      const headerInfo = await createCustomHeader();
      
      const defineRequest = {
        data: headerInfo,
        head: {
          requestLine: {
            path: "/conditional-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // PUT content
      const content = hre.ethers.toUtf8Bytes("Content for conditional requests");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/conditional-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      
      // Get the ETag with a HEAD request
      const headRequest = {
        requestLine: {
          path: "/conditional-content",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const headResponse = await wttpSite.HEAD(headRequest);
      const etag = headResponse.etag;
      
      // Now make a conditional request with matching ETag
      const conditionalRequest = {
        requestLine: {
          path: "/conditional-content",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: etag,
        ifModifiedSince: 0
      };
      
      const conditionalResponse = await wttpSite.HEAD(conditionalRequest);
      
      // Should return 304 Not Modified
      expect(conditionalResponse.responseLine.code).to.equal(304);
    });
    
    it("Should support immutable resources that cannot be modified", async function () {
      const { wttpSite, siteAdmin } = await loadFixture(deployWTTPFixture);
      
      // Create a header with immutableFlag set to true
      const immutableHeader = {
        methods: 511, // All methods allowed
        cache: {
          maxAge: 3600,
          sMaxage: 1800,
          noStore: false,
          noCache: false,
          immutableFlag: true, // Set immutable flag
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
      
      const defineRequest = {
        data: immutableHeader,
        head: {
          requestLine: {
            path: "/immutable-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await wttpSite.connect(siteAdmin).DEFINE(defineRequest);
      
      // PUT initial content
      const content = hre.ethers.toUtf8Bytes("Immutable content");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/immutable-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        location: "0x6463",
        data: [
          {
            data: content,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      await wttpSite.connect(siteAdmin).PUT(putRequest, { value: hre.ethers.parseEther("0.0001") });
      
      // Try to modify it with PATCH
      const patchRequest = {
        head: {
          requestLine: {
            path: "/immutable-content",
            protocol: "WTTP/3.0",
            method: 4 // PATCH
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        data: [
          {
            data: hre.ethers.toUtf8Bytes("Modified content"),
            publisher: siteAdmin.address,
            chunkIndex: 0
          }
        ]
      };
      
      // Should fail because resource is immutable
      await expect(wttpSite.connect(siteAdmin).PATCH(patchRequest, { value: hre.ethers.parseEther("0.0001") }))
        .to.be.revertedWithCustomError(wttpSite, "ResourceImmutable")
        .withArgs("/immutable-content");
    });
  });
}); 