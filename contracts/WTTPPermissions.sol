// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./libraries/WTTPTypes.sol";

/// @title WTTP Permissions Contract
/// @notice Manages role-based access control for the WTTP protocol
/// @dev Extends OpenZeppelin's AccessControl with site-specific roles
abstract contract WTTPPermissionsV3 is AccessControl {

    /// @notice Role identifier for site administrators
    bytes32 internal constant SITE_ADMIN_ROLE = keccak256("SITE_ADMIN_ROLE");
    /// @notice Role identifier for the public
    /// @dev This role works in reverse, a user can be assigned as a blacklisted role
    /// @dev This means if you have the public role, hasRole(PUBLIC_ROLE, account) will return false
    bytes32 internal constant PUBLIC_ROLE = keccak256("PUBLIC_ROLE");

    /// @notice Sets up initial roles and permissions
    /// @param _owner Address of the contract owner
    constructor(address _owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _setRoleAdmin(SITE_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(PUBLIC_ROLE, SITE_ADMIN_ROLE);
        _grantRole(SITE_ADMIN_ROLE, _owner);
    }

    modifier validRole(bytes32 role) {
        if(role == PUBLIC_ROLE || role == SITE_ADMIN_ROLE || role == DEFAULT_ADMIN_ROLE) {
            revert InvalidRole();
        }
        _;
    }

    function _isSuperAdmin(address account) internal view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    modifier onlySuperAdmin() {
        if(!_isSuperAdmin(msg.sender)) {
            revert NotSuperAdmin(msg.sender);
        }
        _;
    }

    /// @notice Checks if an address has site admin privileges
    /// @param _admin Address to check
    /// @return bool True if address is a site admin
    function _isSiteAdmin(address _admin) internal view returns (bool) {
        return (hasRole(SITE_ADMIN_ROLE, _admin) || hasRole(DEFAULT_ADMIN_ROLE, _admin));
    }

    // Admin functions
    modifier onlySiteAdmin() {
        if(!_isSiteAdmin(msg.sender)) {
            revert NotSiteAdmin(msg.sender);
        }
        _;
    }

    function _isPublic(address account) internal view returns (bool) {
        return !hasRole(PUBLIC_ROLE, account);
    }

    modifier onlyPublic() {
        if(!_isPublic(msg.sender)) {
            revert Blacklisted(msg.sender);
        }
        _;
    }
       
    // Allows site admins to create resource-specific admin roles
    // modifier not needed since only site admins can use grantRole
    function createResourceRole(bytes32 _role) external onlySiteAdmin validRole(_role) {
        _setRoleAdmin(_role, SITE_ADMIN_ROLE);
        emit ResourceRoleCreated(_role);
    }

    function grantRole(bytes32 role, address account) public override {
        super.grantRole(role, account);
        if(role == SITE_ADMIN_ROLE) {
            emit AdminRoleGranted(account);
        } else if(role == PUBLIC_ROLE) {
            emit AccountBlacklisted(account);
        } else {
            emit ResourceRoleGranted(role, account);
        }
    }

    function revokeRole(bytes32 role, address account) public override {
        super.revokeRole(role, account);
        if(role == SITE_ADMIN_ROLE) {
            emit AdminRoleRevoked(account);
        } else if(role == PUBLIC_ROLE) {
            emit AccountWhitelisted(account);
        } else {
            emit ResourceRoleRevoked(role, account);
        }
    }

    function blacklistPublicRole(address account) external onlySiteAdmin {
        grantRole(PUBLIC_ROLE, account);
    }

    function whitelistPublicRole(address account) external onlySiteAdmin {
        revokeRole(PUBLIC_ROLE, account);
    }

}