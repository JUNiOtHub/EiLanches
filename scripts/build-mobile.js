// Script de build para mobile - EiLanches
// Execute com: node scripts/build-mobile.js

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Build Mobile - EiLanches\n');

// Verificar se estamos no diretório correto
const packagePath = path.join(__dirname, '..', 'package.json');
if (!fs.existsSync(packagePath)) {
  console.error('❌ package.json não encontrado. Execute na raiz do projeto.');
  process.exit(1);
}

// Função para executar comandos
function runCommand(command, description) {
  console.log(`\n📋 ${description}`);
  console.log(`⚡ Executando: ${command}`);
  
  try {
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log(`✅ ${description} concluído com sucesso!`);
    return true;
  } catch (error) {
    console.error(`❌ Erro em ${description}:`, error.message);
    return false;
  }
}

// Função para verificar dependências
function checkDependencies() {
  console.log('🔍 Verificando dependências...');
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};
  
  const requiredDeps = [
    '@capacitor/core',
    '@capacitor/cli',
    '@capacitor/android',
    '@capacitor/ios',
    'framer-motion'
  ];
  
  const missingDeps = requiredDeps.filter(dep => 
    !deps[dep] && !devDeps[dep]
  );
  
  if (missingDeps.length > 0) {
    console.log('❌ Dependências faltando:');
    missingDeps.forEach(dep => console.log(`   - ${dep}`));
    console.log('\n💡 Execute: npm install ' + missingDeps.join(' '));
    return false;
  }
  
  console.log('✅ Todas as dependências estão instaladas');
  return true;
}

// Função para verificar arquivos de configuração
function checkConfigFiles() {
  console.log('📁 Verificando arquivos de configuração...');
  
  const requiredFiles = [
    'capacitor.config.ts',
    'eas.json',
    'app.json'
  ];
  
  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(__dirname, '..', file))
  );
  
  if (missingFiles.length > 0) {
    console.log('❌ Arquivos de configuração faltando:');
    missingFiles.forEach(file => console.log(`   - ${file}`));
    return false;
  }
  
  console.log('✅ Todos os arquivos de configuração encontrados');
  return true;
}

// Função para criar diretórios de assets
function createAssetsDirectories() {
  console.log('📁 Criando diretórios de assets...');
  
  const dirs = [
    'assets',
    'assets/icons',
    'assets/images',
    'assets/sounds',
    'assets/fonts'
  ];
  
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Criado: ${dir}`);
    }
  });
  
  console.log('✅ Diretórios de assets verificados');
}

// Menu interativo
function showMenu() {
  console.log('\n🎯 Escolha a opção de build:');
  console.log('1️⃣  Build para desenvolvimento (Android APK)');
  console.log('2️⃣  Build para preview (iOS + Android)');
  console.log('3️⃣  Build para produção (iOS + Android)');
  console.log('4️⃣  Apenas sincronizar com Capacitor');
  console.log('5️⃣  Gerar ícones e splash screen');
  console.log('6️⃣  Sair');
  
  // Em ambiente real, você usaria readline ou similar
  // Para este exemplo, vamos usar argumentos de linha de comando
  const args = process.argv.slice(2);
  const option = args[0] || '1';
  
  return option;
}

// Função principal de build
async function buildMobile(option) {
  console.log(`🚀 Iniciando build - Opção ${option}\n`);
  
  // Verificações iniciais
  if (!checkDependencies()) {
    console.log('\n❌ Execute: npm install para instalar dependências faltando');
    process.exit(1);
  }
  
  if (!checkConfigFiles()) {
    console.log('\n❌ Verifique os arquivos de configuração');
    process.exit(1);
  }
  
  // Criar diretórios
  createAssetsDirectories();
  
  switch (option) {
    case '1':
      // Build para desenvolvimento Android
      if (!runCommand('npm run build', 'Build do Vite')) return;
      if (!runCommand('npx cap sync android', 'Sincronizar com Android')) return;
      console.log('\n🎉 Build de desenvolvimento Android concluído!');
      console.log('📱 Abra o Android Studio e execute o projeto');
      break;
      
    case '2':
      // Build para preview
      if (!runCommand('npm run build', 'Build do Vite')) return;
      if (!runCommand('npx cap sync', 'Sincronizar Capacitor')) return;
      console.log('\n🎉 Build para preview preparado!');
      console.log('📱 Execute: eas build --platform preview');
      break;
      
    case '3':
      // Build para produção
      if (!runCommand('npm run build', 'Build do Vite')) return;
      if (!runCommand('npx cap sync', 'Sincronizar Capacitor')) return;
      console.log('\n🎉 Build para produção preparado!');
      console.log('📱 Execute: eas build --platform production');
      break;
      
    case '4':
      // Apenas sincronizar
      if (!runCommand('npm run build', 'Build do Vite')) return;
      if (!runCommand('npx cap sync', 'Sincronizar Capacitor')) return;
      console.log('\n✅ Sincronização concluída!');
      break;
      
    case '5':
      // Gerar assets
      console.log('\n🎨 Gerando ícones e splash screen...');
      console.log('💡 Use ferramentas como:');
      console.log('   - expo install @expo/vector-icons');
      console.log('   - npx expo-optimize');
      console.log('   - https://icon.kitchen/ para ícones');
      break;
      
    default:
      console.log('❌ Opção inválida');
      process.exit(1);
  }
  
  console.log('\n📋 Próximos passos:');
  console.log('1️⃣  Teste no emulador ou dispositivo real');
  console.log('2️⃣  Verifique as permissões (câmera, localização)');
  console.log('3️⃣  Teste fluxos principais (login, pedido, pagamento)');
  console.log('4️⃣  Valide performance e UX');
}

// Executar build
const option = showMenu();
buildMobile(option).catch(error => {
  console.error('\n❌ Erro no build:', error);
  process.exit(1);
});
