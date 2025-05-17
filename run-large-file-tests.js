#!/usr/bin/env node

/**
 * Script to run large file tests with different configurations
 * Usage: node run-large-file-tests.js [--chunks=100] [--size=40] [--output=results.json]
 * 
 * Options:
 *   --chunks=N    Number of chunks to test (default: 100)
 *   --size=N      Size of each chunk in KB (default: 40)
 *   --output=FILE Output file for combined results (default: large-file-test-results.json)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let chunks = 100;
let chunkSize = 40;
let outputFile = 'large-file-test-results.json';

args.forEach(arg => {
  if (arg.startsWith('--chunks=')) {
    chunks = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--size=')) {
    chunkSize = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--output=')) {
    outputFile = arg.split('=')[1];
  }
});

console.log(`Running large file tests with ${chunks} chunks of ${chunkSize}KB each`);

// Update the test file with the specified configuration
const testFilePath = path.join(__dirname, 'test', '05-large-scale.test.ts');
let testFileContent = fs.readFileSync(testFilePath, 'utf8');

// Replace the constants
testFileContent = testFileContent.replace(
  /const CHUNK_SIZE = (\d+) \* 1024;/,
  `const CHUNK_SIZE = ${chunkSize} * 1024;`
);

testFileContent = testFileContent.replace(
  /const TARGET_CHUNKS = (\d+);/,
  `const TARGET_CHUNKS = ${chunks};`
);

// Update the output file name
testFileContent = testFileContent.replace(
  /const RESULTS_FILE = ".*";/,
  `const RESULTS_FILE = "${outputFile}";`
);

// Write the updated test file
fs.writeFileSync(testFilePath, testFileContent);

// Run the test
try {
  console.log('Running test...');
  execSync('npx hardhat test test/05-large-scale.test.ts', { stdio: 'inherit' });
  console.log(`Test completed successfully. Results written to ${outputFile}`);
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}