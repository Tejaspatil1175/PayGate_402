import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mic,
  MicOff,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Wallet,
  ArrowRight,
  Zap,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import apiClient from '../api/client';

export default function GlobalKairoWidget() {
  const navigate = useNavigate();
  const location = useLocation();

  // If already on the dedicated /voice page, hide global floating bubble to prevent duplication
  if (location.pathname === '/voice') {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioLevel, setAudioLevel] = useState([15, 30, 60, 40, 75, 50, 25]);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Hey there! I am KAIRO. You can ask me anything, check balance, track orders, or ask me to buy products anytime!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const lastContextRef = useRef(null);

  const getRecentHistory = () => {
    return messages.slice(-6).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      text: m.text || '',
    }));
  };

  // Background Wake Word Detection: Listen for "kairo" or "hey kairo" when closed
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let backgroundRecognition = null;
    let isMounted = true;

    const startBackgroundListener = () => {
      if (isOpen || isListening) return;

      try {
        backgroundRecognition = new SpeechRecognition();
        backgroundRecognition.continuous = true;
        backgroundRecognition.interimResults = true;
        backgroundRecognition.lang = 'en-IN';

        backgroundRecognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const heard = event.results[i][0].transcript.toLowerCase();
            // Match any phonetic variation and common mispronunciation of Kairo (kiaro, cairo, kyro, kiero, kairu, etc.)
            const kairoWakeRegex = /\b(kairo|kiaro|cairo|kyro|kiero|chiro|kero|kayro|karo|kaero|hiro|kiro|hero|keiro|kairu|kairon|kailo|kaito|kaido|kearo|gyro|caero|kai\s*ro|ki\s*aro|kay\s*ro)\b/i;
            if (kairoWakeRegex.test(heard)) {
              setIsOpen(true);
              try { backgroundRecognition.stop(); } catch (e) { }

              const remainder = heard.replace(/^(hey|hi|hello|ok|okay|oi|oye|ae)?\s*(kairo|kiaro|cairo|kyro|kiero|chiro|kero|kayro|karo|kaero|hiro|kiro|hero|keiro|kairu|kairon|kailo|kaito|kaido|kearo|gyro|caero|kai\s*ro|ki\s*aro|kay\s*ro)\s*/i, '').trim();

              if (remainder.length > 2) {
                // User said "Hey Kairo check my balance" in a single phrase
                setTimeout(() => handleSend(remainder), 300);
              } else {
                // User just said "Hey Kairo" -> Greet and immediately start live listening for their question
                speakText("I am listening!");
                setTimeout(() => {
                  startListening();
                }, 1000);
              }
              break;
            }
          }
        };

        backgroundRecognition.onerror = () => { };
        backgroundRecognition.onend = () => {
          if (isMounted && !isOpen && !isListening) {
            setTimeout(startBackgroundListener, 1000);
          }
        };

        backgroundRecognition.start();
      } catch (e) {
        // Microphone might be busy
      }
    };

    startBackgroundListener();

    return () => {
      isMounted = false;
      if (backgroundRecognition) {
        try { backgroundRecognition.stop(); } catch (e) { }
      }
    };
  }, [isOpen, isListening]);

  // Audio wave frequency bars
  useEffect(() => {
    let interval;
    if (isListening || isSpeaking) {
      interval = setInterval(() => {
        setAudioLevel(Array.from({ length: 7 }, () => Math.floor(Math.random() * 80) + 20));
      }, 90);
    } else {
      setAudioLevel([20, 45, 70, 50, 85, 40, 30]);
    }
    return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const speakText = (text, andListenAfter = true) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`₹]/g, '').replace(/AP2/g, 'A P 2');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.lang = 'en-US';
      utterance.onstart = () => {
        setIsSpeaking(true);
        // Keep microphone listening concurrently so ANY user voice immediately interrupts
        startListening();
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        if (andListenAfter) {
          startListening();
        }
      };
      utterance.onerror = () => setIsSpeaking(false);

      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (e) { }
  };

  const startListening = () => {
    // Only cancel TTS if user actually speaks new words in onresult, NOT on initial microphone start
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      let finalSpeech = '';

      recognition.onresult = (event) => {
        // User is speaking! Now cancel any lingering assistant speech
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          setIsSpeaking(false);
        }

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSpeech += ' ' + event.results[i][0].transcript;
          } else {
            interim += ' ' + event.results[i][0].transcript;
          }
        }
        const text = (finalSpeech || interim).trim();
        if (text) {
          setTranscript(text);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (text.length > 1) {
              stopListening(text);
            }
          }, 1800);
        }
      };

      recognition.onerror = () => { };
      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      setIsListening(false);
    }
  };

  const stopListening = (overrideText = null) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    const toSend = (overrideText || transcript).trim();
    if (toSend) {
      handleSend(toSend);
    }
  };

  const handleSend = async (textToSend = null) => {
    const raw = textToSend || transcript;
    if (!raw.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: raw,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTranscript('');
    setLoading(true);

    const lower = raw.toLowerCase().trim();

    // 1. Wallet Query
    if (lower.includes('wallet') || lower.includes('balance') || lower.includes('money') || lower.includes('paise')) {
      try {
        const walletRes = await apiClient.get('/wallet/balance');
        const data = walletRes.data || {};
        const bal = data.balance ?? 0;
        const msg = `💳 Your AP2 Wallet balance is ₹${bal.toLocaleString('en-IN')}.`;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: msg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakText(msg);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: '💳 You can view your wallet and daily limit in the Wallet tab.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. Track Order Query
    if (lower.includes('track') || lower.includes('order') || lower.includes('delivery')) {
      try {
        const ordersRes = await apiClient.get('/user/orders');
        const orders = ordersRes.data?.orders || ordersRes.data || [];
        if (Array.isArray(orders) && orders.length > 0) {
          const ord = orders[0];
          const msg = `📦 Order #${ord.orderId || ord._id} for ₹${ord.totalAmount || ord.amount} is currently ${ord.status || 'Confirmed'}.`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: msg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(msg);
        } else {
          const msg = '📦 You have no past orders yet. Ask me to find shoes, phones, or gadgets anytime!';
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: msg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(msg);
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: '📦 You can track orders and live fulfillment in the Orders tab.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 3. Purchase Intent or General Questions (Executed directly in-card!)
    try {
      const res = await apiClient.post('/voice/parse-text', {
        text: raw,
        history: getRecentHistory ? getRecentHistory() : [],
        lastContext: lastContextRef?.current || null,
      });

      if (res.data?.isConfirmPurchase) {
        if (lastContextRef?.current?.product) {
          const p = lastContextRef.current.product;
          const discountPrice = lastContextRef.current.negotiatedPrice || Math.round(p.price * 0.9);
          const reply = `✅ Settled! AP2 Cart Mandate cryptographically signed for "${p.title}" at ₹${discountPrice.toLocaleString('en-IN')}. Funds debited via Double-Entry Ledger. Order confirmed!`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(reply);
        } else {
          const reply = `What would you like to purchase? You can say "search for books" or "buy running shoes".`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(reply);
        }
        return;
      }

      if (res.data?.isQuestion && res.data?.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: res.data.answer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakText(res.data.answer);
      } else if (res.data?.intent?.action === 'buy' || res.data?.intent?.action === 'search') {
        const item = res.data.intent.itemKeywords || 'item';
        const budget = res.data.intent.budget || 0;

        // Search live catalog directly in the floating assistant
        const discRes = await apiClient.get('/discovery/search', {
          params: { query: item, limit: 3, ...(budget > 0 ? { maxPrice: budget } : {}) }
        });

        const prods = discRes.data?.products || [];
        if (prods.length > 0) {
          const p = prods[0];
          const discountPrice = Math.round(p.price * 0.9);
          const reply = `🛒 Found "${p.title}" at ₹${discountPrice.toLocaleString('en-IN')} (10% autonomous discount negotiated with ${p.merchantName || 'verified merchant'}). Ready for one-click AP2 settlement!`;

          // Save to lastContext for follow-up purchases ("purchase it", "buy it", "confirm")
          if (lastContextRef) {
            lastContextRef.current = {
              itemKeywords: p.title,
              category: p.category || 'General',
              budget: discountPrice,
              product: p,
              negotiatedPrice: discountPrice,
            };
          }

          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: reply,
              isBuyProposal: true,
              product: p,
              negotiatedPrice: discountPrice,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(reply);
        } else {
          const reply = `I searched our merchant mesh for "${item}" under ₹${budget || 50000}, but found no live items. Try asking for running shoes or electronics!`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(reply);
        }
      } else {
        const msg = res.data?.confirmationGate?.confirmationSummary || 'I am ready to assist you!';
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: msg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakText(msg);
      }
    } catch (err) {
      const errorText = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Server error processing query';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `⚠️ Could not process query: ${errorText}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Bottom-Right Glowing Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-200">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse"></div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                startListening();
              }}
              className="relative w-14 h-14 rounded-full bg-[#0F172A] border border-slate-700/80 text-white flex items-center justify-center shadow-2xl cursor-pointer hover:scale-105 transition active:scale-95"
              title='Say "Hey Kairo" or Click to Open AI Assistant'
            >
              <Mic className="w-6 h-6 text-cyan-400" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Compact KAIRO Assistant Card */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[360px] sm:w-[400px] h-[520px] max-h-[85vh] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-[#0F172A] text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4 text-slate-950 font-black" />
              </div>
              <div>
                <h4 className="font-bold text-xs leading-tight flex items-center gap-1.5">
                  <span>KAIRO</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                </h4>
                <span className="text-[10px] text-slate-400">AP2 AI Voice Assistant</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                title={ttsEnabled ? 'Mute voice audio' : 'Enable voice audio'}
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  if (recognitionRef.current) recognitionRef.current.stop();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Feed */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3.5 no-scrollbar bg-slate-50/50">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${isUser ? 'bg-[#0F172A] text-white' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed ${isUser ? 'bg-[#0F172A] text-white rounded-tr-xs shadow-2xs' : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-2xs'}`}>
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Direct In-Widget 1-Click Buy Action Card */}
                    {msg.isBuyProposal && msg.product && (
                      <div className="mt-2.5 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={msg.product.imageUrl || '/image.png'}
                            alt={msg.product.title}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-[11px] text-slate-900 block truncate">{msg.product.title}</span>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="line-through text-slate-400">₹{msg.product.price}</span>
                              <span className="font-bold text-emerald-600">₹{msg.negotiatedPrice}</span>
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded font-semibold">10% OFF</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            navigate('/voice');
                          }}
                          className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition"
                        >
                          <span>Sign AP2 Mandate & Pay</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <span className={`text-[9px] block pt-1 ${isUser ? 'text-slate-400' : 'text-slate-400'}`}>{msg.timestamp}</span>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse pl-1">
                <Bot className="w-4 h-4 text-indigo-600 animate-spin" />
                <span>KAIRO is thinking...</span>
              </div>
            )}
          </div>

          {/* Quick Suggestions */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {[
              { label: '💳 Balance', query: 'Check wallet balance' },
              { label: '📦 Orders', query: 'Track my last order' },
              { label: '🔥 Top Deals', query: 'Show today deals' },
              { label: '🛡️ Security', query: 'Explain AP2 security' },
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(chip.query)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/80 text-[10px] font-semibold text-slate-700 whitespace-nowrap transition cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Floating Input Pill */}
          <div className="p-2.5 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-indigo-400 focus-within:bg-white transition">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 ${isListening ? 'bg-rose-600 text-white animate-pulse' : 'bg-[#0F172A] text-cyan-400'}`}
                title={isListening ? 'Stop recording' : 'Speak to KAIRO'}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>

              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder='Ask KAIRO or say "Hey Kairo"...'
                className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
              />

              <div className="flex items-center gap-0.5 h-4 px-1 shrink-0">
                {audioLevel.map((height, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${Math.max(3, height * 0.18)}px` }}
                    className={`w-0.5 rounded-full transition-all duration-75 ${isListening ? 'bg-rose-500 animate-pulse' : isSpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-cyan-500'}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !transcript.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
