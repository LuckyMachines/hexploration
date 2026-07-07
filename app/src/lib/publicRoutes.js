import { SCENARIO_CATALOG } from '../data/scenarioCatalog.js';
import { GROWTH_SCENARIOS, WEEKLY_CHALLENGE } from './growthLoop.js';

export const PRIVATE_ROUTE_PATTERNS = [
  '/game/:gameId',
  '/replay/:runId',
  '/ui-lab',
];

export const DISCOVERY_TOPICS = [
  {
    id: 'turn-based-board-game',
    name: 'Chart & Depart Board Game',
    description: 'Chart & Depart scenarios where every action changes pressure, route shape, and the decision to leave.',
    tags: ['chart-and-depart', 'board-game', 'strategy'],
  },
  {
    id: 'survival-expedition',
    name: 'Survival Expedition',
    description: 'Expedition scenarios about morale, danger, fatigue, and extracting value before the board closes in.',
    tags: ['survival', 'pressure', 'recovery'],
  },
  {
    id: 'artifact-hunt',
    name: 'Artifact Hunt',
    description: 'Relic-hunting scenarios where digging creates payoff, risk, and memorable escape stories.',
    tags: ['artifact', 'dig', 'solo'],
  },
  {
    id: 'co-op-escape',
    name: 'Co-Op Escape',
    description: 'Cooperative escape scenarios built around helping, routing, and keeping the artifact holder alive.',
    tags: ['co-op', 'multiplayer', 'escape'],
  },
  {
    id: 'same-engine-simulator',
    name: 'Same-Engine Simulator',
    description: 'Scenario tuning and outcome learning powered by the same contract engine as playable Xenovoya.',
    tags: ['simulator', 'testing', 'tuning'],
  },
];

const STATIC_ROUTES = [
  {
    path: '/',
    type: 'home',
    title: 'Xenovoya',
    description: 'Play Xenovoya, a Chart & Depart expedition game about mapping hostile terrain, recovering value, and escaping before the route collapses.',
    priority: 1,
    changefreq: 'weekly',
  },
  {
    path: '/simulator',
    type: 'simulator',
    title: 'Gameplay Simulator',
    description: 'Use the same engine as the game to run scenarios, compare outcomes, and tune Xenovoya without a separate rules clone.',
    priority: 0.86,
    changefreq: 'weekly',
  },
  {
    path: '/play',
    type: 'play',
    title: 'Play Xenovoya',
    description: 'Start a seedable Chart & Depart run and see if the expedition can chart useful ground, recover value, and escape alive.',
    priority: 0.92,
    changefreq: 'weekly',
  },
  {
    path: '/challenge',
    type: 'challenge',
    title: WEEKLY_CHALLENGE.title,
    description: WEEKLY_CHALLENGE.tagline,
    priority: 0.9,
    changefreq: 'daily',
  },
  {
    path: '/scenarios',
    type: 'scenario-index',
    title: 'Expedition Scenarios',
    description: 'Choose Xenovoya expeditions by pressure, difficulty, player count, and escape tension.',
    priority: 0.88,
    changefreq: 'weekly',
  },
  {
    path: '/progress',
    type: 'progress',
    title: 'Scenario Progress',
    description: 'Review public scenario progress, completion trends, and evidence-backed next experiments.',
    priority: 0.74,
    changefreq: 'weekly',
  },
  {
    path: '/devlog',
    type: 'devlog',
    title: 'Design Devlog',
    description: 'Read automated Xenovoya design updates distilled from scenario evidence, simulator reports, and growth data.',
    priority: 0.7,
    changefreq: 'weekly',
  },
  {
    path: '/design-system',
    type: 'design-system',
    title: 'Game UI Design System',
    description: 'Explore the Xenovoya game UI design system for tokens, board readability, action controls, feedback states, density, and live components.',
    priority: 0.64,
    changefreq: 'monthly',
  },
  {
    path: '/audio-audition',
    type: 'audio-audition',
    title: 'Audio Audition',
    description: 'Audition Xenovoya music and sound effects with searchable state chips, triggers, solo playback, looping, and downloads.',
    priority: 0.58,
    changefreq: 'monthly',
  },
  {
    path: '/create-scenario',
    type: 'creator',
    title: 'Create A Scenario',
    description: 'Draft a local Xenovoya expedition, tune its desired feeling, and test it as a playable Chart & Depart run.',
    priority: 0.66,
    changefreq: 'monthly',
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

export function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
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
  if (topic.id === 'same-engine-simulator') return allDiscoverableScenarios();
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

export function buildPublicRouteIndex({ generatedAt = new Date().toISOString() } = {}) {
  const scenarioRoutes = allDiscoverableScenarios().map((scenario) => ({
    path: scenario.canonicalPath,
    type: 'scenario',
    scenarioId: scenario.id,
    title: scenario.name,
    description: scenario.description || scenario.hook,
    tags: scenario.tags,
    priority: scenario.id === WEEKLY_CHALLENGE.scenarioId ? 0.86 : 0.78,
    changefreq: 'weekly',
    relatedPaths: [
      scenario.playPath,
      ...relatedScenariosFor(scenario.id, 2).map((related) => related.canonicalPath),
      ...relatedTopicsForScenario(scenario.id, 2).map((topic) => `/topics/${topic.id}`),
    ],
  }));
  const topicRoutes = DISCOVERY_TOPICS.map((topic) => ({
    path: `/topics/${topic.id}`,
    type: 'topic',
    topicId: topic.id,
    title: topic.name,
    description: topic.description,
    tags: topic.tags,
    priority: 0.68,
    changefreq: 'monthly',
    relatedPaths: scenariosForTopic(topic.id).map((scenario) => scenario.canonicalPath),
  }));
  return uniqueBy([...STATIC_ROUTES, ...scenarioRoutes, ...topicRoutes].map((route) => ({
    discoverable: true,
    noindex: false,
    lastmod: generatedAt,
    image: '/seo/xenovoya-share-card.svg',
    ...route,
  })), (route) => route.path);
}

export function noindexRouteForPath(pathname = '') {
  const normalized = normalizeRoutePath(pathname);
  return PRIVATE_ROUTE_PATTERNS.some((pattern) => {
    if (!pattern.includes(':')) return normalizeRoutePath(pattern) === normalized;
    const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
    return regex.test(normalized);
  });
}

export function normalizeRoutePath(pathname = '/') {
  const clean = `/${String(pathname || '/').split('?')[0].replace(/^\/+/, '')}`;
  return clean === '/index.html' ? '/' : clean.replace(/\/+$/, '') || '/';
}

export function routeForLocation({ pathname = '/', search = '' } = {}) {
  const normalized = normalizeRoutePath(pathname);
  const routes = buildPublicRouteIndex();
  if (normalized === '/play') {
    const params = new URLSearchParams(search);
    const scenario = scenarioForId(params.get('scenario'));
    if (scenario) {
      return {
        ...routes.find((route) => route.path === '/play'),
        title: `Play ${scenario.name}`,
        description: scenario.description || scenario.hook,
        canonicalPath: scenario.canonicalPath,
        scenarioId: scenario.id,
      };
    }
  }
  const exact = routes.find((route) => route.path === normalized);
  if (exact) return exact;
  if (noindexRouteForPath(normalized)) {
    return {
      path: normalized,
      title: 'Xenovoya Private Session',
      description: 'Private Xenovoya session state.',
      type: 'private',
      discoverable: false,
      noindex: true,
      canonicalPath: '/',
      priority: 0,
      changefreq: 'never',
    };
  }
  return {
    path: normalized,
    title: 'Xenovoya',
    description: 'A Xenovoya page.',
    type: 'unknown',
    discoverable: false,
    noindex: true,
    canonicalPath: '/',
    priority: 0,
    changefreq: 'never',
  };
}
