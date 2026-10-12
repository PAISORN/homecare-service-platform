/* global __dirname */
const { getDefaultConfig } = require('expo/metro-config');
const { BoundedCacheStore } = require('./metro-cache-store.cjs');

const config = getDefaultConfig(__dirname);

if (process.platform === 'win32') {
  config.maxWorkers = 2;
  config.cacheStores = config.cacheStores.map(
    (store) => new BoundedCacheStore(store),
  );
}

module.exports = config;
