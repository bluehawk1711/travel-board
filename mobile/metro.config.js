const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Compile the repo-level `shared/` brand & token module.
config.watchFolders = [`${__dirname}/../shared`];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@shared': `${__dirname}/../shared`,
};

module.exports = config;
