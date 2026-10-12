const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Compile the repo-level `shared/` brand & token package (also symlinked via
// node_modules through the `file:` dependency in package.json).
config.watchFolders = [`${__dirname}/../shared`];

module.exports = config;
