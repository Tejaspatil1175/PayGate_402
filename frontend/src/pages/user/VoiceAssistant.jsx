import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import apiClient from '../../api/client';

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Hello! I am your AP2 Voice Commerce Agent. Tell me what you would like to buy (e.g., "Buy running shoes under 3000 rupees")',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState(null);
  const [pipelineResult, setPipelineResult] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recognition.onerror = (err) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use text input below.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSendText = async (textToSend) => {
    const input = textToSend || transcript;
    if (!input.trim() || loading) return;

    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setTranscript('');
    setLoading(true);
    setPendingIntent(null);
    setPipelineResult(null);

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      // 1. Parse Voice Intent using Groq LLM
      const res = await apiClient.post('/voice/parse-text', { text: input, userId });

      if (res.data?.success) {
        const { intent, confirmationGate } = res.data;
        setPendingIntent({ intent, confirmationGate });

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: confirmationGate?.confirmationSummary || `Parsed intent: ${intent.itemKeywords} with budget ₹${intent.budget}. Please confirm to proceed.`,
            isGate: true,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `Error parsing voice intent: ${err.error || err.message || 'Server error'}. Please try again.`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmIntent = async () => {
    if (!pendingIntent) return;

    setLoading(true);
    const { intent } = pendingIntent;

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      // 2. Initiate Search & Match Pipeline
      const matchRes = await apiClient.post('/discovery/initiate-match', {
        query: intent.itemKeywords || intent.category,
        category: intent.category,
        maxPrice: intent.budget,
        userId,
      });

      if (matchRes.data?.success) {
        const data = matchRes.data;
        setPipelineResult(data);

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 2,
            sender: 'assistant',
            text: `Match found! "${data.product?.title}" offered by ${data.merchant?.businessName || 'Merchant'}. Original Price: ₹${data.originalPrice}, Negotiated Price: ₹${data.finalPrice}.`,
            isResult: true,
            pipeline: data,
          },
        ]);
        setPendingIntent(null);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'assistant',
          text: `Matching failed: ${err.error || err.message || 'No products found within budget cap'}.`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-between relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-10 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                AP2 Voice Commerce Assistant
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h1>
              <p className="text-xs text-slate-400">
                Groq Whisper + LLM Intent Parser with Gated Price Confirmation
              </p>
            </div>
          </div>
        </div>

        {/* Chat Timeline Area */}
        <div className="flex-1 overflow-y-auto space-y-4 max-h-[60vh] pr-2">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-indigo-400'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-lg rounded-2xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Pending Gated Confirmation Card */}
                  {msg.isGate && pendingIntent && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>Confirmation Gate (Step 53 Guardrail)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <div><span className="text-slate-500">Item:</span> {pendingIntent.intent.itemKeywords}</div>
                        <div><span className="text-slate-500">Category:</span> {pendingIntent.intent.category}</div>
                        <div><span className="text-slate-500">Echoed Budget:</span> ₹{pendingIntent.intent.budget}</div>
                        <div><span className="text-slate-500">Brand:</span> {pendingIntent.intent.brandPreference || 'Any'}</div>
                      </div>

                      <button
                        onClick={handleConfirmIntent}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Parsed Intent & Find Merchant</span>
                      </button>
                    </div>
                  )}

                  {/* Match & Negotiation Result Card */}
                  {msg.isResult && msg.pipeline && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-indigo-400 font-semibold">
                        <span className="flex items-center gap-1.5"><TrendingDown className="w-4 h-4" /> Match & Negotiated Contract</span>
                        <span className="text-emerald-400">AP2 Verified</span>
                      </div>
                      <div><span className="text-slate-400">Product:</span> {msg.pipeline.product?.title}</div>
                      <div><span className="text-slate-400">Original List Price:</span> ₹{msg.pipeline.originalPrice}</div>
                      <div><span className="text-slate-400">Agreed Price:</span> ₹{msg.pipeline.finalPrice}</div>
                      <div><span className="text-slate-400">Contract ID:</span> <code className="text-amber-400">{msg.pipeline.contract?.contractId}</code></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 flex items-center justify-center">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="text-xs text-slate-400 italic">
                Processing speech & evaluating AP2 policy gates...
              </div>
            </div>
          )}
        </div>

        {/* Controls & Voice Recording Section */}
        <div className="space-y-3 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 backdrop-blur-xl">
          {/* Live Transcript / Speech Indicator */}
          {isListening && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>Listening... {transcript || 'Speak now'}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={toggleListening}
              className={`p-3.5 rounded-xl transition flex-shrink-0 shadow-lg ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice capture'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Or type voice query (e.g. 'buy running shoes under 2000')..."
              className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none"
            />

            <button
              onClick={() => handleSendText()}
              disabled={loading || !transcript.trim()}
              className="p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
