import { SCENARIO_CATALOG } from '../data/scenarioCatalog.js';
import { GROWTH_SCENARIOS, WEEKLY_CHALLENGE } from './growthLoop.js';

export const DISCOVERY_TOPICS = [
  {
    id: 'turn-based-board-game',
    name: 'On-Chain Hex Board',
    description: 'Cooperative hex-board scenarios where every reveal changes shared map state, pressure, route shape, and the decision to escape.',
    tags: ['on-chain', 'hex-grid', 'strategy'],
  },
  {
    id: 'survival-expedition',
    name: 'Survival Expedition',
    description: 'Voyages about morale, danger, fatigue, and extracting value before the shared route closes in.',
    tags: ['survival', 'pressure', 'recovery'],
  },
  {
    id: 'artifact-hunt',
    name: 'Artifact Hunt',
    description: 'Relic-hunting scenarios where digging creates payoff, risk, and a record worth challenging.',
    tags: ['artifact', 'dig', 'solo'],
  },
  {
    id: 'co-op-escape',
    name: 'Co-Op Escape',
    description: 'Cooperative escape scenarios built around shared fog, route planning, helping, and getting the artifact holder home.',
    tags: ['co-op', 'multiplayer', 'escape'],
  },
];

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function allDiscoverableScenarios() {
  const catalogById = new Map(SCENARIO_CATALOG.map((scenario) => [scenario.id, scenario]));
  return uniqueBy(GROWTH_SCENARIOS.map((scenario) => {
    const catalog = catalogById.get(scenario.id) || {};
    return {
      ...catalog,
      ...scenario,
      description: scenario.premise || scenario.hook || catalog.designQuestion,
      tags: uniqueBy([...(scenario.tags || []), ...(catalog.tags || [])], (tag) => tag),
      canonicalPath: `/scenarios/${scenario.id}`,
      playPath: `/play?scenario=${encodeURIComponent(scenario.id)}`,
      challengePath: `/challenge?scenario=${encodeURIComponent(scenario.id)}&seed=${encodeURIComponent(WEEKLY_CHALLENGE.seed)}`,
    };
  }), (scenario) => scenario.id);
}

export function topicForId(topicId) {
  return DISCOVERY_TOPICS.find((topic) => topic.id === topicId) || null;
}

export function scenarioForId(scenarioId) {
  return allDiscoverableScenarios().find((scenario) => scenario.id === scenarioId) || null;
}

export function scenariosForTopic(topicId) {
  const topic = topicForId(topicId);
  if (!topic) return [];
  const topicTags = new Set(topic.tags.map((tag) => tag.toLowerCase()));
  return allDiscoverableScenarios().filter((scenario) => (
    scenario.tags.some((tag) => topicTags.has(String(tag).toLowerCase()))
    || topicTags.has(String(scenario.difficulty || '').toLowerCase())
  ));
}

export function relatedScenariosFor(scenarioId, limit = 3) {
  const scenario = scenarioForId(scenarioId);
  if (!scenario) return allDiscoverableScenarios().slice(0, limit);
  const tags = new Set((scenario.tags || []).map((tag) => String(tag).toLowerCase()));
  return allDiscoverableScenarios()
    .filter((candidate) => candidate.id !== scenario.id)
    .map((candidate) => ({
      ...candidate,
      matchScore: candidate.tags.filter((tag) => tags.has(String(tag).toLowerCase())).length,
    }))
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function relatedTopicsForScenario(scenarioId, limit = 3) {
  const scenario = scenarioForId(scenarioId);
  if (!scenario) return DISCOVERY_TOPICS.slice(0, limit);
  const tags = new Set((scenario.tags || []).map((tag) => String(tag).toLowerCase()));
  return DISCOVERY_TOPICS
    .map((topic) => ({
      ...topic,
      matchScore: topic.tags.filter((tag) => tags.has(String(tag).toLowerCase())).length,
    }))
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
    .slice(0, limit);
}
