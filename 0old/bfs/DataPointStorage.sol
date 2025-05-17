// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

event DataPointWritten(bytes32 indexed dataPointAddress);
error DataExists(bytes32 dataPointAddress);

/// @notice Calculates a unique address for a data point
/// @dev Uses keccak256 hash of concatenated version and data
/// @param _data The data point
/// @param _version The version of the data point
/// @return bytes32 The calculated address
function calculateDataPointAddress(
    bytes memory _data,
    uint8 _version
) pure returns (bytes32) {
    return keccak256(abi.encodePacked(_data, _version));
}

/// @title Data Point Storage Contract
/// @notice Provides core storage functionality for data points
/// @dev Basic implementation without collision handling
contract DataPointStorageV2 {

    mapping(bytes32 => bytes) private dataPointData;
    uint8 public immutable VERSION = 2;

    /// @notice Calculates the storage address for a data point
    /// @param _data The data point to calculate address for
    /// @return _dataPointAddress The calculated storage address
    function calculateAddress(
        bytes memory _data
    ) public pure returns (bytes32 _dataPointAddress) {
        _dataPointAddress = calculateDataPointAddress(_data, VERSION); 
    }

    function dataPointSize(
        bytes32 _dataPointAddress
    ) external view returns (uint256) {
        return dataPointData[_dataPointAddress].length;
    }

    function readDataPoint(
        bytes32 _dataPointAddress
    ) external view returns (bytes memory) {
        return dataPointData[_dataPointAddress];
    }

    /// @notice Stores a new data point with user-specified version
    /// @dev Reverts if the calculated address is already occupied
    /// @param _data The data point to store
    /// @return _dataPointAddress The address where the data point is stored
    function writeDataPoint(
        bytes memory _data
    ) external returns (bytes32 _dataPointAddress) {
        _dataPointAddress = calculateAddress(_data);
        
        // Check if address is already occupied
        if (dataPointData[_dataPointAddress].length > 0) {
            revert DataExists(_dataPointAddress);
        }
        
        dataPointData[_dataPointAddress] = _data;
        emit DataPointWritten(_dataPointAddress);
        
        return _dataPointAddress;
    }
}