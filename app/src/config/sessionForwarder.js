export const SessionForwarderABI = [
  {
    type: 'function', name: 'authorizeSessionKey', stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'gameID', type: 'uint256' },
      { name: 'boardAddress', type: 'address' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'actionLimit', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'revokeSessionKey', stateMutability: 'nonpayable',
    inputs: [{ name: 'sessionKey', type: 'address' }, { name: 'gameID', type: 'uint256' }, { name: 'boardAddress', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function', name: 'sessionAuthorizations', stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }, { name: 'sessionKey', type: 'address' }, { name: 'board', type: 'address' }, { name: 'gameID', type: 'uint256' }],
    outputs: [{ name: 'expiresAt', type: 'uint64' }, { name: 'remainingActions', type: 'uint32' }],
  },
  {
    type: 'function', name: 'actionNonces', stateMutability: 'view', inputs: [{ name: 'signer', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
];

export const ActionAuthorizationTypes = {
  ActionAuthorization: [
    { name: 'player', type: 'address' },
    { name: 'playerID', type: 'uint256' },
    { name: 'actionIndex', type: 'uint8' },
    { name: 'optionsHash', type: 'bytes32' },
    { name: 'leftHandHash', type: 'bytes32' },
    { name: 'rightHandHash', type: 'bytes32' },
    { name: 'gameID', type: 'uint256' },
    { name: 'boardAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};
