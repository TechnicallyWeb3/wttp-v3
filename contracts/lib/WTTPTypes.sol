// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

// ============ WTTP Permissions Contract ============
// ============ Events ============
event SiteAdminChanged(bytes32 oldSiteAdmin, bytes32 newSiteAdmin);
event ResourceRoleCreated(bytes32 indexed role);

// ============ Errors ============
error InvalidRole(bytes32 role);

// ============ WTTP Storage Contract ============

// ============ Events ============
// event MalformedParameter(string parameter, bytes value);
// event HeaderExists(bytes32 headerAddress);
// event ResourceExists(string path);
event OutOfBoundsChunk(string path, uint256 chunkIndex);
event MetadataUpdated(string path);
event MetadataDeleted(string path);
event ResourceCreated(string path);
event ResourceUpdated(string path, uint256 chunkIndex);
event ResourceDeleted(string path);

// ============ Errors ============
error ResourceImmutable(string path);
error Forbidden(address account, bytes32 role);
// error OutOfBoundsChunk(string path, uint256 chunkIndex);

// ============ Enum Definitions ============

/// @title HTTP Methods Enum
/// @notice Defines supported HTTP methods
/// @dev Used for method-based access control
enum Method {
    HEAD,
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    OPTIONS,
    LOCATE,
    DEFINE
}

// ============ Struct Definitions ============

/// @title Cache Control Structure
/// @notice Defines HTTP cache control directives
/// @dev Maps to standard HTTP cache-control header fields
struct CacheControl {
    /// @notice Maximum age in seconds for client caching
    uint256 maxAge;
    // /// @notice Maximum age in seconds for shared caching
    // uint256 sMaxage;
    /// @notice Prevents storing the response
    bool noStore;
    /// @notice Requires validation before using cached copy
    bool noCache;
    /// @notice Indicates resource will never change
    bool immutableFlag;
    /// @notice Indicates response may be cached by any cache
    bool publicFlag;
    // /// @notice Requires revalidation after becoming stale
    // bool mustRevalidate;
    // /// @notice Requires proxy revalidation
    // bool proxyRevalidate;
    // /// @notice Requires underscores in the cache key
    // bool mustUnderstand;
    // /// @notice Grace period for serving stale content during revalidation
    // uint256 staleWhileRevalidate;
    // /// @notice Grace period for serving stale content during errors
    // uint256 staleIfError;
}

/// @title Redirect Structure
/// @notice Defines HTTP redirect information
/// @dev Maps to standard HTTP redirect response
struct Redirect {
    /// @notice HTTP status code for redirect 3xx
    uint16 code;
    /// @notice Target location for redirect in url format
    string location; 
}

/// @title Header Information Structure
/// @notice Combines all HTTP header related information
/// @dev Used for resource header management
struct HeaderInfo {
    /// @notice Allowed HTTP methods bitmask
    uint16 methods;
    /// @notice Cache control directives
    CacheControl cache;
    /// @notice Redirect information
    Redirect redirect;
    /// @notice Permission information
    bytes32 resourceAdmin;
}

/// @title Resource Metadata Structure
/// @notice Stores metadata about web resources
/// @dev Used to track resource versions and modifications
struct ResourceMetadata {
    /// @notice MIME type of the resource
    bytes2 mimeType;
    /// @notice Character set of the resource
    bytes2 charset;
    /// @notice Encoding of the resource
    bytes2 encoding;
    /// @notice Language of the resource
    bytes2 language;
    /// @notice Size of the resource in bytes
    uint256 size;
    /// @notice Version number of the resource
    uint256 version;
    /// @notice Timestamp of last modification
    uint256 lastModified;
    /// @notice Header address to determine which header the resource uses
    bytes32 header;
}

struct DataRegistration {
    bytes data;
    uint256 chunkIndex;
    address publisher;
}

// ============ Helper Functions ============

/// @notice Converts array of methods to bitmask
/// @dev Used for efficient method permission storage
/// @param methods Array of HTTP methods to convert
/// @return uint16 Bitmask representing allowed methods
function methodsToMask(Method[] memory methods) pure returns (uint16) {
    uint16 mask = 0;
    for (uint i = 0; i < methods.length; i++) {
        mask |= uint16(1 << uint8(methods[i]));
    }
    return mask;
}

/// @notice Calculates a unique address for a header
/// @dev Uses keccak256 hash of encoded header
/// @param _header The header information 
/// @return bytes32 The calculated header address
function getHeaderAddress(HeaderInfo memory _header) pure returns (bytes32) {
    return keccak256(abi.encode(_header));
}

// ============ WTTP Site Contract ============
/// @title HTTP Request Line Structure
/// @notice Represents the first line of an HTTP request
/// @dev Contains protocol version and resource path
struct RequestLine {
    /// @notice Protocol version (e.g., "WTTP/3.0")
    string protocol;
    /// @notice Resource path being requested
    string path;
    /// @notice WTTP method (e.g., GET, HEAD, PUT, PATCH, DELETE, LOCATE, DEFINE)
    Method method;
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

// OPTIONSRequest is the same as RequestLine

struct OPTIONSResponse {
    ResponseLine responseLine;
    uint16 allow;
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

/// @title LOCATE Response Structure
/// @notice Extended response for LOCATE requests
/// @dev Includes storage addresses and data point locations
struct LOCATEResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Array of data point addresses
    bytes32[] dataPoints;
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

// PUTResponse is the same as LOCATEResponse

struct PATCHRequest {
    HEADRequest head;
    DataRegistration[] data;
}

// PATCHResponse is the same as LOCATEResponse

struct DEFINERequest {
    HEADRequest head;
    HeaderInfo data;
}

struct DEFINEResponse {
    HEADResponse head;
    bytes32 headerAddress;
}

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

// ============ Gateway Contract ============
struct Range {
    int256 start;
    int256 end;
}

struct LOCATERequest {
    HEADRequest head;
    Range rangeChunks; // start & end by chunk index, not bytes
}

struct GETRequest {
    HEADRequest head;
    Range rangeBytes; // start & end (bytes)
}

struct GETResponse {
    HEADResponse head;
    Range bytesRange;
    bytes data;
}

// ============ Constants ============
    
//     // The default headers need to be constructed in a function since they use methodsToMask
//     function getDefaultFileHeader() internal pure returns (HeaderInfo memory) {
//         Method[] memory methods = new Method[](8);
//         methods[0] = Method.GET;
//         methods[1] = Method.PUT;
//         methods[2] = Method.DELETE;
//         methods[3] = Method.PATCH;
//         methods[4] = Method.HEAD;
//         methods[5] = Method.OPTIONS;
//         methods[6] = Method.LOCATE;
//         methods[7] = Method.DEFINE;
        
//         return HeaderInfo({
//             methods: methodsToMask(methods),
//             cache: DEFAULT_CACHE_CONTROL,
//             redirect: Redirect(0, ""),
//             resourceAdmin: bytes32(0)
//         });
//     }
    
//     function getDefaultDirectoryHeader() internal pure returns (HeaderInfo memory) {
//         Method[] memory methods = new Method[](6);
//         methods[0] = Method.GET;
//         methods[1] = Method.PUT;
//         methods[2] = Method.DELETE;
//         methods[3] = Method.HEAD;
//         methods[4] = Method.OPTIONS;
//         methods[5] = Method.DEFINE;
        
//         return HeaderInfo({
//             methods: methodsToMask(methods),
//             cache: DEFAULT_CACHE_CONTROL,
//             redirect: Redirect(300, "./index.html"),
//             resourceAdmin: bytes32(0)
//         });
//     }
    
//     // ============ Metadata Constants ============
    
//     ResourceMetadata ZERO_METADATA = ResourceMetadata({
//         mimeType: 0x0000,
//         charset: 0x0000,
//         encoding: 0x0000,
//         location: 0x0000,
//         size: 0,
//         version: 0,
//         lastModified: 0,
//         header: bytes32(0)
//     });
    
//     // Similarly, these need functions since they use header address
//     function getDefaultFileMetadata() internal pure returns (ResourceMetadata memory) {
//         return ResourceMetadata({
//             mimeType: 0x7570, // t/p (text/plain)
//             charset: 0x7508, // u/8 (utf-8)
//             encoding: 0x6964, // id (identity)
//             location: 0x6463, // d/c (datapoint/chunk)
//             size: 0,  // calculated
//             version: 0, // calculated
//             lastModified: 0, // calculated
//             header: getHeaderAddress(getDefaultFileHeader())
//         });
//     }
    
//     function getDefaultDirectoryMetadata() internal pure returns (ResourceMetadata memory) {
//         return ResourceMetadata({
//             mimeType: 0x756f, // t/o (text/json)
//             charset: 0x7508, // u/8 (utf-8)
//             encoding: 0x6964, // id (identity/uncompressed)
//             location: 0x6463, // d/c (datapoint/chunk)
//             size: 0, // calculated
//             version: 0,
//             lastModified: 0,
//             header: getHeaderAddress(getDefaultDirectoryHeader())
//         });
//     }