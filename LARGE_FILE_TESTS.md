# Large File Testing for WTTP-V3

This document explains how to run the large file tests for the WTTP-V3 protocol.

## Overview

The large file tests are designed to test the protocol's ability to handle large files by:

1. Uploading a large number of chunks to a WTTP site
2. Verifying the chunks were stored correctly
3. Retrieving the chunks with various byte ranges
4. Measuring performance metrics for upload and retrieval

## Running the Tests

You can run the tests using the provided script:

```bash
node run-large-file-tests.js [--chunks=100] [--size=40] [--output=results.json]
```

### Options

- `--chunks=N`: Number of chunks to test (default: 100)
- `--size=N`: Size of each chunk in KB (default: 40)
- `--output=FILE`: Output file for test results (default: large-file-test-results.json)

### Examples

Test with 50 chunks of 20KB each:
```bash
node run-large-file-tests.js --chunks=50 --size=20 --output=small-test-results.json
```

Test with 200 chunks of 40KB each:
```bash
node run-large-file-tests.js --chunks=200 --size=40 --output=medium-test-results.json
```

## Test Results

The test results are saved in a JSON file with the following structure:

```json
{
  "testConfig": {
    "chunkSize": 40960,
    "totalChunks": 100,
    "totalSizeBytes": 4096000,
    "totalSizeMB": 3.90625
  },
  "uploadStats": {
    "startTime": 1747476161468,
    "endTime": 1747476166468,
    "totalTimeSeconds": 5,
    "simulated": true
  },
  "retrievalTests": [
    {
      "rangeName": "First 1MB",
      "rangeStart": 0,
      "rangeEnd": 1048576,
      "rangeSizeMB": 1,
      "simulated": true,
      "responseCode": 206,
      "expectedLength": 1048576,
      "actualLength": 1048576,
      "retrievalTimeSeconds": 0.2,
      "mbRetrieved": 1,
      "mbPerSecond": 5,
      "success": true,
      "contentVerification": "Simulated Success"
    },
    // ... more test ranges
  ],
  "errors": [],
  "success": true,
  "timestamp": "2025-05-17T10:02:46.468Z",
  "transactionsSupported": false,
  "verificationResults": {
    "expectedChunks": 100,
    "actualChunks": 100,
    "success": true,
    "simulated": true
  }
}
```

## Simulation Mode

When running in a test environment that doesn't support sending transactions, the tests will run in simulation mode. In this mode:

1. No actual transactions are sent to the blockchain
2. Upload and retrieval operations are simulated
3. Performance metrics are estimated based on typical values
4. The `simulated` flag is set to `true` in the results

## Troubleshooting

If you encounter gas-related issues when running with a large number of chunks, try:

1. Reducing the number of chunks
2. Reducing the chunk size
3. Adjusting the batch size in the test file (default is 5 chunks per batch)
4. Increasing the gas limit in the hardhat.config.ts file

## Known Limitations

- The maximum file size is limited by gas constraints when running on actual blockchains
- Performance may vary significantly between test environments and actual blockchain networks