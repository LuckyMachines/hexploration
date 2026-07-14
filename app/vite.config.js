import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const internalPublicDirs = ['simulator', 'bridge', 'growth', 'fun', 'local-stack', 'verification'];
const addressKeys = [
  'VITE_BOARD_ADDRESS',
  'VITE_CONTROLLER_ADDRESS',
  'VITE_GAME_SUMMARY_ADDRESS',
  'VITE_PLAYER_SUMMARY_ADDRESS',
  'VITE_GAME_EVENTS_ADDRESS',
  'VITE_GAME_REGISTRY_ADDRESS',
  'VITE_GAME_QUEUE_ADDRESS',
  'VITE_GAME_SETUP_ADDRESS',
];

function stripInternalPublicArtifacts(enabled) {
  return {
    name: 'strip-internal-public-artifacts',
    closeBundle() {
      if (enabled) return;
      for (const dir of internalPublicDirs) rmSync(resolve('dist', dir), { recursive: true, force: true });
    },
  };
}

function emitReleaseMetadata(env) {
  return {
    name: 'emit-release-metadata',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'release.json',
        source: `${JSON.stringify({
          service: 'xenovoya-player',
          environment: env.VITE_APP_ENV || 'development',
          release: env.VITE_RELEASE_SHA || 'unknown',
        })}\n`,
      });
    },
  };
}

function validateProductionEnvironment(env) {
  const failures = [];
  for (const key of addressKeys) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(env[key] || '')) failures.push(`${key} must be a deployed address`);
  }
  for (const key of ['VITE_RPC_URL', 'VITE_LIVE_PLAY_URL', 'VITE_PLAUSIBLE_HOST', 'VITE_RETURN_API_URL']) {
    try {
      if (new URL(env[key]).protocol !== 'https:') failures.push(`${key} must use HTTPS`);
    } catch {
      failures.push(`${key} must be an absolute HTTPS URL`);
    }
  }
  if (env.VITE_PLAUSIBLE_DOMAIN !== 'play.xenovoya.com') failures.push('VITE_PLAUSIBLE_DOMAIN must identify the production origin');
  if (env.VITE_APP_ENV !== 'production') failures.push('VITE_APP_ENV must be production');
  if (env.VITE_ANALYTICS_SOURCE !== 'player') failures.push('VITE_ANALYTICS_SOURCE must be player');
  if (!/^[a-f0-9]{40}$/.test(env.VITE_RELEASE_SHA || '')) failures.push('VITE_RELEASE_SHA must be the full release commit');
  if (env.VITE_ENABLE_INTERNAL_TOOLS === 'true') failures.push('Internal tools cannot be enabled in the production player build');
  if (failures.length) throw new Error(`Production environment validation failed:\n- ${failures.join('\n- ')}`);
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (mode === 'production') validateProductionEnvironment(env);
  return {
    plugins: [
      react(),
      tailwindcss(),
      stripInternalPublicArtifacts(env.VITE_ENABLE_INTERNAL_TOOLS === 'true'),
      emitReleaseMetadata(env),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            viem: ['viem', 'viem/chains', 'viem/accounts'],
          },
        },
      },
    },
    server: { port: 5502, strictPort: true },
    preview: { port: 4502, strictPort: true },
    resolve: { alias: { '@': '/src' } },
  };
});
