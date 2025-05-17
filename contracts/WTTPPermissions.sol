// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./lib/WTTPTypes.sol";

/// @title WTTP Permissions Contract
/// @notice Manages role-based access control for the WTTP protocol
/// @dev Extends OpenZeppelin's AccessControl with site-specific roles
abstract contract WTTPPermissionsV3 is AccessControl {

    /// @notice Role identifier for site administrators
    bytes32 internal SITE_ADMIN_ROLE;
    // /// @notice Role identifier for the public
    // /// @dev This role works in reverse, a user can be assigned as a blacklisted role
    // /// @dev This means if you have the public role, hasRole(PUBLIC_ROLE, account) will return false
    // bytes32 internal constant PUBLIC_ROLE = keccak256("PUBLIC_ROLE");

    /// @notice Sets up initial roles and permissions
    /// @param _owner Address of the contract owner
    constructor(address _owner) {
        SITE_ADMIN_ROLE = keccak256("SITE_ADMIN_ROLE");
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _setRoleAdmin(SITE_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function hasRole(bytes32 role, address account) public view override returns (bool) {
        if (super.hasRole(DEFAULT_ADMIN_ROLE, account)) {
            return true;
        }
        return super.hasRole(role, account);
    }

    modifier notAdminRole(bytes32 role) {
        if(
            role == SITE_ADMIN_ROLE || 
            role == DEFAULT_ADMIN_ROLE
            // || role == PUBLIC_ROLE
        ) {
            revert InvalidRole(role);
        }
        _;
    }

    // function _isSuperAdmin(address account) public virtual view returns (bool) {
    //     return hasRole(DEFAULT_ADMIN_ROLE, account);
    // }

    // modifier onlySuperAdmin() {
    //     if(!_isSuperAdmin(msg.sender)) {
    //         revert Forbidden(msg.sender, DEFAULT_ADMIN_ROLE);
    //     }
    //     _;
    // }

    // function _isSiteAdmin(address account) public virtual view returns (bool) {
    //     return hasRole(SITE_ADMIN_ROLE, account);
    // }

    // modifier onlySiteAdmin() {
    //     if(!_isSiteAdmin(msg.sender)) {
    //         revert Forbidden(msg.sender, SITE_ADMIN_ROLE);
    //     }
    //     _;
    // }


    // function _isPublic(address account) internal view returns (bool) {
    //     return !hasRole(PUBLIC_ROLE, account);
    // }

    // modifier onlyPublic() {
    //     if(!_isPublic(msg.sender)) {
    //         revert Blacklisted(msg.sender);
    //     }
    //     _; 
    // }
       
    // Allows site admins to create resource-specific admin roles
    // modifier not needed since only site admins can use grantRole
    function createResourceRole(bytes32 _role) external onlyRole(SITE_ADMIN_ROLE) notAdminRole(_role) {
        _setRoleAdmin(_role, SITE_ADMIN_ROLE);
        emit ResourceRoleCreated(_role);
    }

    function grantRole(bytes32 role, address account) public override {
        if(role == DEFAULT_ADMIN_ROLE) {
            revert InvalidRole(role);
        }
        super.grantRole(role, account);
        // if(role == SITE_ADMIN_ROLE) {
        //     emit AdminRoleGranted(account);
        // // } else if(role == PUBLIC_ROLE) {
        // //     emit AccountBlacklisted(account);
        // } else {
        //     emit ResourceRoleGranted(role, account);
        // }
    }

    // /// @notice Transfer ownership to a new address
    // /// @dev Only callable by a super admin
    // /// @param _newOwner Address of the new owner
    // function transferOwnership(address _newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
    //     // Grant the new owner super admin role
    //     _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
    //     emit OwnershipTransferred(msg.sender, _newOwner);
    // }

    // function changeSiteAdmin(bytes32 _newSiteAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
    //     emit SiteAdminChanged(SITE_ADMIN_ROLE, _newSiteAdmin);
    //     SITE_ADMIN_ROLE = _newSiteAdmin;
    // }

}