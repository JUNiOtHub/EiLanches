#!/usr/bin/env node

/**
 * Script de Teste - Mercado Pago Integration
 * Valida credenciais e funcionalidades básicas
 */

const https = require('https');

// Credenciais fornecidas
const MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-2754483714539775-021417-2a09f35b4da8ff5f3a0eaaf98bd0ca44-3203099803';
const MERCADO_PAGO_PUBLIC_KEY = 'APP_USR-c214f92c-b671-446f-80fb-caeba2252202';

console.log('🚀 Testando Integração Mercado Pago - EiLanches');
console.log('='.repeat(50));

// Teste 1: Validar Access Token
async function testAccessToken() {
    console.log('\n📋 Teste 1: Validando Access Token...');
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.mercadopago.com',
            path: '/users/me',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const user = JSON.parse(data);
                    console.log('✅ Access Token VÁLIDO');
                    console.log(`   User ID: ${user.id}`);
                    console.log(`   Nome: ${user.first_name} ${user.last_name}`);
                    console.log(`   Email: ${user.email}`);
                    console.log(`   País: ${user.country_id}`);
                    resolve(true);
                } else {
                    console.log('❌ Access Token INVÁLIDO');
                    console.log(`   Status: ${res.statusCode}`);
                    console.log(`   Erro: ${data}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.log('❌ Erro na requisição:', error.message);
            resolve(false);
        });

        req.end();
    });
}

// Teste 2: Criar Preferência de Pagamento
async function testCreatePreference() {
    console.log('\n📋 Teste 2: Criando Preferência de Pagamento...');
    
    const preferenceData = {
        items: [
            {
                id: 'eilanches-test-001',
                title: 'X-Burger Teste',
                quantity: 1,
                unit_price: 25.90,
                currency_id: 'BRL'
            }
        ],
        payer: {
            name: 'Cliente Teste',
            email: 'test@eilanches.com',
            phone: {
                area_code: '11',
                number: '999999999'
            }
        },
        payment_methods: {
            excluded_payment_types: ['ticket'],
            excluded_payment_methods: ['atm']
        },
        back_urls: {
            success: 'https://eilanches.com/success',
            failure: 'https://eilanches.com/failure',
            pending: 'https://eilanches.com/pending'
        },
        auto_return: 'approved',
        external_reference: 'TEST-ORDER-001',
        expires: true,
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const preference = JSON.parse(data);
                    console.log('✅ Preferência criada com SUCESSO');
                    console.log(`   ID: ${preference.id}`);
                    console.log(`   Init Point: ${preference.init_point}`);
                    console.log(`   Valor: R$ ${preference.items[0].unit_price}`);
                    console.log(`   Expira: ${preference.expiration_date_to}`);
                    resolve({ success: true, preferenceId: preference.id });
                } else {
                    console.log('❌ Erro ao criar preferência');
                    console.log(`   Status: ${res.statusCode}`);
                    console.log(`   Erro: ${data}`);
                    resolve({ success: false });
                }
            });
        });

        req.on('error', (error) => {
            console.log('❌ Erro na requisição:', error.message);
            resolve({ success: false });
        });

        req.write(JSON.stringify(preferenceData));
        req.end();
    });
}

// Teste 3: Gerar QR Code Pix
async function testGeneratePix(preferenceId) {
    console.log('\n📋 Teste 3: Gerando QR Code Pix...');
    
    const paymentData = {
        transaction_amount: 25.90,
        description: 'EiLanches - Pedido TEST-ORDER-001',
        payment_method_id: 'pix',
        payer: {
            email: 'test@eilanches.com'
        },
        external_reference: 'TEST-ORDER-001',
        notification_url: 'https://eilanches.com/webhook/mercadopago',
        expires: true,
        expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.mercadopago.com',
            path: '/v1/payments',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `TEST-${Date.now()}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const payment = JSON.parse(data);
                    console.log('✅ QR Code Pix gerado com SUCESSO');
                    console.log(`   Payment ID: ${payment.id}`);
                    console.log(`   Status: ${payment.status}`);
                    console.log(`   Transaction ID: ${payment.point_of_interaction?.transaction_id}`);
                    console.log(`   QR Code: ${payment.point_of_interaction?.transaction_data?.qr_code ? 'Gerado ✓' : 'Não gerado ✗'}`);
                    console.log(`   Expira: ${payment.date_of_expiration}`);
                    resolve({ success: true, paymentId: payment.id });
                } else {
                    console.log('❌ Erro ao gerar QR Code');
                    console.log(`   Status: ${res.statusCode}`);
                    console.log(`   Erro: ${data}`);
                    resolve({ success: false });
                }
            });
        });

        req.on('error', (error) => {
            console.log('❌ Erro na requisição:', error.message);
            resolve({ success: false });
        });

        req.write(JSON.stringify(paymentData));
        req.end();
    });
}

// Teste 4: Verificar Status do Pagamento
async function testCheckStatus(paymentId) {
    console.log('\n📋 Teste 4: Verificando Status do Pagamento...');
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.mercadopago.com',
            path: `/v1/payments/${paymentId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const payment = JSON.parse(data);
                    console.log('✅ Status verificado com SUCESSO');
                    console.log(`   Payment ID: ${payment.id}`);
                    console.log(`   Status: ${payment.status}`);
                    console.log(`   Status Detail: ${payment.status_detail}`);
                    console.log(`   Método: ${payment.payment_method_id}`);
                    console.log(`   Valor: R$ ${payment.transaction_amount}`);
                    console.log(`   Criado: ${payment.date_created}`);
                    resolve({ success: true });
                } else {
                    console.log('❌ Erro ao verificar status');
                    console.log(`   Status: ${res.statusCode}`);
                    console.log(`   Erro: ${data}`);
                    resolve({ success: false });
                }
            });
        });

        req.on('error', (error) => {
            console.log('❌ Erro na requisição:', error.message);
            resolve({ success: false });
        });

        req.end();
    });
}

// Executar todos os testes
async function runAllTests() {
    console.log(`🔑 Usando Access Token: ${MERCADO_PAGO_ACCESS_TOKEN.substring(0, 20)}...`);
    console.log(`🔑 Usando Public Key: ${MERCADO_PAGO_PUBLIC_KEY.substring(0, 20)}...`);

    const test1 = await testAccessToken();
    
    if (!test1) {
        console.log('\n❌ Falha crítica: Access Token inválido. Verifique suas credenciais.');
        process.exit(1);
    }

    const test2 = await testCreatePreference();
    
    if (!test2.success) {
        console.log('\n❌ Falha ao criar preferência. Verifique permissões da conta.');
        process.exit(1);
    }

    const test3 = await testGeneratePix(test2.preferenceId);
    
    if (!test3.success) {
        console.log('\n❌ Falha ao gerar QR Code. Verifique configuração Pix.');
        process.exit(1);
    }

    const test4 = await testCheckStatus(test3.paymentId);
    
    if (!test4.success) {
        console.log('\n❌ Falha ao verificar status. Verifique permissões.');
        process.exit(1);
    }

    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Mercado Pago está 100% integrado ao EiLanches!');
    console.log('\n📋 Resumo:');
    console.log('   ✅ Access Token válido');
    console.log('   ✅ Criação de preferências funcionando');
    console.log('   ✅ Geração de QR Code Pix funcionando');
    console.log('   ✅ Verificação de status funcionando');
    console.log('\n🚀 Seu app está PRONTO para receber pagamentos!');
}

// Executar testes
runAllTests().catch(console.error);
