module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Bắt buộc cho frame processor của react-native-vision-camera
    plugins: [["react-native-worklets-core/plugin"]],
  };
};
