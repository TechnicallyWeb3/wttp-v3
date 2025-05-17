# WTTP File Upload Scripts

This repository contains Hardhat Ignition scripts to deploy a WTTP site and upload files to it.

## Deployment

To deploy a WTTP site, use the Hardhat Ignition module:

```bash
npx hardhat ignition deploy ignition/modules/WTTPSite.ts
```

This will deploy:
1. A DataPointStorage contract
2. A DataPointRegistry contract
3. A WTTPSiteImpl contract

You can also provide parameters:

```bash
npx hardhat ignition deploy ignition/modules/WTTPSite.ts --parameters '{"owner": "0x123...abc", "dprAddress": "0x456...def"}'
```

## Uploading Files

Once you have deployed a WTTP site, you can upload files to it using the provided task:

```bash
npx hardhat upload --site <site-address> --source <source-file-path> --destination <destination-path>
```

For example:

```bash
npx hardhat upload --site 0x123...abc --source ./myfile.txt --destination /myfile.txt
```

### How It Works

The upload script:

1. Reads the source file
2. Chunks the data into 32KB chunks
3. Checks if the resource already exists on the WTTP site
4. Checks royalties for each chunk before uploading
5. Uses PUT for new resources or PATCH for existing resources
6. Verifies the upload by checking the resource metadata

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