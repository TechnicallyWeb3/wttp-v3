// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

// ============ WTTP Permissions Contract ============
// ============ Events ============

/// @notice Emitted when the site admin role identifier is changed
/// @param oldSiteAdmin Previous site admin role identifier
/// @param newSiteAdmin New site admin role identifier
event SiteAdminChanged(bytes32 oldSiteAdmin, bytes32 newSiteAdmin);

/// @notice Emitted when a new resource role is created
/// @param role The role identifier that was created
event ResourceRoleCreated(bytes32 indexed role);

// ============ Errors ============

/// @notice Error thrown when an invalid role is used
/// @param role The role identifier that caused the error
error InvalidRole(bytes32 role);

// ============ WTTP Storage Contract ============

// ============ Events ============
// event MalformedParameter(string parameter, bytes value);
// event HeaderExists(bytes32 headerAddress);
// event ResourceExists(string path);
/// @notice Emitted when a chunk index is out of bounds
/// @param path Path of the resource
/// @param chunkIndex Index that was out of bounds
event OutOfBoundsChunk(string path, uint256 chunkIndex);
/// @notice Emitted when resource metadata is updated
/// @param path Path of the updated resource
event MetadataUpdated(string path);
/// @notice Emitted when resource metadata is deleted
/// @param path Path of the deleted metadata
event MetadataDeleted(string path);
/// @notice Emitted when a new resource is created
/// @param path Path of the created resource
event ResourceCreated(string path);
/// @notice Emitted when a resource is updated
/// @param path Path of the updated resource
/// @param chunkIndex Index of the updated chunk
event ResourceUpdated(string path, uint256 chunkIndex);
/// @notice Emitted when a resource is deleted
/// @param path Path of the deleted resource
event ResourceDeleted(string path);

// ============ Errors ============
/// @notice Error thrown when attempting to modify an immutable resource
/// @param path Path of the immutable resource
error ResourceImmutable(string path);
/// @notice Error thrown when an account lacks permission for a role
/// @param account Address that attempted the action
/// @param role Required role for the action
error Forbidden(address account, bytes32 role);
// error OutOfBoundsChunk(string path, uint256 chunkIndex);

// ============ Enum Definitions ============

/// @title HTTP Methods Enum
/// @notice Defines supported HTTP methods in the WTTP protocol
/// @dev Used for method-based access control and request handling
enum Method {
    /// @notice Retrieve only resource headers and metadata
    HEAD,
    /// @notice Retrieve resource content
    GET,
    /// @notice Submit data to be processed (not fully implemented in WTTP)
    POST,
    /// @notice Create or replace a resource
    PUT,
    /// @notice Update parts of a resource
    PATCH,
    /// @notice Remove a resource
    DELETE,
    /// @notice Query which methods are supported for a resource
    OPTIONS,
    /// @notice Retrieve storage locations for resource data points
    LOCATE,
    /// @notice Update resource headers
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
    /// @notice Prevents storing the response in any cache
    bool noStore;
    /// @notice Requires revalidation before using cached copy
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
    /// @notice HTTP status code for redirect (3xx)
    uint16 code;
    /// @notice Target location for redirect in URL format
    string location; 
}

/// @title Header Information Structure
/// @notice Combines all HTTP header related information
/// @dev Used for resource header management
struct HeaderInfo {
    /// @notice Allowed HTTP methods bitmask (created using methodsToMask)
    uint16 methods;
    /// @notice Cache control directives
    CacheControl cache;
    /// @notice Redirect information if applicable
    Redirect redirect;
    /// @notice Role identifier for resource administration
    bytes32 resourceAdmin;
}

/// @title Resource Metadata Structure
/// @notice Stores metadata about web resources
/// @dev Used to track resource properties and modifications
struct ResourceMetadata {
    /// @notice MIME type of the resource (2-byte identifier)
    bytes2 mimeType;
    /// @notice Character set of the resource (2-byte identifier)
    bytes2 charset;
    /// @notice Encoding of the resource (2-byte identifier)
    bytes2 encoding;
    /// @notice Language of the resource (2-byte identifier)
    bytes2 language;
    /// @notice Size of the resource in bytes
    uint256 size;
    /// @notice Version number of the resource
    uint256 version;
    /// @notice Timestamp of last modification
    uint256 lastModified;
    /// @notice Header identifier determining which header the resource uses
    bytes32 header;
}

/// @title Data Registration Structure
/// @notice Contains data for registering a resource chunk
/// @dev Used for PUT and PATCH operations
struct DataRegistration {
    /// @notice The actual content data
    bytes data;
    /// @notice Index position in the resource's chunk array
    uint256 chunkIndex;
    /// @notice Address of the content publisher
    address publisher;
}

// ============ Helper Functions ============

// Method Bitmask Converter
// Converts array of methods to a bitmask representation
// Used for efficient method permission storage (1 bit per method)
// methods Array of HTTP methods to convert
// uint16 Bitmask representing allowed methods
function methodsToMask(Method[] memory methods) pure returns (uint16) {
    uint16 mask = 0;
    for (uint i = 0; i < methods.length; i++) {
        mask |= uint16(1 << uint8(methods[i]));
    }
    return mask;
}

// Header Address Calculator
// Calculates a unique address for a header
// Uses keccak256 hash of encoded header information
// _header The header information 
// bytes32 The calculated header address
function getHeaderAddress(HeaderInfo memory _header) pure returns (bytes32) {
    return keccak256(abi.encode(_header));
}

// ============ WTTP Site Contract ============
/// @title HTTP Request Line Structure
/// @notice Represents the first line of an HTTP request
/// @dev Contains protocol version, resource path, and method
struct RequestLine {
    /// @notice Protocol version (e.g., "WTTP/3.0")
    string protocol;
    /// @notice Resource path being requested
    string path;
    /// @notice WTTP method (e.g., GET, HEAD, PUT)
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

/// @title OPTIONS Response Structure
/// @notice Contains response data for OPTIONS requests
/// @dev Includes bitmask of allowed methods
struct OPTIONSResponse {
    /// @notice Response status line
    ResponseLine responseLine;
    /// @notice Bitmask of allowed methods
    uint16 allow;
}

/// @title HEAD Request Structure
/// @notice Contains request data for HEAD requests
/// @dev Includes conditional request headers
struct HEADRequest {
    /// @notice Basic request information
    RequestLine requestLine;
    /// @notice Conditional timestamp for If-Modified-Since header
    uint256 ifModifiedSince;
    /// @notice Conditional ETag for If-None-Match header
    bytes32 ifNoneMatch;
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
    /// @notice Resource content hash for caching
    bytes32 etag;
}

/// @title LOCATE Response Structure
/// @notice Extended response for LOCATE requests
/// @dev Includes storage addresses and data point locations
struct LOCATEResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Array of data point addresses for content chunks
    bytes32[] dataPoints;
}

/// @title PUT Request Structure
/// @notice Contains data for creating or replacing resources
/// @dev Includes metadata and content chunks
struct PUTRequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice MIME type of the resource
    bytes2 mimeType;
    /// @notice Character set of the resource
    bytes2 charset;
    /// @notice Content encoding of the resource
    bytes2 encoding;
    /// @notice Language of the resource
    bytes2 language;
    /// @notice Content chunks to store
    DataRegistration[] data;
}

// PUTResponse is the same as LOCATEResponse

/// @title PATCH Request Structure
/// @notice Contains data for updating parts of resources
/// @dev Includes content chunks to update
struct PATCHRequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice Content chunks to update
    DataRegistration[] data;
}

// PATCHResponse is the same as LOCATEResponse

/// @title DEFINE Request Structure
/// @notice Contains data for updating resource headers
/// @dev Includes new header information
struct DEFINERequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice New header information
    HeaderInfo data;
}

/// @title DEFINE Response Structure
/// @notice Contains response data for DEFINE requests
/// @dev Includes the new header address
struct DEFINEResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice New header address
    bytes32 headerAddress;
}

// WTTP Version Constant
// Keccak256 hash of the current protocol version
// Used for version compatibility checks
bytes32 constant WTTP_VERSION = keccak256(abi.encode("WTTP/3.0"));

// WTTP Version Checker
// Checks if a provided version string is compatible
// Compares hashed version against the WTTP_VERSION constant
// _wttpVersion Protocol version string to check
// bool True if version is compatible
function _compatibleWTTPVersion(string memory _wttpVersion) pure returns (bool) {
    if(keccak256(abi.encode(_wttpVersion)) != WTTP_VERSION) {
        return false;
    }
    return true;
}

// ETag Calculator
// Calculates a unique content identifier for caching
// Hashes the combination of metadata and data point addresses
// _metadata Resource metadata
// _dataPoints Array of data point addresses
// bytes32 The calculated ETag
function calculateEtag(
    ResourceMetadata memory _metadata, 
    bytes32[] memory _dataPoints
) pure returns (bytes32) {
    return keccak256(abi.encode(_metadata, _dataPoints));
}

// ============ Gateway Contract ============
/// @title Range Structure
/// @notice Defines a range with start and end positions
/// @dev Supports negative indices (counting from end)
struct Range {
    /// @notice Start position (negative means from end)
    int256 start;
    /// @notice End position (negative means from end, 0 means to end)
    int256 end;
}

/// @title LOCATE Request Structure
/// @notice Extended request for LOCATE with chunk ranges
/// @dev Allows requesting specific ranges of data point chunks
struct LOCATERequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice Range of chunks to locate
    Range rangeChunks;
}

/// @title GET Request Structure
/// @notice Extended request for GET with byte ranges
/// @dev Allows requesting specific byte ranges of content
struct GETRequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice Range of bytes to retrieve
    Range rangeBytes;
}

/// @title GET Response Structure
/// @notice Contains response data for GET requests
/// @dev Includes content data and metadata
struct GETResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Actual byte range returned
    Range bytesRange;
    /// @notice Content data
    bytes data;
}

// ============ Constants ============