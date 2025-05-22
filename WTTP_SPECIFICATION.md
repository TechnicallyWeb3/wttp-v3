# WTTP Protocol Specification v3.0

## 1. Introduction

### 1.1 Purpose

The Web Three Transfer Protocol (WTTP) is a blockchain-based protocol that implements HTTP-like functionality for storing, retrieving, and managing web resources directly on the blockchain. This specification defines the structure, operations, and implementation details of WTTP version 3.0.

### 1.2 Scope

This document covers:
- Protocol architecture and components
- Data structures and types
- Core operations and methods
- Access control mechanisms
- Storage mechanisms
- Implementation requirements

### 1.3 Protocol Overview

WTTP provides a standardized way to interact with on-chain content using familiar web paradigms. It separates core storage functionality from protocol logic, enabling efficient resource management and extended capabilities like byte range requests. The protocol implements familiar HTTP-like methods while leveraging blockchain's unique properties for decentralized content management.

## 2. Architecture

### 2.1 Layered Architecture

WTTP v3.0 is built on a layered architecture consisting of:

```
┌─────────────────────────┐
│       Applications      │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│      WTTP Gateway       │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│       WTTP Site         │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│    WTTP Permissions     │
│     WTTP Storage        │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   Data Point Registry   │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   Data Point Storage    │
└─────────────────────────┘
```

#### 2.1.1 Data Storage Layer
The foundation of the protocol, managed by the Data Point Storage system. This layer is responsible for the actual storage of data chunks on the blockchain.

#### 2.1.2 Registry Layer
The Data Point Registry tracks data ownership and manages royalty payments for content creators. It provides an economic layer that incentivizes content creation and sharing.

#### 2.1.3 Core Protocol Layer
The WTTP Site implementation provides the core HTTP-like methods for resource manipulation, including permissions and storage management.

#### 2.1.4 Gateway Layer
The WTTP Gateway provides extended functionality (such as byte range support) and standardized interfaces for applications to interact with WTTP sites.

### 2.2 Core Components

#### 2.2.1 WTTPGatewayV3
Provides a unified interface for accessing WTTP sites with extended functionality, including byte range support and standardized response formats.

#### 2.2.2 WTTPSiteV3
Implements core WTTP protocol methods for HTTP-like operations on the blockchain, extending WTTPStorageV3 to provide web-like interactions with blockchain resources.

#### 2.2.3 WTTPStorageV3
Manages web resource storage and access control, providing core storage functionality for the WTTP protocol.

#### 2.2.4 WTTPPermissionsV3
Handles role-based access control for resources, implementing a permission system similar to traditional web servers.

#### 2.2.5 DataPointRegistryV2
Registers data points and manages royalty payments, providing an economic layer for content creators.

#### 2.2.6 DataPointStorageV2
Provides basic storage for data chunks, implementing the lowest level of the protocol stack.

## 3. Data Structures

### 3.1 Core Types

#### 3.1.1 Method Enum
```solidity
enum Method {
    HEAD,    // Retrieve only resource headers and metadata
    GET,     // Retrieve resource content
    POST,    // Submit data to be processed (not fully implemented)
    PUT,     // Create or replace a resource
    PATCH,   // Update parts of a resource
    DELETE,  // Remove a resource
    OPTIONS, // Query which methods are supported for a resource
    LOCATE,  // Retrieve storage locations for resource data points
    DEFINE   // Update resource headers
}
```

#### 3.1.2 Resource Metadata
```solidity
struct ResourceMetadata {
    bytes2 mimeType;     // MIME type of the resource (2-byte identifier)
    bytes2 charset;      // Character set of the resource (2-byte identifier)
    bytes2 encoding;     // Encoding of the resource (2-byte identifier)
    bytes2 language;     // Language of the resource (2-byte identifier)
    uint256 size;        // Size of the resource in bytes
    uint256 version;     // Version number of the resource
    uint256 lastModified; // Timestamp of last modification
    bytes32 header;      // Header identifier determining which header the resource uses
}
```

#### 3.1.3 Header Information
```solidity
struct HeaderInfo {
    uint16 methods;       // Allowed HTTP methods bitmask
    CacheControl cache;   // Cache control directives
    Redirect redirect;    // Redirect information if applicable
    bytes32 resourceAdmin; // Role identifier for resource administration
}
```

#### 3.1.4 Cache Control
```solidity
struct CacheControl {
    uint256 maxAge;      // Maximum age in seconds for client caching
    bool noStore;        // Prevents storing the response in any cache
    bool noCache;        // Requires revalidation before using cached copy
    bool immutableFlag;  // Indicates resource will never change
    bool publicFlag;     // Indicates response may be cached by any cache
}
```

#### 3.1.5 Redirect
```solidity
struct Redirect {
    uint16 code;         // HTTP status code for redirect (3xx)
    string location;     // Target location for redirect in URL format
}
```

#### 3.1.6 Data Registration
```solidity
struct DataRegistration {
    bytes data;          // The actual content data
    uint256 chunkIndex;  // Index position in the resource's chunk array
    address publisher;   // Address of the content publisher
}
```

### 3.2 Request/Response Structures

#### 3.2.1 Request Line
```solidity
struct RequestLine {
    string protocol;     // Protocol version (e.g., "WTTP/3.0")
    string path;         // Resource path being requested
    Method method;       // WTTP method (e.g., GET, HEAD, PUT)
}
```

#### 3.2.2 Response Line
```solidity
struct ResponseLine {
    string protocol;     // Protocol version (e.g., "WTTP/3.0")
    uint16 code;         // HTTP status code (e.g., 200, 404)
}
```

#### 3.2.3 HEAD Request
```solidity
struct HEADRequest {
    RequestLine requestLine;  // Basic request information
    uint256 ifModifiedSince;  // Conditional timestamp for If-Modified-Since header
    bytes32 ifNoneMatch;      // Conditional ETag for If-None-Match header
}
```

#### 3.2.4 HEAD Response
```solidity
struct HEADResponse {
    ResponseLine responseLine;  // Response status line
    HeaderInfo headerInfo;      // Resource header information
    ResourceMetadata metadata;  // Resource metadata
    bytes32 etag;               // Resource content hash for caching
}
```

#### 3.2.5 Range Structure
```solidity
struct Range {
    int256 start;        // Start position (negative means from end)
    int256 end;          // End position (negative means from end, 0 means to end)
}
```

#### 3.2.6 GET Request
```solidity
struct GETRequest {
    HEADRequest head;    // Basic request information
    Range rangeBytes;    // Range of bytes to retrieve
}
```

#### 3.2.7 GET Response
```solidity
struct GETResponse {
    HEADResponse head;   // Base HEAD response
    Range bytesRange;    // Actual byte range returned
    bytes data;          // Content data
}
```

#### 3.2.8 PUT Request
```solidity
struct PUTRequest {
    HEADRequest head;    // Basic request information
    bytes2 mimeType;     // MIME type of the resource
    bytes2 charset;      // Character set of the resource
    bytes2 encoding;     // Content encoding of the resource
    bytes2 language;     // Language of the resource
    DataRegistration[] data; // Content chunks to store
}
```

#### 3.2.9 PATCH Request
```solidity
struct PATCHRequest {
    HEADRequest head;    // Basic request information
    DataRegistration[] data; // Content chunks to update
}
```

## 4. Protocol Operations

### 4.1 Resource Retrieval

#### 4.1.1 HEAD Method
The HEAD method retrieves metadata about a resource without retrieving the content itself. It is used to check if a resource exists, get its metadata, or check if it has been modified.

**Request:**
- Path to the resource
- Optional conditional headers (If-Modified-Since, If-None-Match)

**Response:**
- Status code (200 OK, 304 Not Modified, 404 Not Found, etc.)
- Resource metadata (MIME type, size, version, etc.)
- Header information (cache control, allowed methods, etc.)
- ETag for caching

#### 4.1.2 GET Method
The GET method retrieves a resource's content and metadata. It supports byte range requests for retrieving partial content.

**Request:**
- Path to the resource
- Optional byte range (start and end positions)
- Optional conditional headers (If-Modified-Since, If-None-Match)

**Response:**
- Status code (200 OK, 206 Partial Content, 304 Not Modified, 404 Not Found, etc.)
- Resource metadata
- Content data (full or partial based on range)

#### 4.1.3 OPTIONS Method
The OPTIONS method retrieves information about which methods are allowed for a resource.

**Request:**
- Path to the resource

**Response:**
- Status code (204 No Content, 404 Not Found, etc.)
- Allowed methods bitmask

#### 4.1.4 LOCATE Method
The LOCATE method retrieves the storage locations (data point addresses) for a resource's content chunks.

**Request:**
- Path to the resource
- Optional chunk range

**Response:**
- Status code (200 OK, 206 Partial Content, 404 Not Found, etc.)
- Resource metadata
- Array of data point addresses

### 4.2 Resource Modification

#### 4.2.1 PUT Method
The PUT method creates a new resource or replaces an existing one.

**Request:**
- Path to the resource
- Resource metadata (MIME type, charset, encoding, language)
- Content data chunks
- Optional payment for royalties

**Response:**
- Status code (201 Created, 204 No Content, etc.)
- Resource metadata
- Array of data point addresses

#### 4.2.2 PATCH Method
The PATCH method updates parts of an existing resource.

**Request:**
- Path to the resource
- Content data chunks to update
- Optional payment for royalties

**Response:**
- Status code (200 OK, 404 Not Found, etc.)
- Resource metadata
- Array of data point addresses

#### 4.2.3 DELETE Method
The DELETE method removes a resource.

**Request:**
- Path to the resource

**Response:**
- Status code (204 No Content, 404 Not Found, etc.)
- Resource metadata

#### 4.2.4 DEFINE Method
The DEFINE method updates a resource's header information.

**Request:**
- Path to the resource
- New header information

**Response:**
- Status code (200 OK, 201 Created, 404 Not Found, etc.)
- Resource metadata
- New header address

### 4.3 Range Operations

#### 4.3.1 Byte Range Requests
WTTP supports HTTP-like byte range requests for retrieving partial content. Ranges can be specified with:
- Positive indices (from the beginning)
- Negative indices (from the end)
- Zero end index (to the end of the resource)

**Example:**
- Range(0, 100): First 100 bytes
- Range(100, 200): Bytes 100-200
- Range(-100, 0): Last 100 bytes
- Range(100, 0): From byte 100 to the end

#### 4.3.2 Chunk Range Requests
For LOCATE operations, WTTP supports chunk range requests to retrieve specific data point chunks.

## 5. Access Control

### 5.1 Role-Based Access Control

WTTP implements a role-based access control system with several key roles:

#### 5.1.1 DEFAULT_ADMIN_ROLE
The highest level of access, granted to the contract owner during initialization. This role can perform any operation on any resource.

#### 5.1.2 SITE_ADMIN_ROLE
Administrators of the WTTP site who can manage site-wide settings and create resource roles.

#### 5.1.3 Resource Admin Roles
Custom roles created for specific resources or resource groups. These roles can be granted to users to allow them to manage specific resources.

### 5.2 Permission Management

#### 5.2.1 Role Creation
Site administrators can create new resource roles using the `createResourceRole` function.

#### 5.2.2 Role Assignment
Roles can be granted to users using the `grantRole` function.

#### 5.2.3 Method Permissions
Each resource has a bitmask of allowed methods, which is checked before any operation is performed.

#### 5.2.4 Resource Immutability
Resources can be marked as immutable, preventing any further modifications.

## 6. Storage Mechanism

### 6.1 Data Point Storage

#### 6.1.1 Data Points
The basic unit of storage in WTTP is a data point, which is a chunk of data with a unique address.

#### 6.1.2 Data Point Address
Each data point has a unique address calculated as the keccak256 hash of the data and version.

#### 6.1.3 Storage Operations
- `writeDataPoint`: Stores a new data point
- `readDataPoint`: Retrieves a data point by its address
- `dataPointSize`: Returns the size of a data point

### 6.2 Data Point Registry

#### 6.2.1 Registration
Data points are registered in the Data Point Registry, which tracks ownership and royalty information.

#### 6.2.2 Royalty System
The registry implements a royalty system that compensates content creators when their data is used.

#### 6.2.3 Registry Operations
- `registerDataPoint`: Registers a new data point and handles royalty logic
- `getDataPointRoyalty`: Calculates the royalty amount for a data point
- `collectRoyalties`: Allows publishers to withdraw their earned royalties

### 6.3 Resource Storage

#### 6.3.1 Resource Structure
A resource consists of:
- Metadata (MIME type, size, version, etc.)
- Header information (cache control, allowed methods, etc.)
- An array of data point addresses

#### 6.3.2 Chunking
Large resources are automatically chunked into smaller data points for efficient storage and retrieval.

#### 6.3.3 Directory Representation
Directories are represented as special resources with:
- HTTP status code 300 (Multiple Choices)
- Location header pointing to "./index.html" (or appropriate fallback)
- JSON payload containing a directory listing

## 7. Status Codes

WTTP uses HTTP-like status codes to indicate the result of operations:

### 7.1 Success Codes
- 200 OK: The request was successful
- 201 Created: The resource was created successfully
- 204 No Content: The request was successful but there is no content to return
- 206 Partial Content: The range request was successful

### 7.2 Redirection Codes
- 300 Multiple Choices: The resource is a directory with multiple options
- 304 Not Modified: The resource has not been modified (for conditional requests)

### 7.3 Client Error Codes
- 404 Not Found: The resource does not exist
- 405 Method Not Allowed: The requested method is not allowed for the resource
- 416 Range Not Satisfiable: The requested range is out of bounds

### 7.4 Server Error Codes
- 500 Internal Server Error: An error occurred while processing the request
- 505 HTTP Version Not Supported: The requested protocol version is not supported

## 8. Implementation Requirements

### 8.1 Contract Requirements

#### 8.1.1 DataPointStorageV2
- Must implement the IDataPointStorageV2 interface
- Must provide functions for writing, reading, and calculating the size of data points
- Must calculate data point addresses using the keccak256 hash of data and version

#### 8.1.2 DataPointRegistryV2
- Must implement the IDataPointRegistryV2 interface
- Must track data point ownership and royalty information
- Must provide functions for registering data points and collecting royalties

#### 8.1.3 WTTPStorageV3
- Must extend WTTPPermissionsV3
- Must provide functions for creating, reading, updating, and deleting resources
- Must handle resource metadata and headers

#### 8.1.4 WTTPSiteV3
- Must extend WTTPStorageV3
- Must implement all WTTP methods (HEAD, GET, PUT, etc.)
- Must check method permissions before performing operations

#### 8.1.5 WTTPGatewayV3
- Must provide a unified interface for accessing WTTP sites
- Must handle byte range requests
- Must standardize response formats

### 8.2 Client Requirements

#### 8.2.1 Protocol Version
Clients must specify "WTTP/3.0" as the protocol version in all requests.

#### 8.2.2 Range Handling
Clients must properly format range requests according to the Range structure.

#### 8.2.3 Royalty Payments
Clients must include sufficient payment for royalties when registering data points.

## 9. Examples

### 9.1 Setting up a Site

```javascript
// Deploy DataPointStorage
const DataPointStorage = await ethers.getContractFactory("DataPointStorageV2");
const dps = await DataPointStorage.deploy();

// Deploy DataPointRegistry
const DataPointRegistry = await ethers.getContractFactory("DataPointRegistryV2");
const dpr = await DataPointRegistry.deploy(owner.address, dps.address, royaltyRate);

// Deploy WTTPSite with default header
const WTTPSite = await ethers.getContractFactory("WTTPSiteV3");
const site = await WTTPSite.deploy(dpr.address, DEFAULT_HEADER, owner.address);
```

### 9.2 Creating a Resource

```javascript
// Prepare PUT request
const putRequest = {
  head: {
    requestLine: {
      path: "/example.txt",
      protocol: "WTTP/3.0",
      method: 3, // PUT
    },
    ifNoneMatch: ethers.zeroPadBytes("0x", 32),
    ifModifiedSince: 0
  },
  mimeType: "0x7470", // text/plain
  charset: "0x7508", // utf-8
  encoding: "0x6964", // identity
  language: "0x6575", // en-US
  data: [
    {
      data: ethers.toUtf8Bytes("Hello, Web3!"),
      publisher: signer.address,
      chunkIndex: 0
    }
  ]
};

// Send the PUT request with royalty payment
const tx = await site.PUT(putRequest, { value: ethers.parseEther("0.0001") });
await tx.wait();
```

### 9.3 Retrieving a Resource

```javascript
// Create a Gateway instance for range support
const WTTPGateway = await ethers.getContractFactory("WTTPGatewayV3");
const gateway = await WTTPGateway.deploy();

// Request full resource
const getRequest = {
  head: {
    requestLine: {
      path: "/example.txt",
      protocol: "WTTP/3.0",
      method: 1 // GET
    },
    ifNoneMatch: ethers.zeroPadBytes("0x", 32),
    ifModifiedSince: 0
  },
  rangeBytes: {
    start: 0,
    end: 0 // 0 means to the end
  }
};

const response = await gateway.GET(site.address, getRequest);
const content = ethers.toUtf8String(response.data);
console.log(content); // "Hello, Web3!"
```

### 9.4 Byte Range Request

```javascript
// Request bytes 0-5 only
const rangeRequest = {
  head: {
    requestLine: {
      path: "/example.txt",
      protocol: "WTTP/3.0",
      method: 1 // GET
    },
    ifNoneMatch: ethers.zeroPadBytes("0x", 32),
    ifModifiedSince: 0
  },
  rangeBytes: {
    start: 0,
    end: 5
  }
};

const response = await gateway.GET(site.address, rangeRequest);
console.log(ethers.toUtf8String(response.data)); // "Hello,"
```

## 10. Future Considerations

### 10.1 Protocol Extensions
- Support for additional HTTP methods (TRACE, CONNECT, etc.)
- Enhanced caching mechanisms
- Content negotiation

### 10.2 Performance Optimizations
- Improved chunking algorithms
- Compression support
- Layer 2 scaling solutions

### 10.3 Security Enhancements
- Content encryption
- Access control lists
- Signature verification

## 11. Conclusion

The WTTP protocol provides a standardized way to interact with on-chain content using familiar web paradigms. By implementing HTTP-like functionality on the blockchain, WTTP enables decentralized web applications to store, retrieve, and manage resources in a familiar and efficient manner.

This specification defines the structure, operations, and implementation details of WTTP version 3.0, providing a foundation for developers to build decentralized web applications that leverage the unique properties of blockchain technology.