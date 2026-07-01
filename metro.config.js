const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Block only the top-level android/ and ios/ dirs inside each package
// (where native C++/Kotlin code lives). The pattern [^/]+ matches exactly
// one path segment so it does NOT block nested dirs like build/android/
// which may contain legitimate JS files (e.g. expo-symbols).
config.resolver.blockList = [
  /node_modules\/(@[^/]+\/)?[^/]+\/android\/.*/,
  /node_modules\/(@[^/]+\/)?[^/]+\/ios\/.*/,
  /node_modules\/(@[^/]+\/)?[^/]+\/cpp\/.*/,
  /.*\.(so|a|dll|dylib|class|jar|aar)$/,
];

config.maxWorkers = 2;

module.exports = config;
