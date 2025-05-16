// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPSite.sol";

/// @title Test implementation of WTTPSite
/// @notice Used for testing the WTTPSite contract
/// @dev Exposes internal functions as public for testing purposes
contract TestSite is WTTPSiteV3 {
    // Generic event for tracking operation outcomes
    event Success(string method, string path);
    
    constructor(address _dpr, address _owner, HeaderInfo memory _defaultHeader) WTTPSiteV3(_dpr, _owner, _defaultHeader) {}

    /// @notice Checks if an account is a resource admin for a specific path
    /// @param _path The resource path
    /// @param _account The account to check
    /// @return bool True if the account is a resource admin
    function isResourceAdmin(string memory _path, address _account) public view returns (bool) {
        return _isResourceAdmin(_path, _account);
    }
 
} 