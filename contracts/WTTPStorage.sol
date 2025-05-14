// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPPermissions.sol";
import "./bfs/DataPointRegistry.sol";
import "./libraries/WTTPTypes.sol";

// HeaderInfo constant defaultFileHeader = HeaderInfo({
//     cache: defaultCacheControl,
//     redirect: Redirect(0, ""),
//     allowedMethods: methodsToMask([
//         Method.GET,
//         Method.PUT,
//         Method.DELETE,
//         Method.PATCH,
//         Method.HEAD,
//         Method.OPTIONS,
//         Method.LOCATE,
//         Method.DEFINE
//     ]),
//     resourceAdmin: bytes32(0)
// });

// HeaderInfo constant defaultDirectoryHeader = HeaderInfo({
//     cache: defaultCacheControl,
//     redirect: Redirect(300, "./index.html"), // leading ./ indicates a relative path
//     allowedMethods: methodsToMask([
//         Method.GET,
//         Method.PUT,
//         Method.DELETE,
//         Method.HEAD,
//         Method.OPTIONS,
//         Method.DEFINE
//     ]),
//     resourceAdmin: bytes32(0)
// });

// ResourceMetadata constant defaultFileMetadata = ResourceMetadata({
//     mimeType: 0x7570, // t/p (text/plain)
//     charset: 0x7508, // u/8 (utf-8)
//     encoding: 0x6964, // id (identity)
//     location: 0x6463, // d/c (datapoint/chunk)
//     size: 0,  // calculated
//     version: 0, // calculated
//     lastModified: 0, // calculated
//     header: getHeaderAddress(defaultFileHeader)
// });

// ResourceMetadata constant defaultDirectoryMetadata = ResourceMetadata({
//     mimeType: 0x756f, // t/o (text/json)
//     charset: 0x7508, // u/8 (utf-8)
//     encoding: 0x6964, // id (identity/uncompressed)
//     location: 0x6463, // d/c (datapoint/chunk)
//     size: 0, // calculated
//     version: 0,
//     lastModified: 0,
//     header: getHeaderAddress(defaultDirectoryHeader)
// });

/// @title WTTP Storage Contract
/// @notice Manages web resource storage and access control
/// @dev Core storage functionality for the WTTP protocol
abstract contract WTTPStorageV3 is WTTPPermissionsV3 {

    CacheControl zeroCacheControl = CacheControl({
        maxAge: 0,
        sMaxage: 0,
        noStore: false,
        noCache: false,
        immutableFlag: false,
        publicFlag: false,
        mustRevalidate: false,
        proxyRevalidate: false,
        mustUnderstand: false,
        staleWhileRevalidate: 0,
        staleIfError: 0
    });

    HeaderInfo zeroHeader = HeaderInfo({
        cache: zeroCacheControl,
        redirect: Redirect(0, ""),
        methods: 0,
        resourceAdmin: bytes32(0)
    });

    Method[] allMethods = new Method[](9);
    

    uint16 constant MAX_METHODS = 512;
    

    bytes32 immutable ZERO_HEADER_HASH = getHeaderAddress(zeroHeader);

    ResourceMetadata zeroMetadata = ResourceMetadata({
        mimeType: 0x0000,
        charset: 0x0000,
        encoding: 0x0000,
        location: 0x0000,
        size: 0,
        version: 0,
        lastModified: 0,
        header: bytes32(0)
    });

    bytes32 immutable ZERO_METADATA_HASH = keccak256(abi.encode(zeroMetadata));

    DataPointRegistryV2 public DPR_;
    function DPS() internal view virtual returns (DataPointStorageV2) {
        return DPR_.DPS_();
    }

    constructor(address _dpr, address _owner) WTTPPermissionsV3(_owner) {
        DPR_ = DataPointRegistryV2(_dpr);

        // // * is the default for directories
        // resourceMetadata["*"] = defaultDirectoryMetadata;
        // // . is the default for files
        // resourceMetadata["."] = defaultFileMetadata;
        // headers[headerPath] = _header;
    }

    mapping(bytes32 header => HeaderInfo) private header;
    mapping(string path => ResourceMetadata) private metadata;
    mapping(string path => bytes32[]) private resource;

    function _pathExists(string memory _path) internal view returns (bool) {
        return resource[_path].length > 0 && 
            keccak256(abi.encode(metadata[_path])) != keccak256(abi.encode(zeroMetadata));
    }

    modifier notImmutable(string memory _path) {
        if (header[metadata[_path].header].cache.immutableFlag && resource[_path].length > 0) {
            revert ResourceImmutable(_path);
        }
        _;
    }

    function _isResourceAdmin(string memory _path, address _account) internal view returns (bool) {
        return _isSiteAdmin(_account) || 
            hasRole(header[metadata[_path].header].resourceAdmin, _account);
    }

    modifier onlyResourceAdmin(string memory _path) {
        if (!_isResourceAdmin(_path, msg.sender)) {
            revert NotResourceAdmin(_path, msg.sender);
        }
        _;
    }
    // Internal CRUD functions
    // Header
    function _createHeader(
        HeaderInfo memory _header
    ) internal virtual returns (bytes32 headerAddress) {
        headerAddress = getHeaderAddress(_header);
        if (header[headerAddress].methods == 0) {

            if (
                _header.methods == 0 || 
                _header.methods > MAX_METHODS
            ) {
                emit MalformedParameter("methods", abi.encode(_header.methods));
            }

            // redirect code must be 0 or between 300 and 310
            // location must be set if code is a valid 3xx code
            if (
                (_header.redirect.code < 300
                || _header.redirect.code > 309)
            ) {
                if (_header.redirect.code > 0) {
                    emit MalformedParameter("redirect", abi.encode(_header.redirect));
                }
            } else if (bytes(_header.redirect.location).length > 0) {
                emit MalformedParameter("redirect", abi.encode(_header.redirect));
            }

            header[headerAddress] = _header;

        } else {
            emit HeaderExists(headerAddress);
        }
    }

    function _readHeader(
        bytes32 _headerAddress
    ) internal virtual view returns (HeaderInfo memory) {
        return header[_headerAddress];
    }

    function _deleteHeader(
        bytes32 _headerAddress
    ) internal virtual {
        delete header[_headerAddress];
    }

    // Metadata
    function _createMetadata(
        string memory _path,
        ResourceMetadata memory _metadata
    ) internal virtual {
        if (_pathExists(_path)) {
            emit ResourceExists(_path);
        }
        if (
            header[_metadata.header].methods == 0 || 
            header[_metadata.header].methods > MAX_METHODS
        ) {
            emit MalformedParameter("methods", abi.encode(header[_metadata.header].methods));
        }
        if (_metadata.mimeType == 0x0000) {
            emit MalformedParameter("mimeType", abi.encode(_metadata.mimeType));
        }
        if (_metadata.charset == 0x0000) {
            emit MalformedParameter("charset", abi.encode(_metadata.charset));
        }
        if (_metadata.encoding == 0x0000) {
            emit MalformedParameter("encoding", abi.encode(_metadata.encoding));
        }
        if (_metadata.location == 0x0000) {
            emit MalformedParameter("location", abi.encode(_metadata.location));
        }
        if (_metadata.header == bytes32(0) || _metadata.header == ZERO_HEADER_HASH) {
            emit MalformedParameter("header", abi.encode(_metadata.header));
        }

        _updateMetadata(_path, _metadata);

    }

    function _readMetadata(
        string memory _path
    ) internal virtual view returns (ResourceMetadata memory _metadata) {
        _metadata = metadata[_path];
        return _metadata;
    }

    function _updateMetadataStats(string memory _path) internal virtual {
        // set calculated values
        metadata[_path].lastModified = block.timestamp;
        metadata[_path].version ++;

        emit MetadataUpdated(_path);
    }

    function _updateMetadata(
        string memory _path, 
        ResourceMetadata memory _metadata
    ) internal virtual notImmutable(_path) {
        // set calculated values
        _updateMetadataStats(_path);

        // store the rest of the metadata
        metadata[_path].mimeType = _metadata.mimeType;
        metadata[_path].charset = _metadata.charset;
        metadata[_path].encoding = _metadata.encoding;
        metadata[_path].location = _metadata.location;

        // extra instructions for immutable resources
        if (header[_metadata.header].cache.immutableFlag && resource[_path].length > 0) {
            // Create a mask that will turn off PUT, PATCH, and DELETE methods
            Method[] memory modificationMethods = new Method[](3);
            modificationMethods[0] = Method.PUT;
            modificationMethods[1] = Method.PATCH;
            modificationMethods[2] = Method.DELETE;
            uint16 modificationMethodsMask = methodsToMask(modificationMethods);

            HeaderInfo memory _header = header[_metadata.header];
            // Use bitwise AND with inverted mask to disable only those methods
            uint16 _methods = _header.methods & ~modificationMethodsMask;

            if (_methods != _header.methods) {
                _header.methods = _methods;
                bytes32 _headerAddress = _createHeader(_header);
                _metadata.header = _headerAddress;
                
            }
        }

        metadata[_path].header = _metadata.header;

    }
    
    function _deleteMetadata(
        string memory _path
    ) internal virtual {
        _updateMetadata(_path, zeroMetadata);
        emit MetadataDeleted(_path);
    }

    // Resources
    function _createResource(
        string memory _path,
        DataRegistration memory _dataRegistration
    ) internal virtual notImmutable(_path) {

        if (bytes(_path).length == 0) {
            emit MalformedParameter("path", abi.encode(_path));
        }
        if (_dataRegistration.data.length == 0) {
            emit MalformedParameter("data", abi.encode(_dataRegistration.data));
        }

        bytes32 _dataPointAddress = DPR_.registerDataPoint{value: msg.value}(
            _dataRegistration.data,
            _dataRegistration.publisher
        );

        if (_dataRegistration.chunkIndex > resource[_path].length) {
            emit OutOfBoundsChunk(_path, _dataRegistration.chunkIndex);
        } else if (_dataRegistration.chunkIndex == resource[_path].length) {
            // add a new chunk
            resource[_path].push(_dataPointAddress);
            metadata[_path].size += _dataRegistration.data.length;
        } else {
            // update an existing chunk
            resource[_path][_dataRegistration.chunkIndex] = _dataPointAddress;
            metadata[_path].size = 
                metadata[_path].size 
                - DPS().dataPointSize(resource[_path][_dataRegistration.chunkIndex]) 
                + DPS().dataPointSize(_dataPointAddress
            );
        }

        _updateMetadataStats(_path);
    }

    // Returns all the datapoint addresses for a given resource
    function _readResource(
        string memory _path
    ) internal virtual view returns (bytes32[] memory) {
        return resource[_path];
    }

    function _updateResource(
        string memory _path,
        bytes32 _dataPointAddress,
        uint256 _chunkIndex
    ) internal virtual notImmutable(_path) {
        if (_chunkIndex > resource[_path].length) {
            emit OutOfBoundsChunk(_path, _chunkIndex);
        } else if (_chunkIndex == resource[_path].length) {
            // add a new chunk
            resource[_path].push(_dataPointAddress);
            metadata[_path].size += DPS().dataPointSize(_dataPointAddress);
            if (_chunkIndex == 0) emit ResourceCreated(_path);
        } else {
            // update an existing chunk
            resource[_path][_chunkIndex] = _dataPointAddress;
            metadata[_path].size = 
                metadata[_path].size 
                - DPS().dataPointSize(resource[_path][_chunkIndex]) 
                + DPS().dataPointSize(_dataPointAddress);
        }

        _updateMetadataStats(_path);
        emit ResourceUpdated(_path, _chunkIndex);
    }

    function _deleteResource(
        string memory _path
    ) internal virtual notImmutable(_path) {
        delete resource[_path];
        metadata[_path].size = 0;
        _deleteMetadata(_path);
        emit ResourceDeleted(_path);
    }

    // Writes a data point to the resource, used by both create and update
    // requires _dataRegistration to be sorted by chunkIndex
    function _uploadData(
        string memory _path,
        DataRegistration[] memory _dataRegistration
    )
        internal virtual
        notImmutable(_path)
        onlyResourceAdmin(_path)
        returns (bytes32 _dataPointAddress)
    {

        for (uint i = 0; i < _dataRegistration.length; i++) {
            if (_dataRegistration[i].chunkIndex > resource[_path].length) {
                emit OutOfBoundsChunk(_path, _dataRegistration[i].chunkIndex);
            } else {
                _dataPointAddress = DPR_.registerDataPoint{value: msg.value}(
                    _dataRegistration[i].data,
                    _dataRegistration[i].publisher
                );
                _updateResource(_path, _dataPointAddress, _dataRegistration[i].chunkIndex);
            }
        }
    }
}
