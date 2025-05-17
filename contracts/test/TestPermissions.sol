// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPPermissions.sol";

/// @title Test implementation of WTTPPermissions
/// @notice Used for testing the WTTPPermissions contract
/// @dev Exposes internal functions as public for testing purposes
contract TestPermissions is WTTPPermissionsV3 {
    event Success();
    event Error();

    constructor(address _owner) WTTPPermissionsV3(_owner) {}

    function getSuperAdminRole() public pure returns (bytes32) {
        return DEFAULT_ADMIN_ROLE;
    }

    function getSiteAdminRole() public view returns (bytes32) {
        return SITE_ADMIN_ROLE;
    }

    function testValidRole(bytes32 _role) public notAdminRole(_role) returns (bool) {
        emit Success();
        return true;
    }

    function isSuperAdmin(address _admin) public view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function isSiteAdmin(address _admin) public view returns (bool) {
        return hasRole(SITE_ADMIN_ROLE, _admin);
    }
    
    function testSuperAdmin(address _admin) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
        emit Success();
        return hasRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function testSiteAdmin(address _admin) public onlyRole(SITE_ADMIN_ROLE) returns (bool) {
        emit Success();
        return hasRole(SITE_ADMIN_ROLE, _admin);
    }     

}