// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HTTP Request Line Structure
/// @notice Represents the first line of an HTTP request
/// @dev Contains protocol version and resource path
struct RequestLine {
    /// @notice Protocol version (e.g., "WTTP/3.0")
    string protocol;
    /// @notice Resource path being requested
    string path;
}

/// @title HTTP Response Line Structure
/// @notice Represents the first line of an HTTP response
/// @dev Contains protocol version and status code
struct ResponseLine {
    /// @notice Protocol version (e.g., "WTTP/3.0")
    string protocol;
    /// @notice HTTP status code (e.g., 200, 404)
    uint16 code;
}

struct HEADRequest {
    RequestLine requestLine;
    uint256 ifModifiedSince; // timestamp
    bytes32 ifNoneMatch; // etag
}


/// @title HEAD Response Structure
/// @notice Contains metadata and header information for HEAD requests
/// @dev Used as base response type for other methods
struct HEADResponse {
    /// @notice Response status line
    ResponseLine responseLine;
    /// @notice Resource header information
    HeaderInfo headerInfo;
    /// @notice Resource metadata
    ResourceMetadata metadata;
    /// @notice Resource content hash
    bytes32 etag;
}

struct Range {
    int256 start;
    int256 end;
}

struct PUTRequest {
    HEADRequest head;
    bytes2 mimeType;
    bytes2 charset;
    bytes2 encoding;
    bytes2 language;
    bytes2 location;
    DataRegistration[] data;
}

/// @title PUT Response Structure
/// @notice Extended response for PUT/PATCH requests
/// @dev Includes registry information and data point address
struct PUTResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Address of created/updated data point
    bytes32[] dataPointAddresses;
}

struct PATCHRequest {
    HEADRequest head;
    DataRegistration[] data;
}

// PATCHResponse is the same as PUTResponse

struct LOCATERequest {
    HEADRequest head;
    Range chunks; // start & end by chunk index, not bytes
}

/// @title LOCATE Response Structure
/// @notice Extended response for LOCATE requests
/// @dev Includes storage addresses and data point locations
struct LOCATEResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Address of data point storage contract
    address dpsAddress; // this assumes all data points are stored in the same contract
    /// @notice Array of data point addresses
    bytes32[] dataPoints;
}

struct DEFINERequest {
    HEADRequest head;
    HeaderInfo header;
}

// DEFINEResponse is the same as HEADResponse

// this belongs in the 
// struct GETRequest {
//     HEADRequest head;
//     Range range; // start & end
// }

bytes32 constant WTTP_VERSION = keccak256(abi.encode("WTTP/3.0"));

/// @notice Checks WTTP version compatibility
/// @param _wttpVersion Protocol version to check
/// @return bool True if version is compatible
function _compatibleWTTPVersion(string memory _wttpVersion) pure returns (bool) {
    if(keccak256(abi.encode(_wttpVersion)) != WTTP_VERSION) {
        return false;
    }
    return true;
}

function calculateEtag(
    ResourceMetadata memory _metadata, 
    bytes32[] memory _dataPoints
) pure returns (bytes32) {
    return keccak256(abi.encode(_metadata, _dataPoints));
}

/// @title WTTP Site Contract
/// @notice Implements core WTTP protocol methods
/// @dev Handles HTTP-like operations on the blockchain
abstract contract WTTPSite is WTTPStorageV3 {

    /// @notice Checks WTTP version compatibility
    /// @param _wttpVersion Protocol version to check
    /// @return bool True if version is compatible
    function compatibleWTTPVersion(string memory _wttpVersion) public pure returns (bool) {
        return _compatibleWTTPVersion(_wttpVersion);
    }

    constructor(address _dpr, address _owner) WTTPStorageV3(_dpr, _owner) {}
    
    function _methodAllowed(string memory _path, Method _method) internal view returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method)); // Create a bitmask for the method
        return (_readHeader(_readMetadata(_path).header).methods & methodBit != 0) || 
            _isSuperAdmin(msg.sender);
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
        string memory _path = headRequest.requestLine.path;
        head.responseLine.protocol = headRequest.requestLine.protocol;
        head.responseLine.code = 500;
        head.metadata = _readMetadata(_path);
        head.headerInfo = _readHeader(head.metadata.header);
        bytes32[] memory _dataPoints = _readResource(_path);
        head.etag = calculateEtag(head.metadata, _dataPoints);

        if (!compatibleWTTPVersion(head.responseLine.protocol)) {
            head.responseLine.code = 505;
        }
        // 400 codes
        else if (!_methodAllowed(_path, Method.HEAD)) {
            head.responseLine.code = 405;
        } else if (_readMetadata(_path).size == 0) {
            head.responseLine.code = 404;
        } 
        // 300 codes
        else if (head.headerInfo.redirect.code != 0) {
            // 
            head.responseLine.code = head.headerInfo.redirect.code;
        }
        // 200 codes
        else if (head.metadata.size == 0) {
            head.responseLine.code = 204;
        } else if (head.metadata.size > 0) {
            head.responseLine.code = 200;
        }
    }

    /// @notice Handles LOCATE requests to find resource storage locations
    /// @dev Returns storage contract address and data point addresses
    /// @param locateRequest Request information
    /// @return locateResponse Response containing storage locations
    function LOCATE(
        LOCATERequest memory locateRequest
    )
        public
        view
        returns (LOCATEResponse memory locateResponse)
    {
        locateResponse.head = HEAD(locateRequest.head);
        locateResponse.dpsAddress = address(DPS());
        locateResponse.dataPoints = _readResource(locateRequest.head.requestLine.path);

        if (
            !(locateRequest.chunks.start == 0 && (
                locateRequest.chunks.end == 0 || 
                locateRequest.chunks.end == int256(locateResponse.dataPoints.length)
            ))
        ) {

            uint256 _start;
            uint256 _end = locateResponse.dataPoints.length;

            if (
                locateRequest.chunks.end < 0 && // is negative
                _end >= uint256(-locateRequest.chunks.end) // is in range
            ) {
                _end = uint256(int256(locateResponse.dataPoints.length) + locateRequest.chunks.end); 
                // add negative to end
            } else {
                _end = uint256(locateRequest.chunks.end); // negatives will cast large
            }

            if (locateResponse.dataPoints.length < _end) {
                locateResponse.head.responseLine.code = 416;
                return locateResponse;
            }

            if (
                locateRequest.chunks.start < 0 && // is negative
                _end >= uint256(-locateRequest.chunks.start) // is in range
            ) {
                _start = uint256(
                    int256(locateResponse.dataPoints.length) + locateRequest.chunks.start
                ); 
                // add negative to end
            } else {
                _start = uint256(locateRequest.chunks.start); // negatives will cast large
            }
            if (_start > _end) {
                locateResponse.head.responseLine.code = 416;
                return locateResponse;
            }

            bytes32[] memory _dataPoints = new bytes32[](_end - _start);
            for (uint256 i = _start; i < _end; i++) {
                _dataPoints[i - _start] = locateResponse.dataPoints[i];
            }
            locateResponse.dataPoints = _dataPoints;
            locateResponse.head.etag = calculateEtag(locateResponse.head.metadata, _dataPoints);
        }
    }

    /// @notice Handles DEFINE requests to update resource headers
    /// @dev Only accessible to resource administrators
    /// @param defineRequest Request information
    /// @return defineResponse Response containing updated header information
    function DEFINE(
        DEFINERequest memory defineRequest
    ) public returns (HEADResponse memory defineResponse) {
        string memory _path = defineRequest.head.requestLine.path;
        _createHeader(defineRequest.header);
        defineResponse = HEAD(defineRequest.head);

        emit DEFINESuccess(msg.sender, defineRequest.head.requestLine, defineResponse);
    }

    /// @notice Handles DELETE requests to remove resources
    /// @dev Only accessible to resource administrators
    /// @param _requestLine Request information
    /// @return deleteResponse Response confirming deletion
    function DELETE(
        RequestLine memory _requestLine
    ) public returns (HEADResponse memory deleteResponse) {
        string memory _path = _requestLine.path;
        if (_methodAllowed(_path, Method.DELETE)) {
            _deleteResource(_path);
            deleteResponse = HEAD(_requestLine);
        } else {
            deleteResponse.responseLine = ResponseLine({
                protocol: _requestLine.protocol,
                code: 405
            });
        }

        emit DELETESuccess(msg.sender, _requestLine, deleteResponse);
    }

    /// @notice Handles PUT requests to create new resources
    /// @dev Requires payment for storage costs
    /// @param putRequest Request information
    /// @return putResponse Response containing created resource information
    function PUT(
        PUTRequest memory putRequest
    ) public payable returns (PUTResponse memory putResponse) {
        string memory _path = putRequest.head.requestLine.path;
        if (_methodAllowed(_path, Method.PUT)) {
            putResponse.dataPointAddresses = [
                _createResource(
                    _path,
                    putRequest.data
                )
            ];
            putResponse.head = HEAD(putRequest.head);
            putResponse.head.responseLine = ResponseLine({
                protocol: putRequest.head.requestLine.protocol,
                code: 201
            });
        } else {
            putResponse.head.responseLine = ResponseLine({
                protocol: putRequest.head.requestLine.protocol,
                code: 405  
            });
        }

        emit PUTSuccess(msg.sender, putRequest.head.requestLine, putResponse);
    }

    /// @notice Handles PATCH requests to update existing resources
    /// @dev Requires payment for storage costs
    /// @param _requestLine Request information
    /// @param _data Updated content
    /// @param _chunk Chunk index for partial updates
    /// @param _publisher Content publisher address
    /// @return patchResponse Response containing updated resource information
    function PATCH(
        RequestLine memory _requestLine,
        bytes memory _data,
        uint256 _chunk,
        address _publisher
    ) public payable returns (PUTResponse memory patchResponse) {
        string memory _path = _requestLine.path;
        if (_methodAllowed(_path, Method.PATCH)) {
            patchResponse.dataPointAddress = _updateResource(_path, _data, _chunk, _publisher);
            patchResponse.head = HEAD(_requestLine);
        } else {
            patchResponse.head.responseLine = ResponseLine({
                protocol: _requestLine.protocol,
                code: 405
            });
        }

        emit PATCHSuccess(msg.sender, _requestLine, patchResponse);
    }

    // Define events
    /// @notice Emitted when a PATCH request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param patchResponse Response details
    event PATCHSuccess(address indexed publisher, RequestLine requestLine, PUTResponse patchResponse);

    /// @notice Emitted when a PUT request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param putResponse Response details
    event PUTSuccess(address indexed publisher, RequestLine requestLine, PUTResponse putResponse);

    /// @notice Emitted when a DELETE request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param deleteResponse Response details
    event DELETESuccess(address indexed publisher, RequestLine requestLine, HEADResponse deleteResponse);

    /// @notice Emitted when a DEFINE request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param defineResponse Response details
    event DEFINESuccess(address indexed publisher, RequestLine requestLine, HEADResponse defineResponse);
}
