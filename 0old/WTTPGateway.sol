// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./lib/WTTPTypes.sol";
import "./interfaces/IWTTPSiteV3.sol";
import "./interfaces/IDataPointStorageV2.sol";

contract WTTPGatewayV3 {
    
    function OPTIONS(
        address _site, 
        RequestLine memory _optionsRequest
    ) public view returns (OPTIONSResponse memory _optionsResponse) {
        return IWTTPSiteV3(_site).OPTIONS(_optionsRequest);
    }

    function GET(
        address _site, 
        GETRequest memory _getRequest
    ) public view returns (GETResponse memory _getResponse) {
        // Get the full response from the site
        LOCATEResponse memory locateResponse = IWTTPSiteV3(_site).LOCATE(_getRequest.head);
        
        // Convert range to absolute indices and check bounds
        (uint256 _start, uint256 _end, bool _outOfBounds) = resolveByteRange(
            _site, 
            locateResponse.dataPoints, 
            _getRequest.rangeBytes
        );
        
        if (_outOfBounds) {
            _getResponse.head = locateResponse.head;
            _getResponse.head.responseLine.code = 416; // Range Not Satisfiable
            return _getResponse;
        }
        
        if (!isFullRange(Range(int256(_start), int256(_end)), locateResponse.head.metadata.size)) {
            // Process the range
            RangedResponse memory rangeResp = _processRange(
                _site,
                locateResponse.dataPoints,
                _start,
                _end,
                RangeType.BYTES
            );
            
            _getResponse.head = locateResponse.head;
            _getResponse.data = rangeResp.data;
            _getResponse.head.responseLine.code = 206;
        } else {
            _getResponse.head = locateResponse.head;
            _getResponse.head.responseLine.code = 200;
            
            // Get full data
            IDataPointStorageV2 dps = IDataPointStorageV2(IWTTPSiteV3(_site).DPS());
            uint256 totalSize = locateResponse.head.metadata.size;
            bytes memory fullData = new bytes(totalSize);
            uint256 offset;
            
            for (uint256 i; i < locateResponse.dataPoints.length; i++) {
                bytes memory dpData = dps.readDataPoint(locateResponse.dataPoints[i]);
                for (uint256 j; j < dpData.length; j++) {
                    fullData[offset++] = dpData[j];
                }
            }
            
            _getResponse.data = fullData;
        }
        
        return _getResponse;
    }

    function HEAD(
        address _site, 
        HEADRequest memory _headRequest
    ) public view returns (HEADResponse memory _headResponse) {
        return IWTTPSiteV3(_site).HEAD(_headRequest);
    }

    function LOCATE(
        address _site, 
        LOCATERequest memory _locateRequest
    ) public view returns (LOCATEResponse memory _locateResponse) {
        // First get the full response from the site
        _locateResponse = IWTTPSiteV3(_site).LOCATE(_locateRequest.head);

        // Convert range to absolute indices and check bounds
        (uint256 _start, uint256 _end, bool _outOfBounds) = resolveDataPointRange(
            _locateRequest.rangeChunks, 
            _locateResponse.dataPoints.length
        );

        if (_outOfBounds) {
            _locateResponse.head.responseLine.code = 416; // Range Not Satisfiable
            return _locateResponse;
        }

        if (!isFullRange(Range(int256(_start), int256(_end)), _locateResponse.dataPoints.length)) {
            
            // Process the range
            RangedResponse memory rangeResp = _processRange(
                _site,
                _locateResponse.dataPoints,
                _start,
                _end,
                RangeType.DATA_POINTS
            );
            
            _locateResponse.dataPoints = rangeResp.dataPoints;
            _locateResponse.head.responseLine.code = 206;
        } else {
            _locateResponse.head.responseLine.code = 200;
        }
        
        return _locateResponse;
    }
    
    enum RangeType {
        BYTES,
        DATA_POINTS
    }

    struct RangedResponse {
        bytes32[] dataPoints;
        bytes data;
        RangeType rangeType;
        bool isPartialRange;
    }
    
    /// @notice Checks if a range represents the full data
    /// @param range The range to check
    /// @param length The total length of the data
    /// @return True if the range covers the full data
    function isFullRange(Range memory range, uint256 length) internal pure returns (bool) {
        return (range.start == 0 && (range.end == 0 || range.end == int256(length)));
    }
    
    /// @notice Resolves a data point range to absolute indices
    /// @param range The range to resolve
    /// @param totalLength The total length of the data points
    /// @return startIdx The resolved start index
    /// @return endIdx The resolved end index
    /// @return outOfBounds True if the range is out of bounds
    function resolveDataPointRange(
        Range memory range,
        uint256 totalLength
    ) internal pure returns (uint256 startIdx, uint256 endIdx, bool outOfBounds) {
        // Handle start index
        if (range.start < 0) {
            // Negative index counts from the end
            if (uint256(-range.start) > totalLength) {
                return (0, 0, true); // Out of bounds
            }
            startIdx = totalLength - uint256(-range.start);
        } else {
            startIdx = uint256(range.start);
        }
        
        // Handle end index
        if (range.end <= 0) {
            // Zero or negative index
            if (range.end == 0) {
                endIdx = totalLength; // End means "up to the end"
            } else if (uint256(-range.end) > totalLength) {
                return (0, 0, true); // Out of bounds
            } else {
                endIdx = totalLength - uint256(-range.end);
            }
        } else {
            endIdx = uint256(range.end);
        }
        
        // Check final bounds
        if (startIdx > endIdx || endIdx > totalLength) {
            return (0, 0, true); // Out of bounds
        }
        
        return (startIdx, endIdx, false);
    }
    
    /// @notice Resolves a byte range to absolute indices
    /// @param _site The site address
    /// @param dataPoints The data points
    /// @param range The range to resolve
    /// @return startIdx The resolved start byte index
    /// @return endIdx The resolved end byte index
    /// @return outOfBounds True if the range is out of bounds
    function resolveByteRange(
        address _site,
        bytes32[] memory dataPoints,
        Range memory range
    ) internal view returns (uint256 startIdx, uint256 endIdx, bool outOfBounds) {
        // Calculate total size
        uint256 totalSize = 0;
        for (uint256 i = 0; i < dataPoints.length; i++) {
            totalSize += IDataPointStorageV2(IWTTPSiteV3(_site).DPS()).dataPointSize(dataPoints[i]);
        }
        
        // Handle start index
        if (range.start < 0) {
            // Negative index counts from the end
            if (uint256(-range.start) > totalSize) {
                return (0, 0, true); // Out of bounds
            }
            startIdx = totalSize - uint256(-range.start);
        } else {
            startIdx = uint256(range.start);
        }
        
        // Handle end index
        if (range.end <= 0) {
            // Zero or negative index
            if (range.end == 0) {
                endIdx = totalSize; // End means "up to the end"
            } else if (uint256(-range.end) > totalSize) {
                return (0, 0, true); // Out of bounds
            } else {
                endIdx = totalSize - uint256(-range.end);
            }
        } else {
            endIdx = uint256(range.end);
        }
        
        // Check final bounds
        if (startIdx > endIdx || endIdx > totalSize) {
            return (0, 0, true); // Out of bounds
        }
        
        return (startIdx, endIdx, false);
    }
    
    /// @notice Processes chunk range requests using resolved indices
    /// @param _site The site address
    /// @param dataPoints The data points to process
    /// @param startIdx The resolved start index
    /// @param endIdx The resolved end index
    /// @param rangeType The type of range
    /// @return rangeResponse The modified response with selected chunks
    function _processRange(
        address _site,
        bytes32[] memory dataPoints,
        uint256 startIdx,
        uint256 endIdx,
        RangeType rangeType
    ) internal view returns (RangedResponse memory rangeResponse) {
        // Initialize response
        rangeResponse.rangeType = rangeType;
        
        // Check if range is full range (handled by caller, but double-check)
        if (startIdx == 0 && endIdx == dataPoints.length) {
            // Return full data
            rangeResponse.dataPoints = dataPoints;
            rangeResponse.isPartialRange = false;
            return rangeResponse;
        } else {
            rangeResponse.isPartialRange = true;
        }

        if (rangeType == RangeType.DATA_POINTS) {
            // Create array with only the requested chunks
            bytes32[] memory _dataPoints = new bytes32[](endIdx - startIdx);
            for (uint256 i = startIdx; i < endIdx; i++) {
                _dataPoints[i - startIdx] = dataPoints[i];
            }
            rangeResponse.dataPoints = _dataPoints;
        } else if (rangeType == RangeType.BYTES) {
            // Handle byte range
            if (startIdx == 0 && endIdx == 0) {
                // Empty range
                rangeResponse.data = new bytes(0);
                return rangeResponse;
            }
            
            // Find starting dataPoint and offset
            uint256 startDP = 0;
            uint256 byteOffset = 0;
            uint256 runningSize = 0;
            IDataPointStorageV2 dps = IWTTPSiteV3(_site).DPS();
            
            for (uint256 i = 0; i < dataPoints.length; i++) {

                uint256 dpSize = dps.dataPointSize(dataPoints[i]);

                if (runningSize + dpSize > startIdx) {
                    startDP = i;
                    byteOffset = startIdx - runningSize;
                    break;
                }
                runningSize += dpSize;
            }
            
            // Calculate result size and allocate memory
            uint256 resultSize = endIdx - startIdx;
            bytes memory resultData = new bytes(resultSize);
            uint256 resultPos = 0;
            
            // Copy data from each required data point
            for (uint256 i = startDP; i < dataPoints.length && resultPos < resultSize; i++) {
                bytes memory dpData = dps.readDataPoint(dataPoints[i]);
                uint256 startPos = (i == startDP) ? byteOffset : 0;
                
                for (uint256 j = startPos; j < dpData.length && resultPos < resultSize; j++) {
                    resultData[resultPos++] = dpData[j];
                }
            }
            
            rangeResponse.data = resultData;
        }
        
        return rangeResponse;
    }
    
}
