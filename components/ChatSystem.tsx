import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from '../firebase';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
}

const ChatSystem = ({ orderId }: { orderId: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [msg, setMsg] = useState('');
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;
    const q = query(collection(db, 'pedidos', orderId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!msg.trim() || !profile?.id) return;
    try {
      await addDoc(collection(db, 'pedidos', orderId, 'messages'), {
        text: msg,
        senderId: profile.id,
        createdAt: serverTimestamp(),
      });
      setMsg('');
    } catch (error) {
      toast.error('Erro ao enviar mensagem.');
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-[#0F0F0F] rounded-3xl overflow-hidden border border-white/5">
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs font-bold uppercase tracking-widest">Chat do Pedido</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderId === profile.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              m.senderId === profile.id 
                ? 'bg-[#FF8C00] text-black font-bold rounded-tr-none' 
                : 'bg-[#1A1A1A] text-white rounded-tl-none border border-white/10'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-[#141414] flex gap-2">
        <input 
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 text-sm focus:border-[#FF8C00] outline-none"
        />
        <button onClick={handleSendMessage} className="w-10 h-10 bg-[#FF8C00] text-black rounded-full flex items-center justify-center active:scale-90 transition-transform">
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default ChatSystem;
