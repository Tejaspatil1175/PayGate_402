import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Send,
  Wallet,
  ShieldCheck,
  ChevronRight,
  TrendingDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function UserDashboard() {
  const navigate = useNavigate();

  // 1. Voice Assistant States
  const [isListening, setIsListening] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [transcript, setTranscript] = useState("Okay, I'm finding me a desk lamp under ₹2000.");
  const [parsedIntent, setParsedIntent] = useState({
    title: 'PURCHASE DESK LAMP.',
    budget: '₹2,000 MAX.',
    schedule: 'ASAP.',
    category: 'Home',
    rawText: 'Buy a desk lamp under 2000 rupees',
  });
  const [activeAgent, setActiveAgent] = useState('Shopper (Activated)');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const recognitionRef = useRef(null);

  // 2. Wallet Overview States
  const [walletBalance, setWalletBalance] = useState(15450);
  const [showDashboardBalance, setShowDashboardBalance] = useState(false);
  const [perTxCap, setPerTxCap] = useState(5000);
  const [perDayCap, setPerDayCap] = useState(10000);
  const [walletLoading, setWalletLoading] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('2000');

  // 3. Spending Analytics States
  const [analyticsData, setAnalyticsData] = useState({
    tech: 60,
    home: 20,
    other: 20,
    totalSpent: 8450,
  });

  // 4. Order Pipeline States
  const [activeOrder, setActiveOrder] = useState({
    orderId: '#PG1005 (Desk Lamp)',
    rawId: 'ord_pg1005',
    steps: [
      { id: 'matched', label: '[Matched]', completed: true },
      { id: 'negotiated', label: 'Negotiated:', badge: '₹1800 ✓', completed: true, note: 'Agent saved ₹200 from initial price' },
      { id: 'signed', label: 'Contract Signed:', badge: '0xAB...CDF ✓', completed: true, note: 'AP2 Mandate ECDSA verified' },
      { id: 'paid', label: 'Paid:', badge: '₹1800 wallet debit ✓', completed: true, note: 'Razorpay MCP settlement executed' },
      { id: 'shipped', label: '[Shipped]', completed: false },
    ],
  });

  // 5. Scheduled Tasks States
  const [scheduledTasks, setScheduledTasks] = useState([
    {
      id: '1',
      title: 'Buy coffee',
      time: 'March 15, 10 AM',
      status: 'Pending',
      budget: '₹450',
    },
    {
      id: '2',
      title: 'Restock Running Shoes',
      time: 'Every Friday',
      status: 'Active',
      budget: '₹2,500',
    },
  ]);

  // Load user info and real API data
  useEffect(() => {
    const storedUser = localStorage.getItem('paygate_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        fetchDashboardData(u._id || u.id);
      } catch (err) {
        console.error('Error parsing stored user:', err);
      }
    } else {
      fetchDashboardData(null);
    }

    // Initialize speech recognition
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
        setVoiceInput(currentText);
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const fetchDashboardData = async (userId) => {
    try {
      // 1. Fetch Wallet Balance
      const balRes = await apiClient.get('/wallet/balance', { params: { userId } }).catch(() => null);
      if (balRes?.data?.success && balRes.data.wallet) {
        setWalletBalance(balRes.data.wallet.balance || 15450);
        if (balRes.data.wallet.perTransactionCap) setPerTxCap(balRes.data.wallet.perTransactionCap);
        if (balRes.data.wallet.perDayCap) setPerDayCap(balRes.data.wallet.perDayCap);
      }

      // 2. Fetch User Analytics
      const analyticsRes = await apiClient.get('/user-analytics', { params: { userId } }).catch(() => null);
      if (analyticsRes?.data?.success && analyticsRes.data.analytics) {
        const catMap = analyticsRes.data.analytics.categoryBreakdown || {};
        const total = Object.values(catMap).reduce((acc, v) => acc + (v.amount || v || 0), 0);
        if (total > 0) {
          const techVal = ((catMap.Electronics || catMap.Tech || 0) / total) * 100;
          const homeVal = ((catMap.Home || 0) / total) * 100;
          const otherVal = Math.max(0, 100 - (techVal + homeVal));
          setAnalyticsData({
            tech: Math.round(techVal) || 60,
            home: Math.round(homeVal) || 20,
            other: Math.round(otherVal) || 20,
            totalSpent: total,
          });
        }
      }

      // 3. Fetch Scheduled Tasks
      const tasksRes = await apiClient.get('/scheduled-tasks', { params: { userId } }).catch(() => null);
      if (tasksRes?.data?.success && Array.isArray(tasksRes.data.tasks) && tasksRes.data.tasks.length > 0) {
        const formatted = tasksRes.data.tasks.map((t) => ({
          id: t._id || t.id,
          title: t.taskName || t.itemKeywords || 'Agent Purchase',
          time: t.scheduleTime ? new Date(t.scheduleTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }) : 'Scheduled',
          status: t.isActive ? 'Active' : 'Pending',
          budget: `₹${t.budgetCap || 2000}`,
        }));
        setScheduledTasks(formatted);
      }

      // 4. Fetch Recent Orders for pipeline
      const ordersRes = await apiClient.get('/user-orders', { params: { userId } }).catch(() => null);
      if (ordersRes?.data?.success && Array.isArray(ordersRes.data.orders) && ordersRes.data.orders.length > 0) {
        const latest = ordersRes.data.orders[0];
        setActiveOrder({
          orderId: `#${(latest._id || latest.orderId || 'PG1005').slice(-6).toUpperCase()} (${latest.items?.[0]?.product?.title || 'Desk Lamp'})`,
          rawId: latest._id || latest.orderId,
          steps: [
            { id: 'matched', label: '[Matched]', completed: true },
            { id: 'negotiated', label: 'Negotiated:', badge: `₹${latest.totalAmount || 1800} ✓`, completed: true, note: 'Agent negotiated dynamic discount' },
            { id: 'signed', label: 'Contract Signed:', badge: `${(latest.paymentId || '0xAB...CDF').slice(0, 8)} ✓`, completed: true, note: 'AP2 Cryptographic Mandate verified' },
            { id: 'paid', label: 'Paid:', badge: `₹${latest.totalAmount || 1800} wallet debit ✓`, completed: true, note: 'Settled via Razorpay MCP' },
            { id: 'shipped', label: '[Shipped]', completed: latest.status === 'SHIPPED' || latest.status === 'DELIVERED' },
          ],
        });
      }
    } catch (err) {
      console.warn('Dashboard background fetch error:', err);
    }
  };

  // Voice Mic Toggle
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type in the input field.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setVoiceInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Submit Text / Voice Prompt to Assistant
  const handleAssistantSubmit = async (e) => {
    e?.preventDefault();
    const prompt = voiceInput.trim();
    if (!prompt) return;

    setAssistantLoading(true);
    setTranscript(`Okay, I'm finding "${prompt}"...`);

    try {
      const res = await apiClient.post('/agent/parse-intent', { text: prompt });
      if (res.data?.success && res.data.intent) {
        const intent = res.data.intent;
        setParsedIntent({
          title: `PURCHASE ${intent.itemKeywords || prompt.toUpperCase()}.`,
          budget: `₹${(intent.budgetCap || 2000).toLocaleString('en-IN')} MAX.`,
          schedule: intent.scheduleTime ? 'SCHEDULED' : 'ASAP.',
          category: intent.category || 'General',
          rawText: prompt,
        });
        setTranscript(`Found parsed parameters for "${prompt}". Review below to confirm.`);
      } else {
        const priceMatch = prompt.match(/\d+/);
        const budget = priceMatch ? Number(priceMatch[0]) : 2000;
        setParsedIntent({
          title: `PURCHASE ${prompt.replace(/under|buy|for|\d+|rupees|rs/gi, '').trim().toUpperCase() || 'ITEM'}.`,
          budget: `₹${budget.toLocaleString('en-IN')} MAX.`,
          schedule: 'ASAP.',
          category: 'General',
          rawText: prompt,
        });
        setTranscript(`Okay, I'm processing "${prompt}". Confirm below.`);
      }
    } catch (err) {
      setParsedIntent({
        title: `PURCHASE ${prompt.toUpperCase()}.`,
        budget: '₹2,000 MAX.',
        schedule: 'ASAP.',
        category: 'General',
        rawText: prompt,
      });
      setTranscript(`Parsed your request: "${prompt}". Ready to execute.`);
    } finally {
      setAssistantLoading(false);
      setVoiceInput('');
    }
  };

  // Confirm and Execute Agent Pipeline
  const handleConfirmIntent = () => {
    navigate('/agent/matches', {
      state: {
        intent: {
          itemKeywords: parsedIntent.rawText,
          budgetCap: parseInt(parsedIntent.budget.replace(/\D/g, ''), 10) || 2000,
          category: parsedIntent.category,
        },
      },
    });
  };

  // Re-edit Intent
  const handleReEditIntent = () => {
    setVoiceInput(parsedIntent.rawText || '');
    setTranscript('Please re-state or type your adjusted search criteria.');
  };

  // Top Up Wallet
  const handleTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) return;

    setWalletLoading(true);
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const u = storedUser ? JSON.parse(storedUser) : null;
      const userId = u?._id || u?.id;

      const res = await apiClient.post('/wallet/top-up', {
        userId,
        amount,
        paymentMethod: 'Razorpay Mock Rails',
      });

      if (res.data?.success) {
        setWalletBalance((prev) => prev + amount);
        setShowTopUpModal(false);
        alert(`₹${amount} successfully topped up to your AP2 Wallet via Razorpay!`);
      }
    } catch (err) {
      alert(err.error || err.message || 'Top-up failed');
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= LEFT WIDGET: VOICE ASSISTANT ================= */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6 min-h-[480px]">
          <div className="space-y-4">
            {/* Widget Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base leading-tight">
                    Voice Assistant
                  </h2>
                  <p className="text-xs text-slate-400">Agentic Commerce</p>
                </div>
              </div>
              <button className="text-slate-400 hover:text-slate-600 text-xs font-semibold">•••</button>
            </div>

            {/* Speech Bubble / Transcript */}
            <div className="flex flex-col items-end space-y-1 pt-2">
              <div className="bg-[#EEF2FF] text-slate-800 text-xs font-medium px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-sm shadow-xs leading-relaxed">
                {transcript}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Transcript</span>
            </div>

            {/* Middle Cards: PARSE_CONFIRMATION & AGENT STATUS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* PARSE_CONFIRMATION Card */}
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
                  PARSE_CONFIRMATION
                </div>
                <div className="text-xs space-y-1 text-slate-700 font-medium leading-snug">
                  <p>Parsed Intent: <span className="font-bold text-slate-900">{parsedIntent.title}</span></p>
                  <p>BUDGET: <span className="font-bold text-slate-900">{parsedIntent.budget}</span></p>
                  <p>SCHEDULE: <span className="font-bold text-slate-900">{parsedIntent.schedule}</span></p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleConfirmIntent}
                    className="flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold py-2 rounded-xl transition shadow-xs flex items-center justify-center gap-1"
                  >
                    CONFIRM
                  </button>
                  <button
                    onClick={handleReEditIntent}
                    className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold py-2 rounded-xl transition shadow-xs flex items-center justify-center gap-1"
                  >
                    RE-EDIT
                  </button>
                </div>
              </div>

              {/* AGENT STATUS Card */}
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4 space-y-3 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    AGENT STATUS
                  </div>
                  <div className="text-xs space-y-1 text-slate-700 mt-2 font-medium">
                    <p className="text-slate-500 text-[11px]">ACTIVE AGENT:</p>
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {activeAgent}
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-emerald-700 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Policy Bounds Enforced</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Voice / Text Input Box */}
          <form onSubmit={handleAssistantSubmit} className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <button
              type="button"
              onClick={toggleListening}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-sm shrink-0 ${
                isListening
                  ? 'bg-rose-500 text-white animate-bounce'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
              title={isListening ? 'Stop Listening' : 'Voice Input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                placeholder="Talk to your assistant..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition pr-10"
              />
              <button
                type="submit"
                disabled={assistantLoading || !voiceInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 disabled:text-slate-300 hover:text-indigo-800 p-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* ================= RIGHT COLUMN: WALLET & SPENDING ================= */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* --- Widget 2: Wallet Overview --- */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Wallet Overview
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDashboardBalance((prev) => !prev)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                  title={showDashboardBalance ? 'Hide Balance' : 'Show Balance'}
                >
                  {showDashboardBalance ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                </button>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  CURRENT BALANCE:
                </span>
                <div
                  onClick={() => setShowDashboardBalance((prev) => !prev)}
                  className="cursor-pointer select-none inline-flex items-center gap-2 group/dbalance"
                >
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {showDashboardBalance ? (
                      `₹${walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    ) : (
                      <span className="font-mono tracking-widest text-indigo-600 font-bold">₹******</span>
                    )}
                  </span>
                  {!showDashboardBalance && (
                    <span className="text-[10px] font-semibold text-slate-400 group-hover/dbalance:text-indigo-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      view
                    </span>
                  )}
                </div>
              </div>

              {/* Policy Caps Box */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between font-bold text-slate-500 pb-1 border-b border-slate-200/60">
                  <span>WALLET CAPS & POLICY</span>
                  <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                    READ-ONLY
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 pt-0.5">
                  <span>PER-TRANSACTION:</span>
                  <span className="font-bold text-slate-900">
                    ₹{perTxCap.toLocaleString('en-IN')}{' '}
                    <span className="text-[10px] text-emerald-600 font-semibold">(ACTIVE POLICY)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>PER-DAY:</span>
                  <span className="font-bold text-slate-900">
                    ₹{perDayCap.toLocaleString('en-IN')}{' '}
                    <span className="text-[10px] text-emerald-600 font-semibold">(ACTIVE POLICY)</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTopUpModal(true)}
              className="w-full py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>TOP UP</span>
              <span className="italic text-indigo-700 font-black">Razorpay</span>
            </button>
          </div>

          {/* --- Widget 3: Spending Analytics --- */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Spending Analytics
              </h3>
              <button className="text-slate-400 hover:text-slate-600 text-xs">•••</button>
            </div>

            {/* Donut Chart Simulation */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background circle */}
                  <path
                    className="text-slate-100"
                    strokeWidth="5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Tech Segment (Indigo - 60%) */}
                  <path
                    className="text-indigo-600"
                    strokeDasharray={`${analyticsData.tech}, 100`}
                    strokeWidth="5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Home Segment (Teal/Emerald - 20%) */}
                  <path
                    className="text-teal-500"
                    strokeDasharray={`${analyticsData.home}, 100`}
                    strokeDashoffset={`-${analyticsData.tech}`}
                    strokeWidth="5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Other Segment (Slate - 20%) */}
                  <path
                    className="text-slate-400"
                    strokeDasharray={`${analyticsData.other}, 100`}
                    strokeDashoffset={`-${analyticsData.tech + analyticsData.home}`}
                    strokeWidth="5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-slate-400 font-semibold">Total</span>
                  <span className="text-xs font-bold text-slate-800">
                    ₹{(analyticsData.totalSpent || 8450).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Legend Badges */}
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <span>TECH ({analyticsData.tech}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span>HOME ({analyticsData.home}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>OTHER ({analyticsData.other}%)</span>
              </div>
            </div>
          </div>

          {/* ================= BOTTOM-RIGHT 1: ORDER PIPELINE ================= */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Order Pipeline (Tracking)
                </h3>
                <button className="text-slate-400 hover:text-slate-600 text-xs">•••</button>
              </div>

              <div className="text-xs font-semibold text-slate-800">
                ORDER ID: <span className="text-indigo-600">{activeOrder.orderId}</span>
              </div>

              {/* Horizontal Pipeline Steps */}
              <div className="overflow-x-auto scrollbar-none py-2">
                <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                  {activeOrder.steps.map((st, i) => (
                    <React.Fragment key={st.id}>
                      <div
                        className={`px-2 py-1 rounded-lg border text-center transition group relative ${
                          st.badge
                            ? 'bg-[#F0FDF4] border-[#BBF7D0] text-emerald-800 font-semibold'
                            : st.completed
                            ? 'bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <span className="block text-[10px] leading-tight">{st.label}</span>
                        {st.badge && (
                          <span className="block text-[10px] text-emerald-700 font-bold">
                            {st.badge}
                          </span>
                        )}
                        {/* Hover tooltip for agent savings / audit */}
                        {st.note && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 bg-slate-900 text-white text-[9px] px-2 py-1 rounded shadow-lg">
                            {st.note}
                          </div>
                        )}
                      </div>
                      {i < activeOrder.steps.length - 1 && (
                        <span className="text-slate-300 text-xs font-bold">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-white text-[10px] p-2 rounded-xl flex items-center justify-between">
              <span>Negotiated: Agent saved ₹200</span>
              <span className="text-emerald-400 font-bold">Verified ✓</span>
            </div>
          </div>

          {/* ================= BOTTOM-RIGHT 2: SCHEDULED TASKS ================= */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Scheduled Tasks
                </h3>
                <button className="text-slate-400 hover:text-slate-600 text-xs">•••</button>
              </div>

              {/* Tasks List */}
              <div className="space-y-2.5">
                {scheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between text-xs bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          task.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <div>
                        <span className="font-bold text-slate-800 block leading-tight">
                          {task.title}: {task.time}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Budget Cap: {task.budget}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        task.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      ({task.status})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/user/tasks"
              className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center justify-end gap-1"
            >
              <span>Manage All Tasks</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ----------------- TOP UP MODAL ----------------- */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Top Up AP2 Wallet</h3>
              <button
                onClick={() => setShowTopUpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Top-Up Amount (₹)</label>
                <input
                  type="number"
                  min="100"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                {[500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(String(amt))}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg font-bold text-[11px] text-slate-700 transition"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700 leading-snug">
                Settles through AP2 isolation ledger with policy guardrails and Razorpay Checkout.
              </div>

              <button
                onClick={handleTopUp}
                disabled={walletLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                {walletLoading ? 'Processing...' : `Pay ₹${topUpAmount} via Razorpay`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
