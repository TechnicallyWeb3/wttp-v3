// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPStorage.sol";

/// @title WTTP Site Contract
/// @notice Implements core WTTP protocol methods
/// @dev Handles HTTP-like operations on the blockchain
abstract contract WTTPSiteV3 is WTTPStorageV3 {

        
    function _isResourceAdmin(string memory _path, address _account) internal view returns (bool) {
        bytes32 _resourceAdmin = _readHeader(_readMetadata(_path).header).resourceAdmin;
        return _isSiteAdmin(_account) || 
            hasRole(_resourceAdmin, _account) || 
            _resourceAdmin == bytes32(type(uint256).max); // indicates public access
    }

    modifier onlyResourceAdmin(string memory _path) {
        if (!_isResourceAdmin(_path, msg.sender)) {
            revert Forbidden(_path, msg.sender);
        }
        _;
    }

    /// @notice Checks WTTP version compatibility
    /// @param _wttpVersion Protocol version to check
    /// @return bool True if version is compatible
    function compatibleWTTPVersion(string memory _wttpVersion) public pure returns (bool) {
        return _compatibleWTTPVersion(_wttpVersion);
    }

    constructor(
        address _dpr, 
        address _owner, 
        HeaderInfo memory _defaultHeader
    ) WTTPStorageV3(_dpr, _owner, _defaultHeader) {}
    
    function _methodAllowed(string memory _path, Method _method) internal view returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method)); // Create a bitmask for the method
        bool writeMethod = 
            _method == Method.PUT || 
            _method == Method.PATCH || 
            _method == Method.DELETE;
        
        if (_isSuperAdmin(msg.sender)) return true;

        return writeMethod ? (
            _isResourceAdmin(_path, msg.sender) &&
            _readHeader(_readMetadata(_path).header).methods & methodBit != 0
        ) : (
            _readHeader(_readMetadata(_path).header).methods & methodBit != 0
        );
    }

    function _OPTIONS(
        RequestLine memory optionsRequest
    ) internal view returns (OPTIONSResponse memory optionsResponse) {
        optionsResponse.responseLine.protocol = optionsRequest.protocol;
        optionsResponse.responseLine.code = 500;
        if (!compatibleWTTPVersion(optionsRequest.protocol)) {
            optionsResponse.responseLine.code = 505;
        } else if (!_methodAllowed(optionsRequest.path, optionsRequest.method)) {
            optionsResponse.responseLine.code = 405;
        } else if (optionsRequest.method == Method.OPTIONS) {
            optionsResponse.allow = _readHeader(
                _readMetadata(optionsRequest.path).header
            ).methods;
            optionsResponse.responseLine.code = 204;
        }
        
    }

    function OPTIONS(
        RequestLine memory optionsRequest
    ) external view returns (OPTIONSResponse memory optionsResponse) {
        optionsRequest.method = Method.OPTIONS;
        optionsResponse = _OPTIONS(optionsRequest);
    }

    function _HEAD(
        HEADRequest memory headRequest
    ) internal view returns (HEADResponse memory headResponse) {
        headResponse.responseLine = _OPTIONS(headRequest.requestLine).responseLine;

        if (headResponse.responseLine.code == 500) {
            string memory _path = headRequest.requestLine.path;
            headResponse.metadata = _readMetadata(_path);
            headResponse.headerInfo = _readHeader(headResponse.metadata.header);
            headResponse.etag = calculateEtag(headResponse.metadata, _readResource(_path));
        
            if (headResponse.metadata.size == 0) {
                headResponse.responseLine.code = 404;
            } 
            // 3xx codes
            else if (
                headResponse.etag == headRequest.ifNoneMatch || 
                headRequest.ifModifiedSince > headResponse.metadata.lastModified
            ) {
                headResponse.responseLine.code = 304;
            }
            else if (headResponse.headerInfo.redirect.code != 0) {
                headResponse.responseLine.code = headResponse.headerInfo.redirect.code;
            }
            // 200 codes should be handled by the parent function
            else if (headRequest.requestLine.method == Method.HEAD) {
                headResponse.responseLine.code = 200;
            }
        }
    }

    /// @notice Handles HTTP HEAD requests
    /// @param headRequest Request information
    /// @return head Response with header information
    function HEAD(
        HEADRequest memory headRequest
    )
        external view returns (HEADResponse memory head)
    {
        headRequest.requestLine.method = Method.HEAD;
        return _HEAD(headRequest);
    }

    function _LOCATE(
        HEADRequest memory locateRequest
    ) internal view returns (LOCATEResponse memory locateResponse) {
        locateResponse.head = _HEAD(locateRequest);
        if (locateResponse.head.responseLine.code == 500) {
            locateResponse.dataPoints = _readResource(locateRequest.requestLine.path);
            locateResponse.head.responseLine.code = 200;
        }
    }

    /// @notice Handles LOCATE requests to find resource storage locations
    /// @dev Returns storage contract address and data point addresses
    /// @param locateRequest Request information
    /// @return locateResponse Response containing storage locations
    function LOCATE(
        HEADRequest memory locateRequest
    )
        external view returns (LOCATEResponse memory locateResponse)
    {
        locateRequest.requestLine.method = Method.LOCATE;
        return _LOCATE(locateRequest);
    }

    function GET(
        HEADRequest memory getRequest
    ) external view returns (LOCATEResponse memory locateResponse) {
        getRequest.requestLine.method = Method.GET;
        return _LOCATE(getRequest);
    }

    // DO NOT DELETE THIS CODE!
    // add to gateway contract to reduce size of site contract
    //     if (
    //         !(locateRequest.chunks.start == 0 && (
    //             locateRequest.chunks.end == 0 || 
    //             locateRequest.chunks.end == int256(locateResponse.dataPoints.length)
    //         ))
    //     ) {

    //         uint256 _start;
    //         uint256 _end = locateResponse.dataPoints.length;

    //         if (
    //             locateRequest.chunks.end < 0 && // is negative
    //             _end >= uint256(-locateRequest.chunks.end) // is in range
    //         ) {
    //             _end = uint256(int256(locateResponse.dataPoints.length) + locateRequest.chunks.end); 
    //             // add negative to end
    //         } else {
    //             _end = uint256(locateRequest.chunks.end); // negatives will cast large
    //         }

    //         if (locateResponse.dataPoints.length < _end) {
    //             locateResponse.head.responseLine.code = 416;
    //             return locateResponse;
    //         }

    //         if (
    //             locateRequest.chunks.start < 0 && // is negative
    //             _end >= uint256(-locateRequest.chunks.start) // is in range
    //         ) {
    //             _start = uint256(
    //                 int256(locateResponse.dataPoints.length) + locateRequest.chunks.start
    //             ); 
    //             // add negative to end
    //         } else {
    //             _start = uint256(locateRequest.chunks.start); // negatives will cast large
    //         }
    //         if (_start > _end) {
    //             locateResponse.head.responseLine.code = 416;
    //             return locateResponse;
    //         }

    //         bytes32[] memory _dataPoints = new bytes32[](_end - _start);
    //         for (uint256 i = _start; i < _end; i++) {
    //             _dataPoints[i - _start] = locateResponse.dataPoints[i];
    //         }
    //         locateResponse.dataPoints = _dataPoints;
    //         locateResponse.head.etag = calculateEtag(locateResponse.head.metadata, _dataPoints);
    //     }
    // }

    /// @notice Handles DEFINE requests to update resource headers
    /// @dev Only accessible to resource administrators
    /// @param defineRequest Request information
    /// @return defineResponse Response containing updated header information
    function DEFINE(
        DEFINERequest memory defineRequest
    ) external onlyResourceAdmin(defineRequest.head.requestLine.path) 
    returns (DEFINEResponse memory defineResponse) {
        defineRequest.head.requestLine.method = Method.DEFINE;
        defineResponse.head = _HEAD(defineRequest.head);
        if (
            defineResponse.head.responseLine.code == 404 ||
            defineResponse.head.responseLine.code == 500
        ) {
            defineResponse.headerAddress = _createHeader(defineRequest.data);
            ResourceMetadata memory _metadata = _readMetadata(defineRequest.head.requestLine.path);
            _updateMetadata(defineRequest.head.requestLine.path, ResourceMetadata({
                mimeType: _metadata.mimeType,
                charset: _metadata.charset,
                encoding: _metadata.encoding,
                language: _metadata.language,
                location: _metadata.location,
                size: 0,
                version: 0,
                lastModified: 0,
                header: defineResponse.headerAddress
            }));
            defineResponse.head.responseLine.code = 201;
        }

        emit DEFINESuccess(msg.sender, defineResponse);
    }

    /// @notice Handles DELETE requests to remove resources
    /// @dev Only accessible to resource administrators
    /// @param deleteRequest Request information
    /// @return deleteResponse Response confirming deletion
    function DELETE(
        HEADRequest memory deleteRequest
    ) public onlyResourceAdmin(deleteRequest.requestLine.path) returns (HEADResponse memory deleteResponse) {
        deleteRequest.requestLine.method = Method.DELETE;
        deleteResponse = _HEAD(deleteRequest);
        if (
            deleteResponse.responseLine.code == 500
        ) {
            _deleteResource(deleteRequest.requestLine.path);
            deleteResponse.responseLine.code = 204;
        }

        emit DELETESuccess(msg.sender, deleteResponse);
    }

    /// @notice Handles PUT requests to create new resources
    /// @dev Requires payment for storage costs
    /// @param putRequest Request information
    /// @return putResponse Response containing created resource information
    function PUT(
        PUTRequest memory putRequest
    ) public payable onlyResourceAdmin(putRequest.head.requestLine.path) 
    returns (LOCATEResponse memory putResponse) {
        putRequest.head.requestLine.method = Method.PUT;
        putResponse.head = _HEAD(putRequest.head);
        if (
            putResponse.head.responseLine.code == 404 ||
            putResponse.head.responseLine.code == 500
        ) {
            _updateMetadata(putRequest.head.requestLine.path, ResourceMetadata({
                mimeType: putRequest.mimeType,
                charset: putRequest.charset,
                encoding: putRequest.encoding,
                language: putRequest.language,
                location: putRequest.location,
                size: 0, // calculated
                version: 0, // calculated
                lastModified: 0, // calculated
                header: _readMetadata(putRequest.head.requestLine.path).header
            }));
            _uploadResource(putRequest.head.requestLine.path, putRequest.data);
            putResponse.head.responseLine.code = 201;
        }
        // transfer remaining balance (not used for royalties) to msg.sender
        if (msg.value > 0) {
            payable(msg.sender).transfer(msg.value);
        }
        emit PUTSuccess(msg.sender, putResponse);
    }

    /// @notice Handles PATCH requests to update existing resources
    /// @dev Requires payment for storage costs
    /// @param patchRequest Request information
    /// @return patchResponse Response containing updated resource information
    function PATCH(
        PATCHRequest memory patchRequest
    ) public payable onlyResourceAdmin(patchRequest.head.requestLine.path) returns (LOCATEResponse memory patchResponse) {
        patchRequest.head.requestLine.method = Method.PATCH;
        patchResponse.head = _HEAD(patchRequest.head);
        if (
            patchResponse.head.responseLine.code == 500
        ) {
            _uploadResource(patchRequest.head.requestLine.path, patchRequest.data);
            patchResponse.head.responseLine.code = 204;
        }

        emit PATCHSuccess(msg.sender, patchResponse);
    }

    // Define events
    /// @notice Emitted when a PATCH request succeeds
    /// @param publisher Address of content publisher
    /// @param patchResponse Response details
    event PATCHSuccess(address indexed publisher, LOCATEResponse patchResponse);

    /// @notice Emitted when a PUT request succeeds
    /// @param publisher Address of content publisher
    /// @param putResponse Response details
    event PUTSuccess(address indexed publisher, LOCATEResponse putResponse);

    /// @notice Emitted when a DELETE request succeeds
    /// @param publisher Address of content publisher
    /// @param deleteResponse Response details
    event DELETESuccess(address indexed publisher, HEADResponse deleteResponse);

    /// @notice Emitted when a DEFINE request succeeds
    /// @param publisher Address of content publisher
    /// @param defineResponse Response details
    event DEFINESuccess(address indexed publisher, DEFINEResponse defineResponse);
}
