// Script para gerar ícones e splash screen - EiLanches
// Execute com: node scripts/generate-assets.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎨 Gerador de Assets - EiLanches\n');

// Configurações de assets
const ASSETS_CONFIG = {
  icon: {
    source: 'https://via.placeholder.com/1024x1024/FF8C00/FFFFFF?text=EiLanches',
    sizes: [
      { size: 16, name: 'icon-16.png' },
      { size: 32, name: 'icon-32.png' },
      { size: 48, name: 'icon-48.png' },
      { size: 64, name: 'icon-64.png' },
      { size: 128, name: 'icon-128.png' },
      { size: 256, name: 'icon-256.png' },
      { size: 512, name: 'icon-512.png' },
      { size: 1024, name: 'icon-1024.png' }
    ]
  },
  splash: {
    source: 'https://via.placeholder.com/1242x2436/0F0F0F/FF8C00?text=EiLanches',
    sizes: [
      { width: 1242, height: 2436, name: 'splash-iphone-x.png' },
      { width: 1125, height: 2436, name: 'splash-iphone-plus.png' },
      { width: 750, height: 1334, name: 'splash-iphone-6.png' },
      { width: 640, height: 1136, name: 'splash-iphone-5.png' },
      { width: 1242, height: 2208, name: 'splash-iphone-xs-max.png' },
      { width: 2048, height: 2732, name: 'splash-ipad-pro.png' },
      { width: 1536, height: 2048, name: 'splash-ipad.png' },
      { width: 768, height: 1024, name: 'splash-ipad-mini.png' }
    ]
  },
  android: {
    adaptiveIcon: {
      foreground: 'https://via.placeholder.com/1024x1024/FF8C00/FFFFFF?text=Ei',
      background: '#FF8C00',
      sizes: [
        { size: 36, name: 'mipmap-ldpi/ic_launcher.png' },
        { size: 48, name: 'mipmap-mdpi/ic_launcher.png' },
        { size: 72, name: 'mipmap-hdpi/ic_launcher.png' },
        { size: 96, name: 'mipmap-xhdpi/ic_launcher.png' },
        { size: 144, name: 'mipmap-xxhdpi/ic_launcher.png' },
        { size: 192, name: 'mipmap-xxxhdpi/ic_launcher.png' },
        { size: 512, name: 'mipmap-xxxhdpi/ic_launcher.png' }
      ]
    },
    splash: {
      source: 'https://via.placeholder.com/1280x1920/0F0F0F/FF8C00?text=EiLanches',
      sizes: [
        { width: 1280, height: 1920, name: 'splash-screen.png' },
        { width: 1920, height: 1280, name: 'splash-screen-land.png' }
      ]
    }
  }
};

// Função para criar diretórios
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Criado diretório: ${dirPath}`);
  }
}

// Função para baixar imagem (simulação)
async function downloadImage(url, outputPath) {
  try {
    // Em um ambiente real, você usaria fetch ou axios
    // Para este exemplo, vamos criar um arquivo placeholder
    
    const placeholder = createPlaceholderImage(url);
    fs.writeFileSync(outputPath, placeholder);
    console.log(`✅ Gerado: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao gerar ${outputPath}:`, error.message);
    return false;
  }
}

// Função para criar placeholder (simulação)
function createPlaceholderImage(url) {
  // Em um ambiente real, você geraria uma imagem real
  // Para este exemplo, retornamos um buffer simulado
  const isIcon = url.includes('icon');
  const isSplash = url.includes('splash');
  
  if (isIcon) {
    return Buffer.from('ICON_PLACEHOLDER_DATA');
  } else if (isSplash) {
    return Buffer.from('SPLASH_PLACEHOLDER_DATA');
  }
  
  return Buffer.from('IMAGE_PLACEHOLDER_DATA');
}

// Função para gerar ícones
async function generateIcons() {
  console.log('🎯 Gerando ícones...');
  
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');
  ensureDirectory(iconsDir);
  
  let successCount = 0;
  
  for (const iconSize of ASSETS_CONFIG.icon.sizes) {
    const outputPath = path.join(iconsDir, iconSize.name);
    const success = await downloadImage(ASSETS_CONFIG.icon.source, outputPath);
    if (success) successCount++;
  }
  
  console.log(`✅ Ícones gerados: ${successCount}/${ASSETS_CONFIG.icon.sizes.length}`);
  return successCount > 0;
}

// Função para gerar splash screens
async function generateSplashScreens() {
  console.log('🌊 Gerando splash screens...');
  
  const splashDir = path.join(__dirname, '..', 'assets', 'splash');
  ensureDirectory(splashDir);
  
  let successCount = 0;
  
  for (const splashSize of ASSETS_CONFIG.splash.sizes) {
    const outputPath = path.join(splashDir, splashSize.name);
    const success = await downloadImage(ASSETS_CONFIG.splash.source, outputPath);
    if (success) successCount++;
  }
  
  console.log(`✅ Splash screens gerados: ${successCount}/${ASSETS_CONFIG.splash.sizes.length}`);
  return successCount > 0;
}

// Função para gerar assets Android
async function generateAndroidAssets() {
  console.log('🤖 Gerando assets Android...');
  
  const androidDir = path.join(__dirname, '..', 'android');
  ensureDirectory(androidDir);
  
  // Gerar ícones adaptativos
  const adaptiveIconDir = path.join(androidDir, 'app', 'src', 'main', 'res');
  ensureDirectory(adaptiveIconDir);
  
  let successCount = 0;
  
  for (const iconSize of ASSETS_CONFIG.android.adaptiveIcon.sizes) {
    const dirPath = path.join(adaptiveIconDir, iconSize.name.split('/')[0]);
    ensureDirectory(dirPath);
    
    const outputPath = path.join(adaptiveIconDir, iconSize.name);
    const success = await downloadImage(ASSETS_CONFIG.android.adaptiveIcon.foreground, outputPath);
    if (success) successCount++;
  }
  
  // Gerar splash screens Android
  const splashDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'drawable');
  ensureDirectory(splashDir);
  
  for (const splashSize of ASSETS_CONFIG.android.splash.sizes) {
    const outputPath = path.join(splashDir, splashSize.name);
    const success = await downloadImage(ASSETS_CONFIG.android.splash.source, outputPath);
    if (success) successCount++;
  }
  
  console.log(`✅ Assets Android gerados: ${successCount}/${ASSETS_CONFIG.android.adaptiveIcon.sizes.length + ASSETS_CONFIG.android.splash.sizes.length}`);
  return successCount > 0;
}

// Função para gerar assets iOS
async function generateIOSAssets() {
  console.log('🍎 Gerando assets iOS...');
  
  const iosDir = path.join(__dirname, '..', 'ios');
  ensureDirectory(iosDir);
  
  const assetsDir = path.join(iosDir, 'EiLanches', 'Assets.xcassets', 'AppIcon.appiconset');
  ensureDirectory(assetsDir);
  
  let successCount = 0;
  
  // Gerar ícones iOS
  for (const iconSize of ASSETS_CONFIG.icon.sizes) {
    const outputPath = path.join(assetsDir, `icon-${iconSize.size}x${iconSize.size}@2x.png`);
    const success = await downloadImage(ASSETS_CONFIG.icon.source, outputPath);
    if (success) successCount++;
  }
  
  // Gerar splash iOS
  const splashDir = path.join(iosDir, 'EiLanches', 'Assets.xcassets', 'LaunchScreen.imageset');
  ensureDirectory(splashDir);
  
  for (const splashSize of ASSETS_CONFIG.splash.sizes) {
    const outputPath = path.join(splashDir, splashSize.name);
    const success = await downloadImage(ASSETS_CONFIG.splash.source, outputPath);
    if (success) successCount++;
  }
  
  console.log(`✅ Assets iOS gerados: ${successCount}`);
  return successCount > 0;
}

// Função para gerar arquivo de configuração de assets
function generateAssetsConfig() {
  console.log('⚙️ Gerando configuração de assets...');
  
  const config = {
    generated: new Date().toISOString(),
    assets: {
      icons: ASSETS_CONFIG.icon.sizes.length,
      splashScreens: ASSETS_CONFIG.splash.sizes.length,
      android: {
        icons: ASSETS_CONFIG.android.adaptiveIcon.sizes.length,
        splashScreens: ASSETS_CONFIG.android.splash.sizes.length
      }
    },
    nextSteps: [
      '1. Substitua os placeholders pelas imagens reais',
      '2. Use ferramentas como icon.kitchen para ícones profissionais',
      '3. Teste em diferentes dispositivos e densidades de tela',
      '4. Valide safe areas em dispositivos mais recentes'
    ]
  };
  
  const configPath = path.join(__dirname, '..', 'assets', 'assets-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Configuração salva em: ${configPath}`);
}

// Função principal
async function generateAssets() {
  console.log('🚀 Iniciando geração de assets...\n');
  
  // Criar diretórios principais
  const assetsDir = path.join(__dirname, '..', 'assets');
  ensureDirectory(assetsDir);
  
  // Gerar diferentes tipos de assets
  const results = await Promise.all([
    generateIcons(),
    generateSplashScreens(),
    generateAndroidAssets(),
    generateIOSAssets()
  ]);
  
  // Gerar configuração
  generateAssetsConfig();
  
  const success = results.every(result => result);
  
  if (success) {
    console.log('\n🎉 Todos os assets foram gerados com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1️⃣  Substitua os placeholders pelas imagens reais do EiLanches');
    console.log('2️⃣  Use ferramentas profissionais para otimizar as imagens');
    console.log('3️⃣  Teste em diferentes dispositivos e densidades');
    console.log('4️⃣  Valide as cores e proporções');
    console.log('\n🛠️  Ferramentas recomendadas:');
    console.log('   - icon.kitchen (ícones)');
    console.log('   - appicon.co (splash screens)');
    console.log('   - expo install @expo/vector-icons (ícones vetorizados)');
    console.log('   - npx expo-optimize (otimização)');
  } else {
    console.log('\n❌ Alguns assets não puderam ser gerados');
    console.log('💡 Verifique o console para detalhes dos erros');
  }
}

// Executar geração
generateAssets().catch(error => {
  console.error('\n❌ Erro na geração de assets:', error);
  process.exit(1);
});
