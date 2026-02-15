// Script de Auditoria de Segurança e Limpeza - EiLanches
// Execute com: node scripts/security-audit-fixed.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔒 Auditoria de Segurança - EiLanches\n');

// Configurações de auditoria
const SECURITY_CONFIG = {
  // Arquivos críticos que nunca devem ser commitados
  forbiddenFiles: [
    '.env',
    '.env.local',
    '.env.production',
    'firebase.json',
    'google-services.json',
    'google-services.json',
    'serviceAccountKey.json',
    'serviceAccountKey.p12',
    'id_rsa',
    'id_rsa.pub',
    'id_rsa.pub',
    'id_rsa.p8',
    'id_rsa.pub.p8',
    'keystore',
    'keystore.properties',
    'private_key',
    'private_key.pem',
    'public_key.pem',
    'certificate.pem',
    'fullchain.pem',
    'cert.pem',
    'server.key',
    'server.crt',
    'server.csr',
    'client.key',
    'client.crt',
    'client.csr'
  ],
  
  // Padrões de código inseguro
  insecurePatterns: [
    {
      pattern: 'password',
      description: 'Senha em texto claro',
      severity: 'high'
    },
    {
      pattern: 'secret',
      description: 'Chave secreta em código',
      severity: 'high'
    },
    {
      pattern: 'token',
      description: 'Token de API em código',
      severity: 'high'
    },
    {
      pattern: 'api[_-]?key',
      description: 'Chave de API em código',
      severity: 'high'
    },
    {
      pattern: 'firebase',
      description: 'Credenciais Firebase em código',
      severity: 'high'
    },
    {
      pattern: 'private_key',
      description: 'Chave privada em código',
      severity: 'high'
    },
    {
      pattern: 'BEGIN [A-Z]+ KEY',
      description: 'Chave criptográfica em código',
      severity: 'high'
    },
    {
      pattern: 'console\\.log',
      description: 'Logs de console em produção',
      severity: 'medium'
    },
    {
      pattern: 'debugger',
      description: 'Debugger em produção',
      severity: 'medium'
    },
    {
      pattern: 'alert\\(',
      description: 'Alert em produção',
      severity: 'medium'
    },
    {
      pattern: 'eval\\(',
      description: 'eval() em produção',
      severity: 'high'
    },
    {
      pattern: 'innerHTML',
      description: 'innerHTML inseguro',
      severity: 'high'
    },
    {
      pattern: 'outerHTML',
      description: 'outerHTML inseguro',
      severity: 'high'
    }
  ],

  // Dependências vulneráveis conhecidas
  vulnerableDependencies: [
    { name: 'axios', minVersion: '0.21.1', reason: 'Vulnerabilidades críticas' },
    { name: 'request', minVersion: '2.27.0', reason: 'Vulnerabilidades críticas' },
    { name: 'react', minVersion: '16.14.0', reason: 'Vulnerabilidades críticas' },
    { name: 'react-dom', minVersion: '16.14.0', reason: 'Vulnerabilidades críticas' },
    { name: 'react-router-dom', minVersion: '6.0.0', reason: 'Vulnerabilidades críticas' }
  ]
};

// Classe principal de auditoria
class SecurityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.info = [];
  }

  // Verificar arquivos proibidos
  checkForbiddenFiles() {
    console.log('📁 Verificando arquivos proibidos...');
    
    const allFiles = this.getAllFiles(process.cwd());
    const foundForbidden = allFiles.filter(file => 
      SECURITY_CONFIG.forbiddenFiles.some(forbidden => file.includes(forbidden))
    );

    if (foundForbidden.length > 0) {
      this.issues.push({
        type: 'critical',
        message: `Arquivos proibidos encontrados: ${foundForbidden.join(', ')}`,
        files: foundForbidden
      });
    }

    return foundForbidden.length === 0;
  }

  // Verificar dependências vulneráveis
  checkVulnerableDependencies() {
    console.log('📦 Verificando dependências vulneráveis...');
    
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      this.warnings.push('package.json não encontrado');
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    let foundVulnerable = false;
    
    for (const dep of SECURITY_CONFIG.vulnerableDependencies) {
      const version = dependencies[dep.name];
      if (version && this.compareVersions(version, dep.minVersion) < 0) {
        this.issues.push({
          type: 'critical',
          message: `Dependência vulnerável: ${dep.name} versão ${version} (mínimo: ${dep.minVersion}) - ${dep.reason}`,
          dependency: dep.name,
          currentVersion: version,
          minVersion: dep.minVersion
        });
        foundVulnerable = true;
      }
    }

    return !foundVulnerable;
  }

  // Verificar padrões de código inseguro
  checkInsecurePatterns() {
    console.log('🔍 Verificando padrões de código inseguro...');
    
    const allFiles = this.getAllFiles(process.cwd());
    const sourceFiles = allFiles.filter(file => 
      file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')
    );

    let foundIssues = false;

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of Object.values(SECURITY_CONFIG.insecurePatterns)) {
        if (pattern.test(content)) {
          this.issues.push({
            type: 'high',
            message: `Padrão inseguro detectado em ${file}: ${pattern.description}`,
            file,
            pattern: pattern.source
          });
          foundIssues = true;
        }
      }
    }

    return !foundIssues;
  }

  // Obter todos os arquivos recursivamente
  getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        fileList.push(...this.getAllFiles(filePath, fileList));
      } else {
        fileList.push(filePath);
      }
    }
    
    return fileList;
  }

  // Comparar versões
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < v1Parts.length; i++) {
      if (v2Parts[i] > v1Parts[i]) return 1;
      if (v2Parts[i] < v1Parts[i]) return -1;
      if (v2Parts[i] > v1Parts[i]) return 1;
      if (v2Parts[i] < v1Parts[i]) return -1;
      return 0;
    }
    
    return 0;
  }

  // Gerar relatório
  generateReport() {
    console.log('\n📊 Gerando relatório de segurança...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      project: 'EiLanches',
      environment: process.env.NODE_ENV || 'development',
      summary: {
        totalIssues: this.issues.length,
        totalWarnings: this.warnings.length,
        criticalIssues: this.issues.filter(i => i.type === 'critical').length,
        highIssues: this.issues.filter(i => i.type === 'high').length,
        mediumIssues: this.issues.filter(i => i.type === 'medium').length
      },
      issues: this.issues,
      warnings: this.warnings,
      recommendations: this.getRecommendations()
    };

    // Salvar relatório
    const reportPath = path.join(__dirname, '..', 'security-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  // Gerar recomendações
  getRecommendations() {
    const recommendations = [];
    
    if (this.issues.some(i => i.type === 'critical')) {
      recommendations.push('🚨 CORRIJA OS PROBLEMAS CRÍTICOS ANTES DE PRODUZIR');
    }
    
    if (this.issues.some(i => i.type === 'high')) {
      recommendations.push('🔒 Revise os padrões de código inseguro identificados');
    }
    
    recommendations.push('🔐 Mantenha as dependências sempre atualizadas');
    recommendations.push('📱 Use HTTPS em produção');
    recommendations.push('🔒 Implemente autenticação de dois fatores');
    recommendations.push('🛡️ Configure CORS corretamente');
    recommendations.push('📝 Adicione testes de segurança automatizados');
    
    return recommendations;
  }
}

// Função principal
async function runSecurityAudit() {
  console.log('🚀 Iniciando auditoria de segurança do EiLanches...\n');
  
  const auditor = new SecurityAuditor();
  
  // Executar todas as verificações
  const checks = [
    () => auditor.checkForbiddenFiles(),
    () => auditor.checkVulnerableDependencies(),
    () => auditor.checkInsecurePatterns()
  ];

  for (const check of checks) {
    try {
      const result = check();
      if (!result) {
        console.log(`❌ Falha na verificação`);
      }
    } catch (error) {
      console.error(`❌ Erro na verificação: ${error.message}`);
    }
  }

  // Gerar relatório final
  const report = auditor.generateReport();
  
  console.log('\n📊 RELATÓRIO DE SEGURANÇA');
  console.log('================================');
  console.log(`Status: ${report.summary.criticalIssues > 0 ? 'CRÍTICO' : report.summary.highIssues > 0 ? 'ALERTA' : 'OK'}`);
  console.log(`Problemas: ${report.summary.totalIssues}`);
  console.log(`Avisos: ${report.summary.totalWarnings}`);
  console.log(`Recomendações: ${report.recommendations.length}`);
  
  if (report.issues.length > 0) {
    console.log('\n🚨 PROBLEMAS ENCONTRADOS:');
    report.issues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.type.toUpperCase()}] ${issue.message}`);
      if (issue.file) console.log(`   Arquivo: ${issue.file}`);
      if (issue.dependency) console.log(`   Dependência: ${issue.dependency} (${issue.currentVersion})`);
      if (issue.pattern) console.log(`   Padrão: ${issue.pattern}`);
    });
  }
  
  if (report.warnings.length > 0) {
    console.log('\n⚠️ AVISOS:');
    report.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }
  
  console.log('\n📋 RECOMENDAÇÕES:');
  report.recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });
  
  console.log('\n📄 Relatório salvo em: security-report.json');
  console.log('================================');
  
  // Retornar status de saída
  return report.summary.criticalIssues === 0 && report.summary.highIssues === 0;
}

// Executar auditoria se chamado diretamente
if (import.meta.url === `file://${__filename}`) {
  runSecurityAudit();
}

export { SecurityAuditor, runSecurityAudit };
