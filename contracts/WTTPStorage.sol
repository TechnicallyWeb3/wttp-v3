// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPPermissions.sol";
import "./interfaces/IDataPointRegistryV2.sol";
import "./interfaces/IDataPointStorageV2.sol";

/// @title WTTP Storage Contract
/// @notice Manages web resource storage and access control
/// @dev Core storage functionality for the WTTP protocol
abstract contract WTTPStorageV3 is WTTPPermissionsV3 {

    uint16 constant MAX_METHODS = 511;
    HeaderInfo zeroHeader;
    bytes32 immutable ZERO_HEADER = keccak256(abi.encode(zeroHeader));
    ResourceMetadata zeroMetadata;

    IDataPointRegistryV2 internal DPR_;

    function DPS() public view virtual returns (IDataPointStorageV2) {
        return DPR_.DPS_();
    }

    function DPR() public view virtual returns (IDataPointRegistryV2) {
        return DPR_;
    }

    function setDPR(address _dpr) public onlyRole(DEFAULT_ADMIN_ROLE) {
        DPR_ = IDataPointRegistryV2(_dpr);
    }

    constructor(
        address _dpr, 
        address _owner, 
        HeaderInfo memory _defaultHeader
    ) WTTPPermissionsV3(_owner) {
        DPR_ = IDataPointRegistryV2(_dpr);
        header[bytes32(0)] = _defaultHeader;
    }

    mapping(bytes32 header => HeaderInfo) private header;
    mapping(string path => ResourceMetadata) private metadata;
    mapping(string path => bytes32[]) private resource;

    modifier notImmutable(string memory _path) {
        if (header[metadata[_path].header].cache.immutableFlag && resource[_path].length > 0) {
            revert ResourceImmutable(_path);
        }
        _;
    }

    // Internal CRUD functions
    // Header
    function _createHeader(
        HeaderInfo memory _header
    ) internal virtual returns (bytes32 headerAddress) {
        headerAddress = getHeaderAddress(_header);

        // comparing against methods == 0 will save gas, but this is more accurate
        if (getHeaderAddress(header[headerAddress]) == ZERO_HEADER) {

            if (
                _header.methods == 0 || 
                _header.methods > MAX_METHODS
            ) {
                emit MalformedParameter("methods", abi.encode(_header.methods));
            }

            // redirect code must be 0 or between 300 and 309
            // location must be set if code is a valid 3xx code
            if (
                (_header.redirect.code < 300
                || _header.redirect.code > 309)
            ) {
                if (_header.redirect.code > 0) {
                    emit MalformedParameter("redirect", abi.encode(_header.redirect));
                }
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

    function _updateDefaultHeader(
        HeaderInfo memory _header
    ) external virtual onlyRole(SITE_ADMIN_ROLE) {
        header[bytes32(0)] = _header;
    }

    function _readMetadata(
        string memory _path
    ) internal virtual view returns (ResourceMetadata memory _metadata) {
        _metadata = metadata[_path];
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
    ) internal virtual {
        // set calculated values
        _updateMetadataStats(_path);

        // store the rest of the metadata
        metadata[_path].mimeType = _metadata.mimeType;
        metadata[_path].charset = _metadata.charset;
        metadata[_path].encoding = _metadata.encoding;
        metadata[_path].language = _metadata.language;
        metadata[_path].location = _metadata.location;

        HeaderInfo memory _header = header[_metadata.header];

        bytes32 _headerAddress = _createHeader(_header);
        _metadata.header = _headerAddress;
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
    ) internal virtual returns (bytes32 _dataPointAddress) {

        if (bytes(_path).length == 0) {
            emit MalformedParameter("path", abi.encode(_path));
        }
        if (_dataRegistration.data.length == 0) {
            emit MalformedParameter("data", abi.encode(_dataRegistration.data));
        }
        _dataPointAddress = calculateDataPointAddress(_dataRegistration.data, DPS().VERSION());

        uint256 _royalty = DPR_.getDataPointRoyalty(_dataPointAddress);

        DPR_.registerDataPoint{value: _royalty}(
            _dataRegistration.data,
            _dataRegistration.publisher
        );

        _updateResource(_path, _dataPointAddress, _dataRegistration.chunkIndex);
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
    ) internal virtual {
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
    ) internal virtual {
        delete resource[_path];
        metadata[_path].size = 0;
        _deleteMetadata(_path);
        emit ResourceDeleted(_path);
    }

    // Writes a data point to the resource, used by both create and update
    // requires _dataRegistration to be sorted by chunkIndex
    function _uploadResource(
        string memory _path,
        DataRegistration[] memory _dataRegistration
    )
        internal virtual
        notImmutable(_path)
        returns (bytes32[] memory _dataPointAddresses)
    {
        _dataPointAddresses = new bytes32[](_dataRegistration.length);
        for (uint i = 0; i < _dataRegistration.length; i++) {
            _dataPointAddresses[i] = _createResource(_path, _dataRegistration[i]);
        }
    }
}
