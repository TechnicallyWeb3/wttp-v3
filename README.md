# WTTP Protocol v3

## Overview

WTTP (Web Three Transfer Protocol) is a blockchain-based protocol that implements HTTP-like functionality for storing, retrieving, and managing web resources directly on the blockchain. It provides a standardized way to interact with on-chain content using familiar web paradigms.

This implementation (v3) focuses on separating core storage functionality from the protocol logic, enabling more efficient resource management and extended capabilities like byte range requests.

## Key Features

- **HTTP-like Methods**: Implements familiar methods such as GET, PUT, PATCH, DELETE, HEAD, and OPTIONS
- **Resource Management**: Store and retrieve web resources with associated metadata
- **Access Control**: Fine-grained permission system based on roles
- **Byte Range Support**: Request specific portions of resources
- **Chunked Storage**: Resources are stored as collections of data points for efficient management
- **Metadata & Headers**: Full support for HTTP-like headers and metadata
- **Gateway Pattern**: Unified interface with extended functionality

## Architecture

WTTP v3 is built on a layered architecture:

1. **Data Storage Layer**: Managed by the Data Point Storage system
2. **Registry Layer**: Data Point Registry for tracking data ownership and royalties
3. **Core Protocol Layer**: WTTP Site implementation for resource manipulation
4. **Gateway Layer**: Extended functionality and standardized interfaces

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

## Contract Overview

### Core Contracts

- **WTTPGatewayV3**: Provides extended functionality including byte range support and standardized interfaces
- **WTTPSiteV3**: Implements core WTTP protocol methods for HTTP-like operations
- **WTTPStorageV3**: Manages web resource storage and access to data points
- **WTTPPermissionsV3**: Handles role-based access control for resources

### Support Contracts

- **DataPointRegistryV2**: Registers data points and manages royalty payments
- **DataPointStorageV2**: Provides basic storage for data chunks

## Setup and Installation

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Hardhat

### Installation

1. Clone the repository:
```bash
git clone https://github.com/TechnicallyWeb3/wttp-v3.git
cd wttp-v3
```

2. Install dependencies:
```bash
npm install
```

3. Compile contracts:
```bash
npx hardhat compile
```

## Testing

The project includes comprehensive tests for all core functionality:

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/02-storage.test.ts
```

## Usage Examples

### Working with the WTTP Protocol

#### Setting up a Site
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

#### Creating a Resource

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
  location: "0x6463", // direct
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

#### Retrieving a Resource

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

## Advanced Features

### Byte Range Requests

WTTP supports byte range requests similar to HTTP:

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

### Permission Management

```javascript
// Create a resource role
const resourceRole = ethers.keccak256(ethers.toUtf8Bytes("RESOURCE_ADMIN"));
await site.connect(siteAdmin).createResourceRole(resourceRole);

// Grant role to a user
await site.connect(siteAdmin).grantRole(resourceRole, userAddress);
```

## License

This project is licensed under the AGPL-3.0 License - see the LICENSE file for details.
