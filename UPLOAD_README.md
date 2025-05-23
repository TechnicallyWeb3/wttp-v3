# WTTP Upload Scripts

This repository contains Hardhat Ignition scripts to deploy a WTTP site and upload files and directories to it.

## Deployment

To deploy a WTTP site, use the Hardhat Ignition module:

```bash
npx hardhat ignition deploy ignition/modules/WTTPSite.ts --network <network>
```

This will deploy:
1. A DataPointStorage contract
2. A DataPointRegistry contract
3. A Web3Site contract

Note: The network must be specified, ignition scripts do not work on the hardhat evm.

You can also provide parameters:

```bash
npx hardhat ignition deploy ignition/modules/WTTPSite.ts --parameters '{"owner": "0x123...abc", "dprAddress": "0x456...def"}'
```

## Uploading Files and Directories

Once you have deployed a WTTP site, you can upload files or directories to it using the provided task:

```bash
npx hardhat upload --site <site-address> --source <source-path> --destination <destination-path>
```

The task automatically detects whether the source path is a file or a directory and uses the appropriate upload method.

### Examples

Uploading a file:

```bash
npx hardhat upload --site 0x123...abc --source ./myfile.txt --destination /myfile.txt
```

Uploading a directory:

```bash
npx hardhat upload --site 0x123...abc --source ./my-website --destination /my-website/
```

## How It Works

### File Upload

The file upload script:

1. Reads the source file
2. Chunks the data into 32KB chunks
3. Checks if the resource already exists on the WTTP site
4. Checks royalties for each chunk before uploading
5. Uses PUT for new resources or PATCH for existing resources
6. Verifies the upload by checking the resource metadata

### Directory Upload

The directory upload script:

1. Scans the source directory recursively to identify all files and subdirectories
2. Creates a directory representation with:
   - HTTP status code 300 (Multiple Choices)
   - Location header pointing to "./index.html" (or appropriate fallback)
   - No metadata (mimetype, charset, encoding, language all set to 0x0000)
   - JSON payload containing a directory listing
3. Uploads each file in the directory using the file upload script
4. Creates subdirectories with their own metadata and redirect headers

### Directory Structure Representation

Directories are represented with a special JSON structure that lists all files and subdirectories:

```json
{
  "directory": {
    "index.html": {
      "mimeType": "text/html",
      "charset": "utf-8",
      "encoding": "identity",
      "language": "en-US"
    },
    "styles.css": {
      "mimeType": "text/css",
      "charset": "utf-8",
      "encoding": "identity",
      "language": "en-US"
    },
    "images": {
      "directory": true
    }
  }
}
```

This structure allows clients to discover the contents of a directory and select the most appropriate files based on their preferences.

### File Chunking

Files are automatically chunked into 32KB pieces to optimize gas usage and ensure efficient storage on the blockchain. Each chunk is processed individually:

1. The chunk's data point address is calculated
2. Royalty is checked for the data point
3. The chunk is uploaded using the appropriate method (PUT or PATCH)

## Implementation Details

The implementation uses:

- Hardhat Ignition for deployment
- TypeScript for scripting
- WTTP protocol v3.0 for web-like interactions with blockchain resources

The scripts handle:
- MIME type detection based on file extension
- Proper chunking of large files
- Royalty checks before uploading
- Appropriate HTTP-like methods (PUT/PATCH) based on resource existence
- Directory structure representation with redirect headers
- Recursive processing of nested directories