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
  const owner = m.getParameter("owner", "");
  const dprAddress = m.getParameter("dprAddress", "");
  
  // Deploy the DataPointStorage if not provided
  const dataPointStorage = m.contract("DataPointStorage");
  
  // Deploy the DataPointRegistry if not provided
  const dataPointRegistry = dprAddress 
    ? m.useContract("DataPointRegistry", dprAddress)
    : m.contract("DataPointRegistry", [dataPointStorage]);
  
  // Deploy the WTTP site
  const wtppSite = m.contract("WTTPSiteImpl", [
    dataPointRegistry,
    DEFAULT_HEADER,
    owner || m.getAccount(0)
  ]);
  
  return { 
    dataPointStorage,
    dataPointRegistry,
    wtppSite
  };
});

export default WTTPSiteModule;