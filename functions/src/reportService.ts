/**
 * Report Service — geração de relatórios semanais para lojistas.
 * Usa inicialização centralizada do Firebase.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, admin } from './config/firebase';

const FieldValue = admin.firestore.FieldValue;

// Interfaces para tipagem forte
interface OrderData {
  id: string;
  createdAt: admin.firestore.Timestamp;
  total: number;
  status: string;
  lojaId: string;
  deliveryFee: number;
  netValue: number;
  paymentMethod: string;
  customerName: string;
}

interface LojistaData {
  id: string;
  nome: string;
  email: string;
  walletBalance: number;
  pendingBalance: number;
  totalVendas: number;
  totalPedidos: number;
}

interface WeeklyReport {
  lojista: LojistaData;
  periodo: string;
  pedidos: OrderData[];
  resumo: {
    totalVendas: number;
    totalPedidos: number;
    ticketMedio: number;
    taxaEntrega: number;
    comissaoApp: number;
    liquidoRecebido: number;
  };
}

/**
 * Gera relatório semanal de vendas para lojista em formato HTML
 */
export const generateWeeklyReport = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  }

  const { lojaId, startDate, endDate } = request.data;

  if (!lojaId || !startDate || !endDate) {
    throw new HttpsError('invalid-argument', 'lojaId, startDate e endDate sao obrigatorios.');
  }

  try {
    console.log(`[Report] Gerando relatório para lojista: ${lojaId}`);

    // 1. Busca dados do lojista
    const lojistaDoc = await db.collection('users').doc(lojaId).get();
    const lojista = lojistaDoc.data() as any;

    if (!lojista || lojista.tipoUsuario !== 'vendedor') {
      throw new Error('Lojista não encontrado');
    }

    // 2. Busca pedidos do período
    const start = new Date(startDate);
    const end = new Date(endDate);

    const pedidosSnapshot = await db.collection('pedidos')
      .where('lojaId', '==', lojaId)
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .where('status', 'in', ['concluido', 'entregue'])
      .orderBy('createdAt', 'desc')
      .get();

    const pedidos: OrderData[] = pedidosSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as OrderData));

    // 3. Calcula métricas
    const totalVendas = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalPedidos = pedidos.length;
    const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
    const taxaEntrega = pedidos.reduce((sum, p) => sum + (p.deliveryFee || 0), 0);
    const comissaoApp = totalVendas * 0.10; // 10% de comissão
    const liquidoRecebido = totalVendas - comissaoApp;

    // 4. Monta objeto do relatório
    const report: WeeklyReport = {
      lojista: {
        id: lojaId,
        nome: lojista.nome || 'Lojista',
        email: lojista.email,
        walletBalance: lojista.walletBalance || 0,
        pendingBalance: lojista.pendingBalance || 0,
        totalVendas,
        totalPedidos
      },
      periodo: `${new Date(start).toLocaleDateString('pt-BR')} - ${new Date(end).toLocaleDateString('pt-BR')}`,
      pedidos,
      resumo: {
        totalVendas,
        totalPedidos,
        ticketMedio,
        taxaEntrega,
        comissaoApp,
        liquidoRecebido
      }
    };

    // 5. Gera HTML do relatório
    const htmlReport = generateHTMLReport(report);

    // 6. Salva relatório no Firestore para acesso futuro
    await db.collection('reports').add({
      lojaId,
      tipo: 'semanal',
      periodo: report.periodo,
      htmlContent: htmlReport,
      createdAt: FieldValue.serverTimestamp(),
      metrics: report.resumo
    });

    return {
      success: true,
      reportId: 'weekly_report_' + Date.now(),
      htmlContent: htmlReport,
      metrics: report.resumo
    };

  } catch (error: any) {
    console.error('[Report] Erro ao gerar relatório:', error);
    throw new Error('Falha ao gerar relatório: ' + error.message);
  }
});

/**
 * Converte o relatório em HTML profissional
 */
function generateHTMLReport(report: WeeklyReport): string {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (timestamp: admin.firestore.Timestamp) =>
    new Date(timestamp.toDate()).toLocaleString('pt-BR');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório Semanal - EiLanches</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #ff6b6b, #ff8e53); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; border-left: 4px solid #ff6b6b; padding: 20px; border-radius: 8px; }
        .metric-card h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; text-transform: uppercase; }
        .metric-card .value { font-size: 24px; font-weight: bold; color: #ff6b6b; }
        .orders-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
        .orders-table th { background: #ff6b6b; color: white; padding: 12px; text-align: left; }
        .orders-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .orders-table tr:hover { background: #f8f9fa; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .status-pago { background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .status-pendente { background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍔 Relatório Semanal de Vendas</h1>
            <p>${report.lojista.nome} • ${report.periodo}</p>
        </div>
        
        <div class="content">
            <div class="metrics">
                <div class="metric-card">
                    <h3>Total de Vendas</h3>
                    <div class="value">${formatCurrency(report.resumo.totalVendas)}</div>
                </div>
                <div class="metric-card">
                    <h3>Total de Pedidos</h3>
                    <div class="value">${report.resumo.totalPedidos}</div>
                </div>
                <div class="metric-card">
                    <h3>Ticket Médio</h3>
                    <div class="value">${formatCurrency(report.resumo.ticketMedio)}</div>
                </div>
                <div class="metric-card">
                    <h3>Líquido Recebido</h3>
                    <div class="value">${formatCurrency(report.resumo.liquidoRecebido)}</div>
                </div>
            </div>

            <h3>📋 Detalhes dos Pedidos</h3>
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Pedido</th>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.pedidos.map(pedido => `
                        <tr>
                            <td>#${pedido.id.slice(-6)}</td>
                            <td>${formatDate(pedido.createdAt)}</td>
                            <td>${pedido.customerName || '-'}</td>
                            <td>${formatCurrency(pedido.total)}</td>
                            <td><span class="status-pago">${pedido.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Relatório gerado automaticamente por EiLanches • ${new Date().toLocaleString('pt-BR')}</p>
            <p>Taxa de plataforma: ${formatCurrency(report.resumo.comissaoApp)} (10%)</p>
        </div>
    </div>
</body>
</html>
  `;
}
