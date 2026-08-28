import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  FileCheck,
  Wallet,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  ShoppingBag,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sliders,
  Play,
  Check,
  Clock,
  Radio,
  Cpu,
  Layers,
  ChevronRight,
  CreditCard,
  PackageCheck,
  ExternalLink,
  ShieldAlert,
  Star,
  Flame,
  Package,
} from 'lucide-react';
import apiClient from '../../api/client';
import { getOrCreateUserKeys } from '../../utils/keys';

function getProductImage(product) {
  if (!product) return 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400';
  
  // 1. If product has real uploaded image(s) from merchant
  const candidate = (Array.isArray(product.images) && product.images[0]) || product.image || product.imageUrl;
  if (candidate && typeof candidate === 'string' && candidate.trim().length > 5) {
    return candidate.trim();
  }

  // 2. Category/Title-aware default images
  const text = `${product.title || ''} ${product.category || ''} ${product.description || ''}`.toLowerCase();
  if (text.includes('headphone') || text.includes('earphone') || text.includes('earbud') || text.includes('audio') || text.includes('bluetooth') || text.includes('anc') || text.includes('sound')) {
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400';
  }
  if (text.includes('shoe') || text.includes('sneaker') || text.includes('footwear') || text.includes('boot') || text.includes('runner') || text.includes('nike') || text.includes('adidas')) {
    return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400';
  }
  if (text.includes('watch') || text.includes('smartwatch')) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';
  }
  if (text.includes('shirt') || text.includes('tshirt') || text.includes('hoodie') || text.includes('jacket') || text.includes('apparel') || text.includes('cloth') || text.includes('cotton')) {
    return 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400';
  }
  if (text.includes('phone') || text.includes('mobile') || text.includes('smartphone') || text.includes('iphone') || text.includes('samsung')) {
    return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400';
  }
  if (text.includes('laptop') || text.includes('macbook') || text.includes('computer')) {
    return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400';
  }
  if (text.includes('food') || text.includes('snack') || text.includes('grocery') || text.includes('coffee')) {
    return 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=400';
  }

  return 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400';
}

export default function VoiceAssistant() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState([20, 50, 85, 60, 35, 95, 70, 45, 80, 55, 30, 65]);
  const [walletBalance, setWalletBalance] = useState(null);

  const storedUser = localStorage.getItem('paygate_user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const userName = currentUser?.name ? currentUser.name.split(' ')[0] : 'there';

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      isWelcome: true,
      text: `Hello, ${userName}! I am your Voice Commerce Agent. I can help you find products, track orders, and manage your account.\n\nHere are some things you can try:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(''); 
  const [pendingIntent, setPendingIntent] = useState(null);
  const [editBudget, setEditBudget] = useState(0);
  const [pipelineResult, setPipelineResult] = useState(null);
  const [checkoutComplete, setCheckoutComplete] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const stored = localStorage.getItem('paygate_user');
      const u = stored ? JSON.parse(stored) : null;
      const userId = u?._id || u?.id;
      if (!userId) return;

      const res = await apiClient.get('/wallet/balance', { params: { userId } });
      if (res.data?.success && res.data.wallet) {
        setWalletBalance(res.data.wallet.balance);
      }
    } catch (err) {
      console.warn('Wallet balance fetch error:', err);
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading, pipelineStage]);

  const speakText = (text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const cleanSpeech = text.replace(/[*_#`₹]/g, '').replace(/AP2/g, 'A P 2');
      const utterance = new SpeechSynthesisUtterance(cleanSpeech);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  useEffect(() => {
    let interval;
    if (isRecording || isSpeaking) {
      interval = setInterval(() => {
        setAudioLevel(
          Array.from({ length: 12 }, () => Math.floor(Math.random() * 85) + 15)
        );
      }, 80);
    } else {
      setAudioLevel([20, 50, 85, 60, 35, 95, 70, 45, 80, 55, 30, 65]);
    }
    return () => clearInterval(interval);
  }, [isRecording, isSpeaking]);

  const recognitionRef = useRef(null);

  const startRecording = async () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        let finalSpeechText = '';

        recognition.onresult = (event) => {
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalSpeechText += event.results[i][0].transcript;
            } else {
              interimText += event.results[i][0].transcript;
            }
          }
          const currentText = finalSpeechText || interimText;
          if (currentText) {
            setTranscript(currentText);
          }
        };

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e);
        };

        recognition.onend = () => {
          setIsRecording(false);
          clearInterval(recordingTimerRef.current);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
        setRecordingDuration(0);

        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
        return;
      }

      // Fallback: MediaRecorder Audio Blob
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(recordingTimerRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please ensure microphone permissions are granted.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
      if (transcript.trim()) {
        handleSendText(transcript.trim());
      }
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob) => {
    setLoading(true);
    setPipelineStage('transcribing');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await apiClient.post('/voice/transcribe-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        const { rawTranscript, intent, confirmationGate } = res.data;

        const userMsg = {
          id: Date.now(),
          sender: 'user',
          text: rawTranscript || '🎙️ [Voice Command Transcribed]',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);

        setPendingIntent({ rawTranscript, intent, confirmationGate });
        setEditBudget(intent.budget || 0);

        const summaryText = confirmationGate?.confirmationSummary || 
          `Please confirm: Action '${(intent.action || 'BUY').toUpperCase()}' for item "${intent.itemKeywords}" in category '${intent.category}' at budget ₹${(intent.budget || 0).toLocaleString('en-IN')}.`;

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: summaryText,
            isGate: true,
            intent,
            confirmationGate,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Voice transcription failed.';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `⚠️ Voice pipeline error: ${errorMsg}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  const handleSendText = async (customText = null) => {
    const textToSend = customText || transcript;
    if (!textToSend.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setTranscript('');
    setLoading(true);
    setPipelineStage('parsing');

    if (textToSend.toLowerCase().includes('wallet') || textToSend.toLowerCase().includes('balance')) {
      await fetchWalletBalance();
      const bal = walletBalance !== null ? `₹${walletBalance.toLocaleString('en-IN')}` : 'available in your account';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `💳 Your current AP2 Wallet Balance is ${bal}. You can top up or manage spending limits in the Wallet tab.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText(`Your current wallet balance is ${bal}`);
      setLoading(false);
      setPipelineStage('');
      return;
    }

    if (textToSend.toLowerCase().includes('track') || textToSend.toLowerCase().includes('order')) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `📦 Opening your Order Tracking dashboard to inspect live fulfillment timelines and AP2 delivery receipts.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText(`Opening your orders tracking`);
      setTimeout(() => navigate('/orders'), 1200);
      setLoading(false);
      setPipelineStage('');
      return;
    }

    try {
      const res = await apiClient.post('/voice/parse-text', { text: textToSend });
      if (res.data?.success) {
        const { rawTranscript, intent, confirmationGate } = res.data;
        setPendingIntent({ rawTranscript, intent, confirmationGate });
        setEditBudget(intent.budget || 0);

        const summaryText = confirmationGate?.confirmationSummary || 
          `Please confirm: Action '${(intent.action || 'BUY').toUpperCase()}' for item "${intent.itemKeywords}" at budget ₹${(intent.budget || 0).toLocaleString('en-IN')}.`;

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: summaryText,
            isGate: true,
            intent,
            confirmationGate,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Unable to parse text.';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `⚠️ Voice parser error: ${errorMsg}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  const handleConfirmIntent = async () => {
    if (!pendingIntent) return;

    setLoading(true);
    setPipelineStage('matching');
    const { intent } = pendingIntent;
    const finalBudget = Number(editBudget) || 0;

    try {
      const stored = localStorage.getItem('paygate_user');
      const u = stored ? JSON.parse(stored) : null;
      const userId = u?._id || u?.id || 'agent_buyer_user';

      const discoveryRes = await apiClient.get('/discovery/search', {
        params: {
          q: intent.itemKeywords || intent.category,
          category: intent.category !== 'General' ? intent.category : undefined,
          ...(finalBudget > 0 ? { maxPrice: finalBudget } : {}),
          limit: 5,
        },
      });

      const productsFound = discoveryRes.data?.products || [];
      if (productsFound.length === 0) {
        throw new Error('No matching products found.');
      }

      const topProduct = productsFound[0];

      const intentRes = await apiClient.post('/agent/intent', {
        agentId: userId,
        category: topProduct.category || intent.category || 'General',
        keywords: intent.itemKeywords ? [intent.itemKeywords] : [topProduct.title],
        budgetCap: finalBudget > 0 ? finalBudget : (topProduct.price || 50000),
        currency: topProduct.currency || 'INR',
        merchantPreferences: topProduct.merchant?.id ? [topProduct.merchant.id] : [],
      });

      const createdIntent = intentRes.data?.intent;
      const intentId = createdIntent?.id || createdIntent?._id;

      setPipelineStage('negotiating');
      const originalPrice = topProduct.price || (finalBudget > 0 ? finalBudget : 3000);
      const proposedPrice = Math.max(1, Math.round(originalPrice * 0.9));

      const negotiationRes = await apiClient.post('/agent/negotiation', {
        intentId,
        productId: topProduct.id || topProduct._id,
        proposedPrice,
        quantity: 1,
        agentId: userId,
      });

      const negotiationDoc = negotiationRes.data?.negotiation;
      const negotiatedPrice = negotiationDoc?.agreedPrice || proposedPrice;
      const savings = Math.max(0, originalPrice - negotiatedPrice);

      setPipelineStage('contracting');
      const merchantId = topProduct.merchant?.id || topProduct.merchant?._id || negotiationDoc?.merchant;
      const userKeys = await getOrCreateUserKeys(userId);

      const contractRes = await apiClient.post('/agent/contract', {
        intentId,
        merchantId,
        items: [{ product: topProduct._id || topProduct.id, productId: topProduct._id || topProduct.id, title: topProduct.title, quantity: 1, unitPrice: negotiatedPrice, totalPrice: negotiatedPrice, subtotal: negotiatedPrice }],
        agreedAmount: negotiatedPrice,
        userPrivateKey: userKeys.privateKey,
        userPublicKey: userKeys.publicKey,
        expiresInMinutes: 60,
      });

      const contractDoc = contractRes.data?.contract;
      if (!contractDoc) {
        throw new Error(contractRes.data?.error || 'Failed to generate signed contract from backend');
      }

      const resultData = {
        product: topProduct,
        allProducts: productsFound,
        originalPrice,
        finalPrice: negotiatedPrice,
        savings,
        discountPercent: Math.round(((originalPrice - negotiatedPrice) / originalPrice) * 100),
        merchant: topProduct.merchant || { name: 'Verified AP2 Merchant' },
        contractId: contractDoc.contractId || contractDoc._id,
        status: contractDoc.status || 'signed',
      };

      setPipelineResult(resultData);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'assistant',
          text: `I found matching products from onboarded merchants. Here is the negotiated offer for "${topProduct.title}" signed via AP2 RSA-PSS Mandate:`,
          isResult: true,
          pipeline: resultData,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setPendingIntent(null);
    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now() + 2, sender: 'assistant', text: `⚠️ Error: ${err.message}`, isError: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  const handleExecuteCheckout = async (pipeline) => {
    setLoading(true);
    setPipelineStage('paying');

    try {
      const stored = localStorage.getItem('paygate_user');
      const u = stored ? JSON.parse(stored) : null;
      const userId = u?._id || u?.id;

      if (!userId) throw new Error('User authentication required.');

      const payRes = await apiClient.post('/agent/payment/execute', {
        contractId: pipeline.contractId,
        customer: { name: u.name || 'Authorized Buyer', email: u.email || 'buyer@paygate.internal', phone: u.phone || '9999999999', id: userId },
        userId,
      });

      if (!payRes.data?.success) throw new Error(payRes.data?.error || 'Payment execution rejected.');

      const orderReceipt = {
        orderId: payRes.data.paymentDetails?.orderId || `ord_${Date.now().toString().slice(-8)}`,
        amount: pipeline.finalPrice,
        product: pipeline.product.title,
        merchant: pipeline.merchant.name || 'Verified Merchant',
        settledAt: new Date().toISOString(),
      };

      setCheckoutComplete(orderReceipt);
      await fetchWalletBalance();

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          sender: 'assistant',
          text: `🎉 Order #${orderReceipt.orderId} settled successfully! Amount ₹${orderReceipt.amount} debited via AP2 Autonomous Mandate.`,
          isReceipt: true,
          receipt: orderReceipt,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now() + 3, sender: 'assistant', text: `⚠️ Payment Error: ${err.message}`, isError: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col relative overflow-hidden bg-transparent">
      
      {/* Scrollable Messages Stream */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto no-scrollbar px-4 sm:px-6 pt-4 pb-32 space-y-6 scroll-smooth w-full"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex items-start gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${isUser ? 'bg-[#0F172A] text-white' : 'bg-[#EEF2FF] text-[#6366F1] border border-indigo-100/80'}`}>
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`max-w-2xl space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-3xl p-5 text-sm leading-relaxed transition shadow-2xs ${isUser ? 'bg-[#0F172A] text-white rounded-tr-sm' : msg.isError ? 'bg-rose-50/90 border border-rose-200 text-rose-900 rounded-tl-sm' : 'bg-[#F0F5FF] border border-[#DCE7FC] text-slate-800 rounded-tl-sm'}`}>
                  <p className={`whitespace-pre-line font-normal leading-relaxed ${isUser ? 'text-white' : 'text-slate-800'}`}>
                    {msg.text}
                  </p>
                  {msg.isWelcome && (
                    <div className="flex flex-wrap gap-2 pt-4">
                      {[
                        { label: 'Running shoes under ₹3000', icon: '👟', query: 'Buy running shoes under 3000 rupees' },
                        { label: 'Track my last order', icon: '📦', query: 'Track my last order' },
                        { label: 'Check wallet balance', icon: '💳', query: 'Check wallet balance' },
                        { label: "Today's top deals", icon: '🔥', query: 'Show me best deals on shoes and fashion' },
                      ].map((item, idx) => (
                        <button key={idx} type="button" onClick={() => handleSendText(item.query)} disabled={loading} className="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-indigo-300 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-2xl transition shadow-2xs flex items-center gap-1.5 cursor-pointer hover:scale-102 active:scale-98">
                          <span>{item.icon}</span> <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.isGate && pendingIntent && (
                    <div className="mt-4 p-4 rounded-2xl bg-white border border-amber-300 shadow-sm space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900"><AlertCircle className="w-4 h-4 text-amber-600" /> <span>Confirmation Gate (Autonomous Guardrail)</span></div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">Numerical Echo Check</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-amber-50/70 p-3 rounded-xl border border-amber-100">
                        <div><span className="text-slate-500 font-medium">Item:</span> <strong className="text-slate-900">{pendingIntent.intent.itemKeywords}</strong></div>
                        <div><span className="text-slate-500 font-medium">Category:</span> {pendingIntent.intent.category}</div>
                        <div><span className="text-slate-500 font-medium">Echoed Budget:</span> <strong className="text-indigo-700">{Number(editBudget) > 0 ? `₹${Number(editBudget).toLocaleString('en-IN')}` : 'Not set'}</strong></div>
                        <div><span className="text-slate-500 font-medium">Brand:</span> {pendingIntent.intent.brandPreference || 'Any'}</div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs text-slate-600 font-medium"><span>Set Budget:</span> <span className="font-bold text-indigo-700">{Number(editBudget) > 0 ? `₹${Number(editBudget).toLocaleString('en-IN')}` : 'Not set'}</span></div>
                        <input type="range" min="0" max="25000" step="100" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        {Number(editBudget) <= 0 && <p className="text-[11px] text-amber-700 font-semibold pt-1">⚠️ Please set a budget slider above to continue.</p>}
                      </div>
                      <button type="button" onClick={handleConfirmIntent} disabled={loading || Number(editBudget) <= 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" /> <span>{loading ? 'Executing AP2 Pipeline...' : 'Confirm Parsed Intent & Find Merchant'}</span>
                      </button>
                    </div>
                  )}
                  {msg.isResult && msg.pipeline && (
                    <div className="mt-4 space-y-3">
                      <div className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 shadow-xs flex items-center gap-4 transition group">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                          <img
                            src={getProductImage(msg.pipeline.product)}
                            alt={msg.pipeline.product?.title || 'Product'}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-600 transition">{msg.pipeline.product?.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-1">{msg.pipeline.product?.description || `${msg.pipeline.product?.title}, verified AP2 merchant product`}</p>
                          <div className="flex items-baseline gap-2 pt-0.5">
                            <span className="font-black text-slate-900 text-sm sm:text-base">₹{msg.pipeline.finalPrice?.toLocaleString('en-IN')}</span>
                            {msg.pipeline.originalPrice > msg.pipeline.finalPrice && <span className="text-[11px] text-slate-400 line-through">Price: ₹{msg.pipeline.originalPrice?.toLocaleString('en-IN')}</span>}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-amber-500 font-bold">
                            <span>⭐⭐⭐⭐⭐</span>
                            <span className="text-slate-400 font-normal text-[10px]">(3)</span>
                          </div>
                        </div>
                        {!checkoutComplete && (
                          <button type="button" onClick={() => handleExecuteCheckout(msg.pipeline)} disabled={loading} className="px-3.5 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs shrink-0 cursor-pointer disabled:opacity-50">
                            <Zap className="w-3.5 h-3.5 text-cyan-400" /> <span>{loading ? 'Settling...' : 'Buy via Agent'}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 bg-white/80 border border-slate-200/80 rounded-xl px-3 py-1.5 font-mono">
                        <span>Mandate: <strong className="text-indigo-700">{msg.pipeline.contractId}</strong></span>
                        <span className="text-emerald-700 font-bold">RSA-PSS Signed</span>
                      </div>
                    </div>
                  )}
                  {msg.isReceipt && msg.receipt && (
                    <div className="mt-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-slate-900 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-800"><PackageCheck className="w-4 h-4 text-emerald-600" /> <span>Order Generated & Wallet Settled</span></div>
                      <div className="grid grid-cols-2 gap-2 font-medium text-slate-700 pt-1">
                        <div><span className="text-slate-500">Order ID:</span> <strong className="text-slate-900">{msg.receipt.orderId}</strong></div>
                        <div><span className="text-slate-500">Paid:</span> <strong className="text-emerald-700">₹{msg.receipt.amount}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 px-1 block">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs"><Bot className="w-5 h-5 animate-spin" /></div>
            <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
              {pipelineStage === 'transcribing' && <span>Transcribing voice with Groq Whisper...</span>}
              {pipelineStage === 'parsing' && <span>Parsing commerce intent & evaluating guardrails...</span>}
              {pipelineStage === 'matching' && <span>Searching merchant catalog for products...</span>}
              {pipelineStage === 'negotiating' && <span>Autonomous agent negotiating price terms...</span>}
              {pipelineStage === 'contracting' && <span>Generating RSA-PSS signed AP2 Cart Mandate...</span>}
              {pipelineStage === 'paying' && <span>Verifying safety gates & debiting internal wallet...</span>}
              {!pipelineStage && <span>Processing AP2 commerce flow...</span>}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Fixed Input Bar with Subtle Light Black Shadow */}
      <div className="absolute bottom-3 left-0 right-0 px-3 sm:px-6 z-30 pointer-events-none">
        <div className="max-w-4xl mx-auto w-full pointer-events-auto">
          {isRecording && (
            <div className="mb-2.5 flex items-center justify-between p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs animate-in fade-in duration-150 shadow-[0_4px_16px_rgba(244,63,94,0.12)]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span></span>
                <span className="font-semibold">Recording microphone audio... <span className="font-normal text-rose-700">({recordingDuration}s)</span></span>
              </div>
              <button type="button" onClick={stopRecording} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow-xs">Stop & Transcribe</button>
            </div>
          )}
          <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_6px_24px_-2px_rgba(0,0,0,0.12)]">
            {/* Glowing Mic Button (Left) */}
            <div className="relative group shrink-0">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative p-3 rounded-2xl transition-all duration-300 shadow-sm cursor-pointer flex items-center justify-center shrink-0 ${
                  isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-[#0B101B] text-sky-400 hover:text-sky-300'
                }`}
                title={isRecording ? 'Stop and send audio' : 'Click to speak'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#818CF8]" />}
              </button>
            </div>

            {/* Input Field with Waveform Graphic on Right */}
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5">
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Record or type your request (e.g., 'buy running shoes under 3000')..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none"
              />
              <div className="flex items-center gap-0.5 h-6 px-1 shrink-0">
                {audioLevel.map((height, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${Math.max(4, height * 0.26)}px` }}
                    className={`w-0.5 rounded-full transition-all duration-75 ${
                      isRecording ? 'bg-rose-500 animate-pulse' : isSpeaking ? 'bg-indigo-500 animate-pulse' : idx % 3 === 0 ? 'bg-sky-400' : idx % 3 === 1 ? 'bg-indigo-500' : 'bg-purple-500'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Send Controls */}
            <button
              type="button"
              onClick={() => handleSendText()}
              disabled={loading || !transcript.trim()}
              className="p-2.5 rounded-xl bg-[#091322] hover:bg-[#0f1d33] text-sky-400 hover:text-sky-300 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs cursor-pointer"
              title="Send Command"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSendText()}
              disabled={loading || !transcript.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs cursor-pointer hidden sm:block"
            >
              Send
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
