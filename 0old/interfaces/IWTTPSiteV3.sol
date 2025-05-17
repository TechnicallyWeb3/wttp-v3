// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../lib/WTTPTypes.sol";
import "./IDataPointStorageV2.sol";
import "./IDataPointRegistryV2.sol";

/// @title Interface for WTTP Site Contract
/// @notice Defines the external methods available on WTTPSiteV3
interface IWTTPSiteV3 {
    function DPS() external view returns (IDataPointStorageV2);
    function DPR() external view returns (IDataPointRegistryV2);
    /// @notice Handles OPTIONS requests to check available methods
    /// @param optionsRequest Request information
    /// @return optionsResponse Response with allowed methods
    function OPTIONS(
        RequestLine memory optionsRequest
    ) external view returns (OPTIONSResponse memory optionsResponse);
    
    /// @notice Handles HEAD requests for metadata retrieval
    /// @param headRequest Request information
    /// @return headResponse Response with header information
    function HEAD(
        HEADRequest memory headRequest
    ) external view returns (HEADResponse memory headResponse);
    
    /// @notice Handles LOCATE requests to find resource storage locations
    /// @param locateRequest Request information
    /// @return locateResponse Response containing storage locations
    function LOCATE(
        HEADRequest memory locateRequest
    ) external view returns (LOCATEResponse memory locateResponse);

    function GET(
        HEADRequest memory getRequest
    ) external view returns (LOCATEResponse memory locateResponse);
} 