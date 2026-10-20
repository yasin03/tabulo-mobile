const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle migration dosyaları (.sql) paketlenebilsin.
config.resolver.sourceExts.push('sql');

// withUniwindConfig her zaman en dıştaki sarmalayıcı olmalı.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
