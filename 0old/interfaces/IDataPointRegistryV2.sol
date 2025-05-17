// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./IDataPointStorageV2.sol";

/// @title Interface for Data Point Registry
/// @notice Defines methods for registering data points and managing royalties
interface IDataPointRegistryV2 {
    /// @notice Gets the reference to the data point storage contract
    /// @return The data point storage contract

    function DPS_() external view returns (IDataPointStorageV2);
    
    /// @notice Writes a new data point and handles royalty logic
    /// @param _dataPoint The data point to write
    /// @param _publisher The publisher of the data point
    /// @return dataPointAddress The address where the data point is stored
    function registerDataPoint(
        bytes memory _dataPoint,
        address _publisher
    ) external payable returns (bytes32 dataPointAddress);
    
    /// @notice Calculates the royalty amount for a data point
    /// @param _dataPointAddress The address of the data point
    /// @return The calculated royalty amount in wei
    function getDataPointRoyalty(
        bytes32 _dataPointAddress
    ) external view returns (uint256);
    
    /// @notice Checks the royalty balance of a publisher
    /// @param _publisher The address of the publisher
    /// @return The current balance in wei
    function royaltyBalance(address _publisher) external view returns (uint256);
} 