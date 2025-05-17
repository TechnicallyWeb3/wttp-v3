// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPSite.sol";
import "./interfaces/IWTTPSiteV3.sol";

/// @title WTTP Site Implementation Contract
/// @notice Concrete implementation of the WTTPSiteV3 abstract contract
/// @dev Provides a deployable implementation of the WTTP site
contract WTTPSiteImpl is WTTPSiteV3 {

    /// @notice Initializes the site contract with necessary dependencies
    /// @dev Sets up DPR and default header, then passes to parent constructor
    /// @param _dpr Address of the Data Point Registry contract
    /// @param _defaultHeader Default header info to use for resources
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    constructor(
        address _dpr, 
        HeaderInfo memory _defaultHeader,
        address _owner
    ) WTTPSiteV3(_dpr, _defaultHeader, _owner) {}
}