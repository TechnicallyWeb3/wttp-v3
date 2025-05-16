// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPStorage.sol";

/// @title Test implementation of WTTPStorage
/// @notice Used for testing the WTTPStorage contract
/// @dev Exposes internal functions as public for testing purposes
contract TestStorage is WTTPStorageV3 {
    event Success();
    event Error();

    constructor(
        address _dpr, 
        address _owner, 
        HeaderInfo memory _defaultHeader
    ) WTTPStorageV3(_dpr, _owner, _defaultHeader) {}

    function testGetHeaderAddress(HeaderInfo memory _header) public pure returns (bytes32) {
        return getHeaderAddress(_header);
    }
    
    // Expose header functions
    function testCreateHeader(HeaderInfo memory _header) public returns (bytes32) {
        return _createHeader(_header);
    }
    
    function testReadHeader(bytes32 _headerAddress) public view returns (HeaderInfo memory) {
        return _readHeader(_headerAddress);
    }
    
    function testDeleteHeader(bytes32 _headerAddress) public {
        _deleteHeader(_headerAddress);
        emit Success();
    }
    
    // Expose metadata functions
    function testCreateMetadata(string memory _path, ResourceMetadata memory _metadata) public {
        _createMetadata(_path, _metadata);
        emit Success();
    }
    
    function testReadMetadata(string memory _path) public view returns (ResourceMetadata memory) {
        return _readMetadata(_path);
    }
    
    function testUpdateMetadata(string memory _path, ResourceMetadata memory _metadata) public {
        _updateMetadata(_path, _metadata);
        emit Success();
    }
    
    function testDeleteMetadata(string memory _path) public {
        _deleteMetadata(_path);
        emit Success();
    }
    
    // Expose resource functions
    function testCreateResource(string memory _path, DataRegistration memory _dataRegistration) public payable {
        _createResource(_path, _dataRegistration);
        emit Success();
    }
    
    function testReadResource(string memory _path) public view returns (bytes32[] memory) {
        return _readResource(_path);
    }
    
    function testUpdateResource(string memory _path, bytes32 _dataPointAddress, uint256 _chunkIndex) public {
        _updateResource(_path, _dataPointAddress, _chunkIndex);
        emit Success();
    }
    
    function testDeleteResource(string memory _path) public {
        _deleteResource(_path);
        emit Success();
    }
    
    function testUploadData(string memory _path, DataRegistration[] memory _dataRegistration) public payable returns (bytes32[] memory) {
        return _uploadResource(_path, _dataRegistration);
    }
    
}
