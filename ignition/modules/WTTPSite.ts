// This module deploys a WTTP site using Hardhat Ignition
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

// Default header configuration for WTTP sites
const DEFAULT_HEADER = {
  methods: 511, // All methods allowed (bitmask for all 9 methods)
  cache: {
    maxAge: 3600, // 1 hour
    noStore: false,
    noCache: false,
    immutableFlag: false,
    publicFlag: true
  },
  redirect: {
    code: 0,
    location: ""
  },
  resourceAdmin: ethers.ZeroHash // Default admin role
};

const WTTPSiteModule = buildModule("WTTPSiteModule", (m) => {
  // Get parameters with defaults
  const owner = m.getParameter("owner", m.getAccount(0));
  
  // Deploy the DataPointStorage if not provided
  const dataPointStorage = m.contract("DataPointStorageV2");
  
  // Set royalty rate (0.01% by default)
  const royaltyRate = m.getParameter("royaltyRate", ethers.parseEther("0.0001"));
  
  // Deploy the DataPointRegistry if not provided
  const dataPointRegistry = m.contract("DataPointRegistryV2", [
        owner,
        dataPointStorage,
        royaltyRate
      ]);
  
  // Deploy the WTTP site
  const wttpSite = m.contract("Web3Site", [
    dataPointRegistry,
    DEFAULT_HEADER,
    owner
  ]);

  const wttpGateway = m.contract("WTTPGatewayV3");
  
  return { 
    dataPointStorage,
    dataPointRegistry,
    wttpSite,
    wttpGateway
  };
});

export default WTTPSiteModule;