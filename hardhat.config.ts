import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";

// Import tasks
import "./tasks/upload";
import "./tasks/fetch";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  }
};

export default config;
