const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();
const private_key_test = process.env.PRIVATE_KEY_TEST;
const private_key_ganache = process.env.PRIVATE_KEY_GANACHE;
const mumbai_url = process.env.RPC_URL_MUMBAI;
const binance_test_url = process.env.RPC_URL_BINANCE_TEST;

module.exports = {
  networks: {
    ganache: {
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [private_key_ganache],
          providerOrUrl: "http://127.0.0.1:7545"
        });
      },
      port: 7545,
      network_id: "*",
      networkCheckTimeout: 2000000
    },
    mumbai: {
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [private_key_test],
          providerOrUrl: mumbai_url
        });
      },
      network_id: "80001",
      maxPriorityFeePerGas: "2999999991",
      maxFeePerGas: "3000000000",
      networkCheckTimeout: 2000000
    },
    binance_test: {
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [private_key_test],
          providerOrUrl: binance_test_url
        });
      },
      network_id: "97",
      networkCheckTimeout: 2000000
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.11", // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 100
        },
        evmVersion: "byzantium"
      }
    }
  },
  plugins: ["truffle-contract-size", "truffle-plugin-verify"],

  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
    polygonscan: process.env.POLYGONSCAN_API_KEY
  }
};
