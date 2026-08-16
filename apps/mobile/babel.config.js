module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last: the worklets plugin rewrites every function Reanimated runs on the
    // UI thread, and anything appended after it would not be transformed.
    plugins: ['react-native-worklets/plugin'],
  };
};
