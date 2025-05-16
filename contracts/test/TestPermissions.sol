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

    function getSiteAdminRole() public pure returns (bytes32) {
        return SITE_ADMIN_ROLE;
    }

    function testValidRole(bytes32 _role) public validRole(_role) returns (bool) {
        emit Success();
        return true;
    }

    function isSuperAdmin(address _admin) public view returns (bool) {
        return _isSuperAdmin(_admin);
    }

    function isSiteAdmin(address _admin) public view returns (bool) {
        return _isSiteAdmin(_admin);
    }
    
    function testSuperAdmin(address _admin) public onlySuperAdmin returns (bool) {
        emit Success();
        return _isSuperAdmin(_admin);
    }

    function testSiteAdmin(address _admin) public onlySiteAdmin returns (bool) {
        emit Success();
        return _isSiteAdmin(_admin);
    }         

}