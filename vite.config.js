import {defineConfig} from 'vite';

// Keep one game implementation and choose only the platform integration at build time.
export default defineConfig(({mode}) => {
  const platform = process.env.VITE_PLATFORM ?? (mode === 'yandex' ? 'yandex' : mode.startsWith('crazygames') ? 'crazygames' : 'local');
  const crazyMode = process.env.VITE_CRAZY_MODE ?? (mode === 'crazygames-full' ? 'full' : 'basic');
  if (!['local', 'yandex', 'crazygames'].includes(platform)) throw new Error('Unsupported VITE_PLATFORM');
  if (!['basic', 'full'].includes(crazyMode)) throw new Error('Unsupported VITE_CRAZY_MODE');
  const ads = platform === 'yandex' || (platform === 'crazygames' && crazyMode === 'full') ? 'enabled' : 'disabled';
  return {
    base: './',
    // The old CRA public/index.html and logos are unused by Smash City.
    // Do not copy them over the generated Vite entry point or into platform archives.
    publicDir: false,
    define: {
      'import.meta.env.VITE_PLATFORM': JSON.stringify(platform),
      'import.meta.env.VITE_CRAZY_MODE': JSON.stringify(crazyMode),
    },
    plugins: [{name: 'smash-release-configuration', transformIndexHtml: () => [
      {tag: 'meta', attrs: {name: 'smash-platform', content: platform}, injectTo: 'head'},
      {tag: 'meta', attrs: {name: 'smash-crazy-mode', content: crazyMode}, injectTo: 'head'},
      {tag: 'meta', attrs: {name: 'smash-ads', content: ads}, injectTo: 'head'},
    ]}],
    build: {rollupOptions: {output: {manualChunks: {phaser: ['phaser']}}}},
  };
});
