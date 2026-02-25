import GameSummaryABI from '../../../abi/GameSummary.json';
import PlayerSummaryABI from '../../../abi/PlayerSummary.json';
import ControllerABI from '../../../abi/HexplorationController.json';
import EventsABI from '../../../abi/GameEvents.json';
import BoardABI from '../../../abi/HexplorationBoard.json';
import QueueABI from '../../../abi/HexplorationQueue.json';
import GameSetupABI from '../../../abi/GameSetup.json';

export const BOARD_ADDRESS = import.meta.env.VITE_BOARD_ADDRESS;
export const CONTROLLER_ADDRESS = import.meta.env.VITE_CONTROLLER_ADDRESS;
export const GAME_SUMMARY_ADDRESS = import.meta.env.VITE_GAME_SUMMARY_ADDRESS;
export const PLAYER_SUMMARY_ADDRESS = import.meta.env.VITE_PLAYER_SUMMARY_ADDRESS;
export const GAME_EVENTS_ADDRESS = import.meta.env.VITE_GAME_EVENTS_ADDRESS;
export const GAME_REGISTRY_ADDRESS = import.meta.env.VITE_GAME_REGISTRY_ADDRESS;
export const GAME_QUEUE_ADDRESS = import.meta.env.VITE_GAME_QUEUE_ADDRESS;
export const GAME_SETUP_ADDRESS = import.meta.env.VITE_GAME_SETUP_ADDRESS;

export {
  GameSummaryABI,
  PlayerSummaryABI,
  ControllerABI,
  EventsABI,
  BoardABI,
  QueueABI,
  GameSetupABI,
};

// Helper: build a read config for GameSummary (auto-prepends BOARD_ADDRESS)
export function gameSummaryRead(functionName, args = []) {
  return {
    address: GAME_SUMMARY_ADDRESS,
    abi: GameSummaryABI,
    functionName,
    args: [BOARD_ADDRESS, ...args],
  };
}

// Helper: build a read config for PlayerSummary (auto-prepends BOARD_ADDRESS)
export function playerSummaryRead(functionName, args = []) {
  return {
    address: PLAYER_SUMMARY_ADDRESS,
    abi: PlayerSummaryABI,
    functionName,
    args: [BOARD_ADDRESS, ...args],
  };
}

// Helper: build a read config for Controller
export function controllerRead(functionName, args = []) {
  return {
    address: CONTROLLER_ADDRESS,
    abi: ControllerABI,
    functionName,
    args,
  };
}
