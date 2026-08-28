import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  ShieldAlert
} from 'lucide-react';
import apiClient from '../../api/client';

export default function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState([20, 45, 80, 55, 30, 90, 60, 40]);
  const [walletBalance, setWalletBalance] = useState(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Hello! I am your AP2 Voice Commerce Agent powered by Groq Whisper & Llama 3.3. Speak using the microphone or type below (e.g., "Buy running shoes under 3000 rupees").',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(''); // 'transcribing' | 'parsing' | 'matching' | 'negotiating' | 'contracting' | 'paying'
  const [pendingIntent, setPendingIntent] = useState(null);
  const [editBudget, setEditBudget] = useState(0);
  const [pipelineResult, setPipelineResult] = useState(null);
  const [checkoutComplete, setCheckoutComplete] = useState(null);

  // Audio Recording Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Fetch live wallet balance
  useEffect(() => {
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;
      if (!userId) return;

      const res = await apiClient.get('/wallet/balance', { params: { userId } });
      if (res.data?.success && res.data.wallet) {
        setWalletBalance(res.data.wallet.balance);
      }
    } catch (err) {
      console.warn('Wallet balance fetch error:', err);
    }
  };

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading, pipelineStage]);

  // Text-to-Speech synthesis
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

  // Soundwave visualizer simulator
  useEffect(() => {
    let interval;
    if (isRecording || isSpeaking) {
      interval = setInterval(() => {
        setAudioLevel(
          Array.from({ length: 12 }, () => Math.floor(Math.random() * 85) + 15)
        );
      }, 80);
    } else {
      setAudioLevel([15, 25, 20, 30, 25, 20, 15, 25, 20, 30, 20, 15]);
    }
    return () => clearInterval(interval);
  }, [isRecording, isSpeaking]);

  // 1. START REAL AUDIO RECORDING (POST /api/voice/transcribe-audio)
  const startRecording = async () => {
    try {
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
      console.warn('Microphone access error:', err);
      alert('Could not access microphone. Please allow microphone access or type your prompt in the text box below.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Process recorded audio via POST /api/voice/transcribe-audio
  const handleAudioUpload = async (audioBlob) => {
    setLoading(true);
    setPipelineStage('transcribing');
    setPendingIntent(null);
    setPipelineResult(null);
    setCheckoutComplete(null);

    const formData = new FormData();
    formData.append('audio', audioBlob, `voice_prompt_${Date.now()}.webm`);

    const storedUser = localStorage.getItem('paygate_user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    const userId = user?._id || user?.id;
    if (userId) {
      formData.append('userId', userId);
    }

    try {
      const res = await apiClient.post('/voice/transcribe-audio', formData);

      if (res.data?.success) {
        const { rawTranscript, intent, confirmationGate } = res.data;

        // Add user transcribed message
        const userMsg = {
          id: Date.now(),
          sender: 'user',
          text: rawTranscript || 'Voice Audio Query',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);

        // Present Confirmation Gate (no forced default — use exactly what was parsed)
        setPendingIntent({ rawTranscript, intent, confirmationGate });
        setEditBudget(intent.budget || 0);

        const summaryText = confirmationGate?.confirmationSummary || 
          `Please confirm: Action '${(intent.action || 'BUY').toUpperCase()}' for item "${intent.itemKeywords}" in category '${intent.category}' at budget ₹${(intent.budget || 0).toLocaleString('en-IN')}.`;

        const finalSummaryText = intent.budget
          ? summaryText
          : `${summaryText}\n\n💰 You didn't mention a budget — please set one using the slider below before I can search merchants for you.`;

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: finalSummaryText,
            isGate: true,
            intent,
            confirmationGate,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        speakText(intent.budget
          ? `Parsed your request for ${intent.itemKeywords} with budget of ${intent.budget} rupees. Please confirm the autonomous guardrail.`
          : `Parsed your request for ${intent.itemKeywords}. You did not mention a budget. Please set one using the slider before I continue.`);
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Voice transcription failed. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `⚠️ Voice Audio Error: ${errorMsg}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText('Voice transcription failed. Please try again.');
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  // 2. PROCESS TEXT INPUT VIA POST /api/voice/parse-text
  const handleSendText = async (customPrompt) => {
    const input = customPrompt || transcript;
    if (!input.trim() || loading) return;

    if (isRecording) {
      stopRecording();
    }

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTranscript('');
    setLoading(true);
    setPipelineStage('parsing');
    setPendingIntent(null);
    setPipelineResult(null);
    setCheckoutComplete(null);

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/voice/parse-text', { text: input, userId });

      if (res.data?.success) {
        const { rawTranscript, intent, confirmationGate } = res.data;
        setPendingIntent({ rawTranscript, intent, confirmationGate });
        setEditBudget(intent.budget || 0);

        const summaryText = confirmationGate?.confirmationSummary || 
          `Please confirm: Action '${(intent.action || 'BUY').toUpperCase()}' for item "${intent.itemKeywords}" in category '${intent.category}' at budget ₹${(intent.budget || 0).toLocaleString('en-IN')}.`;

        const finalSummaryText = intent.budget
          ? summaryText
          : `${summaryText}\n\n💰 You didn't mention a budget — please set one using the slider below before I can search merchants for you.`;

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: finalSummaryText,
            isGate: true,
            intent,
            confirmationGate,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        speakText(intent.budget
          ? `Parsed request for ${intent.itemKeywords} with budget of ${intent.budget} rupees. Please confirm the autonomous guardrail.`
          : `Parsed request for ${intent.itemKeywords}. You did not mention a budget. Please set one using the slider before I continue.`);
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Unable to parse voice text.';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `⚠️ Voice Parsing Error: ${errorMsg}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText('Voice parsing failed. Please try again.');
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  // 3. STEP-BY-STEP AP2 COMMERCE EXECUTION (Intent -> Match -> Negotiate -> Contract -> Pay)
  const handleConfirmIntent = async () => {
    if (!pendingIntent) return;

    setLoading(true);
    setPipelineStage('matching');
    const { intent } = pendingIntent;
    // No silent default — use exactly the budget the user confirmed. 0 means no price cap given.
    const finalBudget = Number(editBudget) || 0;

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id || 'agent_buyer_user';

      // Stage A: Query internal merchant catalog via /api/discovery/search
      const discoveryRes = await apiClient.get('/discovery/search', {
        params: {
          q: intent.itemKeywords || intent.category,
          category: intent.category !== 'General' ? intent.category : undefined,
          ...(finalBudget > 0 ? { maxPrice: finalBudget } : {}),
          limit: 5,
        },
      });

      const productsFound = discoveryRes.data?.products || [];

      // Graceful failure demonstration: No fake fallback products
      if (productsFound.length === 0) {
        const budgetPhrase = finalBudget > 0 ? ` within your budget cap of ₹${finalBudget.toLocaleString('en-IN')}` : '';
        const noProductMsg = `No matching products found from onboarded merchants for "${intent.itemKeywords || intent.category}"${budgetPhrase}. Please try increasing your budget or querying different keywords.`;
        
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 2,
            sender: 'assistant',
            text: noProductMsg,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        speakText(`No matching products found from onboarded merchants within your budget.`);
        setPendingIntent(null);
        return;
      }

      const topProduct = productsFound[0];

      // Stage B: Submit real Purchase Intent via POST /api/agent/intent
      const intentRes = await apiClient.post('/agent/intent', {
        agentId: userId,
        category: topProduct.category || intent.category || 'General',
        keywords: intent.itemKeywords ? [intent.itemKeywords] : [topProduct.title],
        budgetCap: finalBudget,
        currency: topProduct.currency || 'INR',
        merchantPreferences: topProduct.merchant?.id ? [topProduct.merchant.id] : [],
      });

      const createdIntent = intentRes.data?.intent;
      const intentId = createdIntent?.id || createdIntent?._id;

      // Stage C: Call real AI Negotiation via POST /api/agent/negotiation
      setPipelineStage('negotiating');
      const originalPrice = topProduct.price || finalBudget;
      // Propose fair agent discount (10% counter-offer within policy threshold)
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
      const discountPercent = negotiationDoc?.discountPercent || Math.round(((originalPrice - negotiatedPrice) / originalPrice) * 100);

      // Stage D: Generate real RSA-PSS Signed Contract via POST /api/agent/contract
      setPipelineStage('contracting');
      const merchantId = topProduct.merchant?.id || topProduct.merchant?._id || negotiationDoc?.merchant;

      const contractRes = await apiClient.post('/agent/contract', {
        intentId,
        merchantId,
        items: [
          {
            productId: topProduct.id || topProduct._id,
            title: topProduct.title,
            quantity: 1,
            unitPrice: negotiatedPrice,
            subtotal: negotiatedPrice,
          },
        ],
        agreedAmount: negotiatedPrice,
        expiresInMinutes: 60,
      });

      const contractDoc = contractRes.data?.contract;
      if (!contractDoc) {
        throw new Error(contractRes.data?.error || 'Failed to generate signed contract from backend');
      }

      const resultData = {
        product: topProduct,
        originalPrice,
        finalPrice: negotiatedPrice,
        savings,
        discountPercent: Math.max(0, discountPercent),
        merchant: topProduct.merchant || { name: 'Verified AP2 Merchant' },
        contract: contractDoc,
        contractId: contractDoc.contractId || contractDoc._id,
        ecdsaSignature: contractDoc.digitalSignature || contractDoc.mandateHash,
        status: contractDoc.status || 'signed',
      };

      setPipelineResult(resultData);

      const reply = `Match found! "${topProduct.title}" offered by ${topProduct.merchant?.name || 'Merchant'}. Original Price: ₹${originalPrice}, Negotiated Price: ₹${negotiatedPrice} (Saved ₹${savings}). AP2 Contract #${resultData.contractId} signed via RSA-PSS. Ready to authorize payment settlement!`;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'assistant',
          text: reply,
          isResult: true,
          pipeline: resultData,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      speakText(`Match found! Negotiated ${topProduct.title} down to ${negotiatedPrice} rupees, saving ${savings} rupees. Ready to settle payment.`);
      setPendingIntent(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.error || err.message || 'Error during AP2 commerce execution';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'assistant',
          text: `⚠️ AP2 Execution Error: ${errorMsg}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText('Error occurred during product matching and contract generation.');
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  // 4. EXECUTE PAYMENT & WALLET SETTLEMENT (POST /api/agent/payment/execute)
  const handleExecuteCheckout = async (pipeline) => {
    setLoading(true);
    setPipelineStage('paying');

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      if (!userId) {
        throw new Error('User authentication required. Please log in to authorize payment.');
      }

      // Real call to POST /api/agent/payment/execute
      const payRes = await apiClient.post('/agent/payment/execute', {
        contractId: pipeline.contractId || pipeline.contract?.contractId || pipeline.contract?._id,
        customer: {
          name: user.name || 'Authorized Buyer',
          email: user.email || 'buyer@paygate.internal',
          phone: user.phone || '9999999999',
          id: userId,
        },
        userId,
      });

      if (!payRes.data?.success) {
        throw new Error(payRes.data?.error || 'Payment execution rejected by AP2 safety gates');
      }

      const paymentDetails = payRes.data.paymentDetails || {};
      const orderDoc = payRes.data.order || {};

      const orderReceipt = {
        orderId: paymentDetails.orderId || orderDoc.orderId || `ord_${Date.now().toString().slice(-8)}`,
        contractId: pipeline.contractId,
        amount: paymentDetails.amount || pipeline.finalPrice,
        product: pipeline.product.title,
        merchant: pipeline.merchant.name || 'Verified Merchant',
        settledAt: new Date().toISOString(),
        authMethod: 'AP2 Cart Mandate (RSA-PSS Signed & Verified)',
        gateStatus: payRes.data.message || 'Payment execution authorized. Wallet debited successfully.',
      };

      setCheckoutComplete(orderReceipt);

      // Refresh REAL wallet balance from /api/wallet/balance
      await fetchWalletBalance();

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          sender: 'assistant',
          text: `🎉 Order #${orderReceipt.orderId} created and settled successfully! Amount ₹${orderReceipt.amount} debited via AP2 Autonomous Mandate.`,
          isReceipt: true,
          receipt: orderReceipt,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      speakText(`Order confirmed! Payment of ${orderReceipt.amount} rupees settled successfully.`);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.error || err.message || 'Payment execution rejected by security gates';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          sender: 'assistant',
          text: `⚠️ Payment Gate Rejection: ${errorMsg}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText('Payment execution was rejected by safety guardrails.');
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
      
      {/* Top Header Card */}
      <div className="bg-[#0c2340] text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0284c7] via-[#3b82f6] to-[#6366f1] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-[#0c2340] rounded-[14px] flex items-center justify-center">
                <Bot className="w-6 h-6 text-[#38bdf8]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  AP2 Voice Commerce Assistant
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-blue-400" />
                  Groq Whisper + Llama 3.3
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Two-Stage Voice Pipeline with Gated Echo Confirmation & AP2 Autonomous Settlement
              </p>
            </div>
          </div>

          {/* Quick Header Badges & Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {walletBalance !== null && (
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Wallet: <strong className="text-white font-bold">₹{walletBalance.toLocaleString('en-IN')}</strong></span>
              </div>
            )}

            {/* TTS Audio Voice Toggle */}
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                ttsEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
              title={ttsEnabled ? 'AI Voice active' : 'AI Voice muted'}
            >
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{ttsEnabled ? 'Voice ON' : 'Muted'}</span>
            </button>
          </div>
        </div>

        {/* Live Audio Visualizer Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 h-5">
            {audioLevel.map((height, idx) => (
              <span
                key={idx}
                style={{ height: `${Math.max(5, height * 0.24)}px` }}
                className={`w-1 rounded-full transition-all duration-100 ${
                  isRecording
                    ? 'bg-rose-400 animate-pulse'
                    : isSpeaking
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-slate-700'
                }`}
              />
            ))}
            <span className="text-[11px] font-medium text-slate-400 ml-2">
              {isRecording
                ? `🎙️ Recording audio (${recordingDuration}s)... Click stop to transcribe with Whisper`
                : isSpeaking
                ? '🔊 Assistant speaking...'
                : 'Microphone ready (Whisper ASR ready)'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Confirmation Gate Enforced
          </div>
        </div>
      </div>

      {/* Main Chat Stream Box */}
      <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden min-h-[480px]">
        
        {/* Messages Feed */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[500px]"
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-xs font-semibold ${
                    isUser
                      ? 'bg-[#0c2340] text-white'
                      : msg.isError
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-xl space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#0c2340] text-white rounded-tr-none shadow-xs'
                        : msg.isError
                        ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-none'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Gated Action Confirmation Card */}
                    {msg.isGate && pendingIntent && (
                      <div className="mt-4 p-4 rounded-xl bg-white border border-amber-300 shadow-sm space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span>Confirmation Gate (Autonomous Guardrail)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                            Numerical Echo Check
                          </span>
                        </div>

                        {/* Intent details */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-amber-50/70 p-3 rounded-lg border border-amber-100">
                          <div><span className="text-slate-500 font-medium">Item:</span> <strong className="text-slate-900">{pendingIntent.intent.itemKeywords}</strong></div>
                          <div><span className="text-slate-500 font-medium">Category:</span> {pendingIntent.intent.category}</div>
                          <div><span className="text-slate-500 font-medium">Echoed Budget:</span> <strong className="text-indigo-700">{Number(editBudget) > 0 ? `₹${Number(editBudget).toLocaleString('en-IN')}` : 'Not mentioned'}</strong></div>
                          <div><span className="text-slate-500 font-medium">Brand:</span> {pendingIntent.intent.brandPreference || 'Any'}</div>
                        </div>

                        {/* Budget slider */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-xs text-slate-600 font-medium">
                            <span>Set Budget:</span>
                            <span className="font-bold text-indigo-700">
                              {Number(editBudget) > 0 ? `₹${Number(editBudget).toLocaleString('en-IN')}` : 'Not set'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="25000"
                            step="100"
                            value={editBudget}
                            onChange={(e) => setEditBudget(e.target.value)}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          {Number(editBudget) <= 0 && (
                            <p className="text-[11px] text-amber-700 font-semibold pt-1">
                              ⚠️ Please set a budget above to continue.
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleConfirmIntent}
                          disabled={loading || Number(editBudget) <= 0}
                          title={Number(editBudget) <= 0 ? 'Set a budget above to enable this' : undefined}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{loading ? 'Executing AP2 Pipeline...' : 'Confirm Parsed Intent & Find Merchant'}</span>
                        </button>
                      </div>
                    )}

                    {/* Negotiated Match Result Card */}
                    {msg.isResult && msg.pipeline && (
                      <div className="mt-4 p-4 rounded-xl bg-white border border-indigo-200 shadow-sm space-y-3 text-xs text-slate-800">
                        <div className="flex items-center justify-between text-indigo-700 font-bold border-b border-slate-100 pb-2">
                          <span className="flex items-center gap-1.5">
                            <TrendingDown className="w-4 h-4 text-indigo-600" /> Match & Negotiated Contract
                          </span>
                          <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                            AP2 Verified (Saved {msg.pipeline.discountPercent}%)
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-sm">{msg.pipeline.product?.title}</span>
                            <span className="font-black text-emerald-700 text-sm">₹{msg.pipeline.finalPrice}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>Merchant: {msg.pipeline.merchant?.name || 'Merchant'}</span>
                            <span className="line-through text-slate-400">₹{msg.pipeline.originalPrice}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 pt-1 flex justify-between font-mono">
                            <span>Contract: <code className="text-indigo-700 font-bold">{msg.pipeline.contractId}</code></span>
                          </div>
                        </div>

                        {/* Checkout Execution */}
                        {!checkoutComplete && (
                          <button
                            type="button"
                            onClick={() => handleExecuteCheckout(msg.pipeline)}
                            disabled={loading}
                            className="w-full bg-[#0c2340] hover:bg-[#071d37] active:scale-98 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <Wallet className="w-4 h-4 text-[#3395FF]" />
                            <span>{loading ? 'Settling AP2 Mandate...' : `Authorize & Settle via Wallet (₹${msg.pipeline.finalPrice})`}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Settled Receipt Card */}
                    {msg.isReceipt && msg.receipt && (
                      <div className="mt-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-slate-900 space-y-2 text-xs">
                        <div className="flex items-center gap-2 font-bold text-emerald-800">
                          <PackageCheck className="w-4 h-4 text-emerald-600" />
                          <span>Order Generated & Wallet Settled</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-medium text-slate-700 pt-1">
                          <div><span className="text-slate-500">Order ID:</span> <strong className="text-slate-900">{msg.receipt.orderId}</strong></div>
                          <div><span className="text-slate-500">Amount Paid:</span> <strong className="text-emerald-700 font-bold">₹{msg.receipt.amount}</strong></div>
                          <div><span className="text-slate-500">Merchant:</span> {msg.receipt.merchant}</div>
                          <div><span className="text-slate-500">Protocol:</span> AP2 / x402</div>
                        </div>
                        <div className="pt-2">
                          <Link
                            to="/orders"
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            <span>View in Order Tracking</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 px-1">{msg.timestamp}</span>
                </div>
              </div>
            );
          })}

          {/* Dynamic Pipeline Progress Indicator */}
          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
                {pipelineStage === 'transcribing' && <span>Transcribing audio with Groq Whisper ASR...</span>}
                {pipelineStage === 'parsing' && <span>Extracting structured commerce intent with Groq LLM & evaluating guardrails...</span>}
                {pipelineStage === 'matching' && <span>Searching merchant product catalog...</span>}
                {pipelineStage === 'negotiating' && <span>Autonomous agent negotiating price terms with merchant...</span>}
                {pipelineStage === 'contracting' && <span>Generating RSA-PSS signed AP2 Cart Mandate...</span>}
                {pipelineStage === 'paying' && <span>Verifying safety gates & debiting AP2 internal wallet ledger...</span>}
                {!pipelineStage && <span>Processing AP2 commerce flow...</span>}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Input & Voice Controls */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 space-y-3">
          
          {/* Live Recording Indicator */}
          {isRecording && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="font-semibold">
                  Recording microphone audio... <span className="font-normal text-rose-700">({recordingDuration}s)</span>
                </span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow-xs"
              >
                Stop & Transcribe (Whisper)
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real Audio Recording Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3.5 rounded-xl transition shrink-0 shadow-xs cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                  : 'bg-[#0c2340] hover:bg-[#071d37] text-white'
              }`}
              title={isRecording ? 'Stop and send audio to Whisper' : 'Hold or click to record voice (Groq Whisper)'}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#38bdf8]" />}
            </button>

            {/* Query Input */}
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Record voice with mic or type (e.g. 'buy running shoes under 3000')..."
              className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendText()}
              disabled={loading || !transcript.trim()}
              className="p-3.5 rounded-xl bg-[#0c2340] hover:bg-[#071d37] text-white transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs cursor-pointer"
            >
              <Send className="w-5 h-5 text-[#38bdf8]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
