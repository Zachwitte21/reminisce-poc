const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro uses react-native export condition to avoid ESM import.meta issues
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

module.exports = config;
