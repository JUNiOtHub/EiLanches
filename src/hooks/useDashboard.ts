import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db, collection, onSnapshot, query, where, doc, updateDoc, writeBatch, getDocs, addDoc, deleteDoc, serverTimestamp } from '@/firebase';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export const useDashboard = () => {
    const { profile } = useAuth();
    const [activeOrders, setActiveOrders] = useState<any[]>([]);
    const [completedOrders, setCompletedOrders] = useState<any[]>([]);
    const [storeSettings, setStoreSettings] = useState<any>(null);
    const [menuItems, setMenuItems] = useState<any[]>([]);

    const isFirstLoad = useRef(true);
    const prevPendingCount = useRef(0);
    const audioAlert = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

    // Listener for Store Settings and Menu
    useEffect(() => {
        if (!profile?.uid) return;
        const unsubStore = onSnapshot(doc(db, 'users', profile.uid), (doc) => setStoreSettings(doc.data()));
        const unsubMenu = onSnapshot(collection(db, 'users', profile.uid, 'cardapio'), (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            items.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
            setMenuItems(items);
        });
        return () => { unsubStore(); unsubMenu(); };
    }, [profile?.uid]);

    // Listener for Orders
    useEffect(() => {
        if (!profile?.lojaId) return;
        const q = query(collection(db, 'pedidos'), where('lojaId', '==', profile.lojaId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            
            const active = allDocs.filter(d => d.status !== 'concluido' && d.status !== 'cancelado');
            active.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
            
            const completed = allDocs.filter(d => d.status === 'concluido');

            // New order notification
            const pendingCount = active.filter(d => d.status === 'pendente').length;
            if (!isFirstLoad.current && pendingCount > prevPendingCount.current) {
                audioAlert.current.play().catch(e => console.log('Audio notify error:', e));
                toast.success("🔔 Novo pedido chegou!");
            }
            
            isFirstLoad.current = false;
            prevPendingCount.current = pendingCount;
            
            setActiveOrders(active);
            setCompletedOrders(completed);
        }, (err) => {
            console.error("Dashboard listener error:", err);
            toast.error("Erro de conexão com os pedidos.");
        });
        return () => unsubscribe();
    }, [profile?.lojaId]);

    // --- ACTIONS ---

    const updateStatus = useCallback(async (pedidoId: string, newStatus: string) => {
        try {
            const pedidoRef = doc(db, 'pedidos', pedidoId);
            const updateData: any = { status: newStatus };
            const now = new Date().toISOString();

            if (newStatus === 'preparando') updateData.preparandoEm = now;
            if (newStatus === 'entrega' || newStatus === 'pronto_retirada') updateData.entregaEm = now;

            await updateDoc(pedidoRef, updateData);
            toast.success(`Pedido #${pedidoId.slice(-4)} atualizado!`);
        } catch (err) {
            toast.error("Erro ao atualizar o status do pedido.");
        }
    }, []);
    
    const toggleStoreOpen = useCallback(async () => {
        if (!profile?.uid) return;
        const newState = !storeSettings?.isOpen;
        try {
            await updateDoc(doc(db, 'users', profile.uid), { isOpen: newState });
            toast.success(newState ? "Loja Aberta!" : "Loja Fechada!");
        } catch (e) {
            toast.error("Erro ao alterar status da loja.");
        }
    }, [profile?.uid, storeSettings?.isOpen]);

    // --- MEMOIZED METRICS & WALLET ---

    const { metrics, wallet } = useMemo(() => {
        // Metrics Calculations
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ordersToday = completedOrders.filter(o => o.createdAt?.toDate() >= today);
        const faturamentoBrutoHoje = ordersToday.reduce((acc, p) => acc + (p.finalTotal || p.total || 0), 0);
        const faturamentoLiquidoHoje = ordersToday.reduce((acc, p) => acc + (p.netValue || 0), 0);
        const totalPedidos = ordersToday.length;
        const ticketMedio = totalPedidos > 0 ? faturamentoBrutoHoje / totalPedidos : 0;
        
        const temposPreparo = ordersToday
            .filter(o => o.preparandoEm && o.entregaEm)
            .map(o => (new Date(o.entregaEm).getTime() - new Date(o.preparandoEm).getTime()) / 60000);
        const tempoMedioPreparoMin = temposPreparo.length > 0 ? temposPreparo.reduce((a, b) => a + b, 0) / temposPreparo.length : 0;

        const labels: string[] = [];
        const data: number[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));
            const dayTotal = completedOrders.reduce((acc, o) => {
                if (o.createdAt?.toDate().toLocaleDateString('pt-BR') === d.toLocaleDateString('pt-BR')) {
                    return acc + (o.finalTotal || o.total || 0);
                }
                return acc;
            }, 0);
            data.push(dayTotal);
        }

        const productCounts: {[key: string]: number} = {};
        completedOrders.forEach(order => {
            order.itens?.forEach((item: any) => {
                productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
            });
        });
        const bestSellers = Object.entries(productCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const metricsData = {
            faturamentoBrutoHoje,
            faturamentoLiquidoHoje,
            totalPedidos,
            ticketMedio,
            tempoMedioPreparoMin,
            chartData: { labels, datasets: [{ label: 'Vendas', data, backgroundColor: '#FF8C00', borderRadius: 4 }] },
            bestSellers,
        };

        // Wallet Calculations
        const liberado = completedOrders.reduce((acc, p) => acc + (p.netValue || 0), 0);
        const retido = activeOrders.reduce((acc, p) => acc + (p.netValue || 0), 0);
        
        const walletData = {
            liberado,
            retido,
            history: completedOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 20), // Last 20 for history
        };

        return { metrics: metricsData, wallet: walletData };

    }, [activeOrders, completedOrders]);

    return {
        activeOrders,
        completedOrders,
        storeSettings,
        menuItems,
        metrics,
        wallet,
        // Actions
        updateStatus,
        toggleStoreOpen,
    };
};