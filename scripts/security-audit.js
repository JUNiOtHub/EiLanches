// Script de Auditoria de Segurança e Limpeza Otimizado - EiLanches
// Execute com: node scripts/security-audit.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🛡️  INICIANDO BLINDAGEM: EiLanches 🛡️\n');

const SECURITY_CONFIG = {
  // Arquivos que NUNCA devem estar expostos ou fora do .gitignore
  forbiddenFiles: [
    '.env', '.env.local', 'google-services.json', 'serviceAccountKey.json',
    'keystore', 'private_key.pem', 'server.key'
  ],
  
  // Regex para caçar segredos vazados no código
  codePatterns: {
    hardcodedSecrets: /(password|secret|token|api[_-]?key|firebase|private_key)\s*[:=]\s*['"`][\w-]{10,}['"`]/i,
    dangerousFunctions: /(eval\(|innerHTML|outerHTML)/g,
    debugPrints: /console\.(log|debug|warn)/g
  },

  // Versões mínimas de segurança
  vulnerableDeps: [
    { name: 'axios', min: '1.6.0' },
    { name: 'react', min: '18.0.0' },
    { name: 'firebase', min: '10.0.0' }
  ]
};

class SecurityAuditor {
  constructor() {
    this.issues = [];
    this.root = process.cwd();
  }

  // Busca arquivos ignorando pastas pesadas
  getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') return;
      
      if (fs.statSync(filePath).isDirectory()) {
        this.getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    });
    return fileList;
  }

  runAudit() {
    const allFiles = this.getAllFiles(this.root);

    // 1. Verificação de Arquivos Proibidos
    allFiles.forEach(file => {
      const fileName = path.basename(file);
      if (SECURITY_CONFIG.forbiddenFiles.includes(fileName)) {
        this.issues.push({ severity: 'CRITICAL', msg: `Arquivo sensível exposto: ${fileName}`, file });
      }

      // 2. Verificação de Padrões de Código (apenas em arquivos de código)
      if (file.match(/\.(ts|tsx|js|jsx)$/)) {
        const content = fs.readFileSync(file, 'utf8');
        
        if (SECURITY_CONFIG.codePatterns.hardcodedSecrets.test(content)) {
          this.issues.push({ severity: 'HIGH', msg: 'Credencial fixa encontrada no código!', file });
        }
        if (SECURITY_CONFIG.codePatterns.dangerousFunctions.test(content)) {
          this.issues.push({ severity: 'MEDIUM', msg: 'Uso de função perigosa (XSS)', file });
        }
      }
    });

    this.printReport();
  }

  printReport() {
    console.log('📊 RELATÓRIO DE VARREDURA');
    console.log('--------------------------');
    
    if (this.issues.length === 0) {
      console.log('✅ Tudo limpo! O EiLanches está seguro.');
    } else {
      this.issues.forEach(is => {
        const icon = is.severity === 'CRITICAL' ? '🛑' : is.severity === 'HIGH' ? '🟠' : '⚠️';
        console.log(`${icon} [${is.severity}] ${is.msg}`);
        console.log(`   Local: ${path.relative(this.root, is.file)}\n`);
      });
    }

    // Salva o log para o Cascade ler
    fs.writeFileSync('security-report.json', JSON.stringify(this.issues, null, 2));
    console.log('📄 Relatório detalhado salvo em: security-report.json');
  }
}

const auditor = new SecurityAuditor();
auditor.runAudit();