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
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto w-full flex flex-col justify-between">
      <div className="w-full mx-auto flex-1 flex flex-col space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                AP2 Voice Commerce Assistant
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h1>
              <p className="text-xs text-slate-500">
                Natural Language Intent Parser with Gated Price Confirmation & AP2 Guardrails
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
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-semibold ${
                    isUser
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-indigo-600 shadow-xs'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-lg rounded-2xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Pending Gated Confirmation Card */}
                  {msg.isGate && pendingIntent && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Confirmation Gate (Autonomous Guardrail)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 font-medium">
                        <div><span className="text-slate-500">Item:</span> {pendingIntent.intent.itemKeywords}</div>
                        <div><span className="text-slate-500">Category:</span> {pendingIntent.intent.category}</div>
                        <div><span className="text-slate-500">Echoed Budget:</span> ₹{pendingIntent.intent.budget}</div>
                        <div><span className="text-slate-500">Brand:</span> {pendingIntent.intent.brandPreference || 'Any'}</div>
                      </div>

                      <button
                        onClick={handleConfirmIntent}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Parsed Intent & Find Merchant</span>
                      </button>
                    </div>
                  )}

                  {/* Match & Negotiation Result Card */}
                  {msg.isResult && msg.pipeline && (
                    <div className="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2 text-xs text-slate-800">
                      <div className="flex items-center justify-between text-indigo-700 font-bold">
                        <span className="flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-indigo-600" /> Match & Negotiated Contract</span>
                        <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">AP2 Verified</span>
                      </div>
                      <div><span className="text-slate-500">Product:</span> <span className="font-bold text-slate-900">{msg.pipeline.product?.title}</span></div>
                      <div><span className="text-slate-500">Original List Price:</span> ₹{msg.pipeline.originalPrice}</div>
                      <div><span className="text-slate-500">Agreed Price:</span> <span className="font-bold text-emerald-700">₹{msg.pipeline.finalPrice}</span></div>
                      <div><span className="text-slate-500">Contract ID:</span> <code className="text-indigo-700 bg-white px-1 py-0.5 rounded border border-indigo-100 font-bold">{msg.pipeline.contract?.contractId}</code></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-indigo-600 flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="text-xs text-slate-500 italic">
                Processing speech & evaluating AP2 policy gates...
              </div>
            </div>
          )}
        </div>

        {/* Controls & Voice Recording Section */}
        <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          {/* Live Transcript / Speech Indicator */}
          {isListening && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>Listening... {transcript || 'Speak now'}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={toggleListening}
              className={`p-3.5 rounded-xl transition shrink-0 shadow-xs ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
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
              className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none"
            />

            <button
              onClick={() => handleSendText()}
              disabled={loading || !transcript.trim()}
              className="p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
