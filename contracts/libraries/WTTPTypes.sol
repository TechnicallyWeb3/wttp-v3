// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

// ============ WTTP Permissions Contract ============
// ============ Events ============
event AdminRoleGranted(address indexed account);
event AdminRoleRevoked(address indexed account);
event ResourceRoleCreated(bytes32 indexed role);
event ResourceRoleGranted(bytes32 indexed role, address indexed account);
event ResourceRoleRevoked(bytes32 indexed role, address indexed account);
event AccountBlacklisted(address indexed account);
event AccountWhitelisted(address indexed account);

// ============ Errors ============
error InvalidRole();
error NotSuperAdmin(address account);
error NotSiteAdmin(address account);
error Blacklisted(address account);

// ============ WTTP Storage Contract ============

// ============ Events ============
event MalformedParameter(string parameter, bytes value);
event HeaderExists(bytes32 headerAddress);
event ResourceExists(string path);
event OutOfBoundsChunk(string path, uint256 chunkIndex);
event MetadataUpdated(string path);
event MetadataDeleted(string path);
event ResourceCreated(string path);
event ResourceUpdated(string path, uint256 chunkIndex);
event ResourceDeleted(string path);

// ============ Errors ============
error ResourceImmutable(string path);
error NotResourceAdmin(string path, address account);
// error OutOfBoundsChunk(string path, uint256 chunkIndex);

// ============ Enum Definitions ============

/// @title HTTP Methods Enum
/// @notice Defines supported HTTP methods
/// @dev Used for method-based access control
enum Method {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
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
    /// @notice Maximum age in seconds for shared caching
    uint256 sMaxage;
    /// @notice Prevents storing the response
    bool noStore;
    /// @notice Requires validation before using cached copy
    bool noCache;
    /// @notice Indicates resource will never change
    bool immutableFlag;
    /// @notice Indicates response may be cached by any cache
    bool publicFlag;
    /// @notice Requires revalidation after becoming stale
    bool mustRevalidate;
    /// @notice Requires proxy revalidation
    bool proxyRevalidate;
    /// @notice Requires underscores in the cache key
    bool mustUnderstand;
    /// @notice Grace period for serving stale content during revalidation
    uint256 staleWhileRevalidate;
    /// @notice Grace period for serving stale content during errors
    uint256 staleIfError;
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
    /// @notice Location of the resource
    bytes2 location;
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

// ============ Constants ============

// /// @title WTTP Constants Library
// /// @notice Common constants for the WTTP protocol
// /// @dev Centralizes constant definitions for consistency
// library WTTPConstants {
    
//     // ============ Cache Control Constants ============
//     CacheControl constant ZERO_CACHE_CONTROL = CacheControl({
//         maxAge: 0,
//         sMaxage: 0,
//         noStore: false,
//         noCache: false,
//         immutableFlag: false,
//         publicFlag: false,
//         mustRevalidate: false,
//         proxyRevalidate: false,
//         mustUnderstand: false,
//         staleWhileRevalidate: 0,
//         staleIfError: 0
//     });
    
//     CacheControl DEFAULT_CACHE_CONTROL = CacheControl({
//         maxAge: 0,
//         sMaxage: 0,
//         noStore: false,
//         noCache: false,
//         immutableFlag: false,
//         publicFlag: true,
//         mustRevalidate: false,
//         proxyRevalidate: false,
//         mustUnderstand: false,
//         staleWhileRevalidate: 0,
//         staleIfError: 0
//     });
    
//     // ============ Method Constants ============
    
//     // Get the bitmask for all methods
//     uint16 constant MAX_METHODS = 511; // 2^9 - 1, representing all 9 methods
    
//     // ============ Header Constants ============
    
//     HeaderInfo ZERO_HEADER = HeaderInfo({
//         methods: 0,
//         cache: ZERO_CACHE_CONTROL,
//         redirect: Redirect(0, ""),
//         resourceAdmin: bytes32(0)
//     });
    
//     bytes32 constant ZERO_HEADER_HASH = keccak256(abi.encode(ZERO_HEADER));
    
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
    
//     // ============ Error Constants ============
    
//     // Error codes could also be defined here
//     // string constant ERROR_RESOURCE_IMMUTABLE = "Resource is immutable";
//     // string constant ERROR_NOT_RESOURCE_ADMIN = "Not a resource admin";
// } 