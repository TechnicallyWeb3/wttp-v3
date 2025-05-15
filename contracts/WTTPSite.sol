// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPStorage.sol";

/// @title WTTP Site Contract
/// @notice Implements core WTTP protocol methods
/// @dev Handles HTTP-like operations on the blockchain
abstract contract WTTPSiteV3 is WTTPStorageV3 {

        
    function _isResourceAdmin(string memory _path, address _account) internal view returns (bool) {
        return _isSiteAdmin(_account) || 
            hasRole(_readHeader(_readMetadata(_path).header).resourceAdmin, _account);
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

    constructor(address _dpr, address _owner) WTTPStorageV3(_dpr, _owner) {}
    
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

    function OPTIONS(
        RequestLine memory optionsRequest
    ) public view returns (OPTIONSResponse memory optionsResponse) {
        optionsResponse.responseLine.protocol = optionsRequest.protocol;

        if (!compatibleWTTPVersion(optionsRequest.protocol)) {
            optionsResponse.responseLine.code = 505;
        } else if (!_methodAllowed(optionsRequest.path, optionsRequest.method)) {
            optionsResponse.responseLine.code = 405;
        } else {
            optionsResponse.responseLine.code = 204;
            if (optionsRequest.method == Method.OPTIONS) {
                optionsResponse.allow = _readHeader(
                    _readMetadata(optionsRequest.path).header
                ).methods;
            }
        }
    }

    /// @notice Handles HTTP HEAD requests
    /// @param headRequest Request information
    /// @return head Response with header information
    function HEAD(
        HEADRequest memory headRequest
    )
        public
        view
        returns (HEADResponse memory head)
    {
        head.responseLine = OPTIONS(headRequest.requestLine).responseLine;

        // 500 codes
        if (head.responseLine.code == 204) {
            string memory _path = headRequest.requestLine.path;
            head.metadata = _readMetadata(_path);
            head.headerInfo = _readHeader(head.metadata.header);
            bytes32[] memory _dataPoints = _readResource(_path);
            head.etag = calculateEtag(head.metadata, _dataPoints);
            head.responseLine.code = 500;
        
            if (head.metadata.size == 0) {
                head.responseLine.code = 404;
            } 
            // 300 codes
            else if (
                head.etag == headRequest.ifNoneMatch || 
                headRequest.ifModifiedSince > head.metadata.lastModified
            ) {
                head.responseLine.code = 304;
            }
            else if (head.headerInfo.redirect.code != 0) {
                head.responseLine.code = head.headerInfo.redirect.code;
            }
            // 200 codes should be handled by the parent function
            else if (headRequest.requestLine.method == Method.HEAD) {
                head.responseLine.code = 200;
            }
        }
    }

    /// @notice Handles LOCATE requests to find resource storage locations
    /// @dev Returns storage contract address and data point addresses
    /// @param locateRequest Request information
    /// @return locateResponse Response containing storage locations
    function LOCATE(
        HEADRequest memory locateRequest
    )
        public
        view
        returns (LOCATEResponse memory locateResponse)
    {
        locateRequest.requestLine.method = Method.LOCATE;
        locateResponse.head = HEAD(locateRequest);
        if (
            locateResponse.head.responseLine.code == 500 || 
            locateResponse.head.responseLine.code < 400
        ) {
            locateResponse.dataPoints = _readResource(locateRequest.requestLine.path);
            locateResponse.head.responseLine.code = 204;
        }
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
    ) public onlyResourceAdmin(defineRequest.head.requestLine.path) 
    returns (DEFINEResponse memory defineResponse) {
        defineResponse.headerAddress = _createHeader(defineRequest.data);
        defineRequest.head.requestLine.method = Method.DEFINE;
        defineResponse.head = HEAD(defineRequest.head);
        if (
            defineResponse.head.responseLine.code == 500 ||
            defineResponse.head.responseLine.code == 404 ||
            defineResponse.head.responseLine.code < 400
        ) {
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
        _deleteResource(deleteRequest.requestLine.path);
        deleteRequest.requestLine.method = Method.DELETE;
        deleteResponse = HEAD(deleteRequest);
        if (
            deleteResponse.responseLine.code == 500 ||
            deleteResponse.responseLine.code < 400
        ) {
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
    ) public payable onlyResourceAdmin(putRequest.head.requestLine.path) returns (LOCATEResponse memory putResponse) {

        _uploadResource(putRequest.head.requestLine.path, putRequest.data);
        putRequest.head.requestLine.method = Method.PUT;
        putResponse.head = HEAD(putRequest.head);
        if (
            putResponse.head.responseLine.code == 500 ||
            putResponse.head.responseLine.code < 400
        ) {
            putResponse.head.responseLine.code = 201;
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
        _uploadResource(patchRequest.head.requestLine.path, patchRequest.data);
        patchRequest.head.requestLine.method = Method.PATCH;
        patchResponse.head = HEAD(patchRequest.head);
        if (
            patchResponse.head.responseLine.code == 500 ||
            patchResponse.head.responseLine.code < 400
        ) {
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
