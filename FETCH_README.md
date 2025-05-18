# WTTP Fetch Resource Guide

This guide explains how to use the WTTP fetch functionality to retrieve resources from a WTTP site via the WTTPGateway.

## Overview

The fetch functionality allows you to:

1. Retrieve resources from a WTTP site using the WTTPGateway
2. Perform HEAD requests to get resource metadata without content
3. Specify byte ranges to retrieve partial content
4. Use conditional requests with If-Modified-Since and If-None-Match headers

## Using the Hardhat Task

The `fetch` task provides a command-line interface for fetching resources.

### Basic Usage

```bash
npx hardhat fetch --wttp <gateway-address> --site <site-address> --path <resource-path>
```

Example:
```bash
npx hardhat fetch --wttp 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d --site 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1 --path /index.html
```

### Optional Parameters

#### HEAD Request

To perform a HEAD request (metadata only, no content):

```bash
npx hardhat fetch --wttp <gateway-address> --site <site-address> --path <resource-path> --head
```

#### Byte Range

To retrieve a specific byte range of the resource:

```bash
npx hardhat fetch --wttp <gateway-address> --site <site-address> --path <resource-path> --range "10-20"
```

This will retrieve bytes 10 through 20 of the resource.

You can also use negative indices to count from the end:

```bash
npx hardhat fetch --wttp <gateway-address> --site <site-address> --path <resource-path> --range "-10-0"
```

This will retrieve the last 10 bytes of the resource.

#### Conditional Requests

To only retrieve the resource if it has been modified since a specific time:

```bash
npx hardhat fetch --wttp <gateway-address> --site <site-address> --path <resource-path> --ifModifiedSince 1715000000
```

To only retrieve the resource if its ETag doesn't match:

```bash
npx hardhat fetch --wttp <gateway-address> --site <site-address> --path <resource-path> --ifNoneMatch "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
```

## Using the Script in Code

You can also use the fetch functionality programmatically in your code:

```typescript
import { ethers } from "hardhat";
import { fetchResource } from "./scripts/fetchResource";

async function example() {
  // Connect to the gateway contract
  const gateway = await ethers.getContractAt("WTTPGatewayV3", "0xGatewayAddress");
  
  // Fetch a resource
  const response = await fetchResource(
    gateway,
    "0xSiteAddress",
    "/path/to/resource",
    {
      // Optional parameters
      range: { start: 10, end: 20 },
      ifModifiedSince: 1715000000,
      ifNoneMatch: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      headRequest: false
    }
  );
  
  // Process the response
  console.log(`Status: ${response.head.responseLine.code}`);
  
  if (response.head.responseLine.code === 200 || response.head.responseLine.code === 206) {
    console.log(`Content: ${ethers.toUtf8String(response.data)}`);
  }
}
```

## Response Status Codes

- `200 OK`: The request was successful
- `206 Partial Content`: The range request was successful
- `304 Not Modified`: The resource has not been modified (for conditional requests)
- `416 Range Not Satisfiable`: The requested range is out of bounds

## Examples

### Fetch an entire resource

```bash
npx hardhat fetch --wttp 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d --site 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1 --path /index.html
```

### Fetch only the metadata

```bash
npx hardhat fetch --wttp 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d --site 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1 --path /index.html --head
```

### Fetch the first 100 bytes

```bash
npx hardhat fetch --wttp 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d --site 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1 --path /index.html --range "0-100"
```

### Fetch the last 50 bytes

```bash
npx hardhat fetch --wttp 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d --site 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1 --path /index.html --range "-50-0"
```