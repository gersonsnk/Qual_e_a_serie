const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Adiciona suporte para arquivos .ico que o Metro não conhece por padrão
config.resolver.assetExts.push('ico');

module.exports = config;
