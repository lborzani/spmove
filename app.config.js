// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require('./app.json');

/** @type {import('@expo/config').ExpoConfig} */
const config = {
  ...base.expo,
  plugins: [...base.expo.plugins, '@maplibre/maplibre-react-native'],
};

module.exports = config;
