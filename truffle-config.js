const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();
const private_key_test = process.env.PRIVATE_KEY_TEST;
const private_key_ganache = process.env.PRIVATE_KEY_GANACHE;
const mumbai_url = process.env.RPC_URL_MUMBAI;

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
      network_id: "*"
    },
    mumbai: {
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [private_key_test],
          providerOrUrl: mumbai_url
        });
      },
      network_id: "80001"
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
  }

  // Truffle DB is currently disabled by default; to enable it, change enabled:
  // false to enabled: true. The default storage location can also be
  // overridden by specifying the adapter settings, as shown in the commented code below.
  //
  // NOTE: It is not possible to migrate your contracts to truffle DB and you should
  // make a backup of your artifacts to a safe location before enabling this feature.
  //
  // After you backed up your artifacts you can utilize db by running migrate as follows:
  // $ truffle migrate --reset --compile-all
  //
  // db: {
  // enabled: false,
  // host: "127.0.0.1",
  // adapter: {
  //   name: "sqlite",
  //   settings: {
  //     directory: ".db"
  //   }
  // }
  // }
};
