module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle migration'ları .sql dosyalarını metin olarak içe aktarır.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
