import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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

// Confirmation / "book it" style phrases — checked locally first (instant, no network round trip)
// against whatever's currently pending, so voice can trigger checkout/confirm directly.
const CONFIRM_PHRASE_REGEX = /^\s*(book\s*it|book\s*this|book\s*that|confirm|yes|yeah|yep|proceed|go\s*ahead|buy\s*it|buy\s*this|do\s*it|purchase\s*it|okay\s*book|ok\s*book|pay\s*now|complete\s*(the\s*)?purchase|do\s*(the\s*)?payment|ok(\s*do\s*payment)?|all\s*ok|done\s*done|done|pay\s*it)\s*[.!]?\s*$/i;

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
  const location = useLocation();
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
      text: `Hello! I am Tejas — your Crypto-Agent Payment Intelligence Assistant. I can help you find products, negotiate discounts, track orders, and execute cryptographic payments.\n\nHere are some things you can try:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(''); 
  const [pendingIntent, setPendingIntent] = useState(null);
  const [pendingNegotiation, setPendingNegotiation] = useState(null);
  const [editBudget, setEditBudget] = useState(0);
  const [pipelineResult, setPipelineResult] = useState(null);
  const [checkoutComplete, setCheckoutComplete] = useState(null);
  const [continuousMode, setContinuousMode] = useState(true); // always-listening by default
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const lastContextRef = useRef(null); // { category, itemKeywords, budget, brandPreference } — last resolved intent for follow-up resolution

  useEffect(() => {
    const available = typeof window !== 'undefined' && !!window.speechSynthesis;
    setTtsAvailable(available);
    if (!available) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'assistant',
          text: `🔇 Voice output (text-to-speech) isn't available on this device/browser. I'll keep responding in text — voice input still works normally.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, []);

  // Builds a lightweight recent-turn history array to send with each request, so follow-ups have context
  const getRecentHistory = () => {
    return messages
      .filter((m) => !m.isWelcome && typeof m.text === 'string')
      .slice(-6)
      .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));
  };

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

  const speakText = (text, onEndCallback) => {
    if (!ttsEnabled || !ttsAvailable || typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      const cleanSpeech = text.replace(/[*_#`₹]/g, '').replace(/AP2/g, 'A P 2');
      const utterance = new SpeechSynthesisUtterance(cleanSpeech);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      // Pick a natural English voice if loaded
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice = voices.find((v) =>
          (v.lang.startsWith('en') || v.lang.includes('IN')) &&
          (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('David') || v.name.includes('George') || v.name.includes('Zira'))
        );
        if (preferredVoice) utterance.voice = preferredVoice;
      }

      let callbackCalled = false;
      const finish = () => {
        if (!callbackCalled) {
          callbackCalled = true;
          setIsSpeaking(false);
          if (onEndCallback) onEndCallback();
        }
      };

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('Utterance error:', e);
        finish();
      };
      
      // Detect if browser blocked autoplay (onstart never fires)
      setTimeout(() => {
        if (!callbackCalled && window.speechSynthesis.paused) {
           console.warn('Autoplay blocked TTS, skipping to end');
           finish();
        }
      }, 800);

      // Fallback timer so audio never gets permanently stuck
      const approxDurationMs = Math.max(2000, (cleanSpeech.split(' ').length / 2.5) * 1000 + 1200);
      const fallbackTimer = setTimeout(() => {
        finish();
      }, approxDurationMs);

      const originalOnEnd = utterance.onend;
      utterance.onend = () => {
        clearTimeout(fallbackTimer);
        originalOnEnd();
      };

      // 60ms delay after cancel to prevent Chrome from dropping speech
      setTimeout(() => {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      }, 60);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      if (onEndCallback) onEndCallback();
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
  const silenceTimerRef = useRef(null);
  const manualStopRef = useRef(false);

  // Fix React Closure Trap for async event handlers
  const handleSendTextRef = useRef(null);
  const handleAudioUploadRef = useRef(null);
  const handleExecuteNegotiationRef = useRef(null);
  
  useEffect(() => {
    // These get updated on every render so they always close over the latest state
    handleSendTextRef.current = handleSendText;
    handleAudioUploadRef.current = handleAudioUpload;
    handleExecuteNegotiationRef.current = handleExecuteNegotiation;
  });

  const startRecording = async () => {
    try {
      manualStopRef.current = false;
      // Immediately interrupt any ongoing Assistant TTS speech
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        let finalSpeechText = '';

        recognition.onresult = (event) => {
          // If assistant was speaking, instantly mute & cancel it
          if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
          }

          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalSpeechText += ' ' + event.results[i][0].transcript;
            } else {
              interimText += ' ' + event.results[i][0].transcript;
            }
          }
          const currentText = (finalSpeechText || interimText).trim();
          if (currentText && !manualStopRef.current) {
            setTranscript(currentText);

            // Auto-send after 1.6s of speech silence
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (currentText.length > 1 && !manualStopRef.current) {
                const textToSend = currentText;
                setTranscript('');
                stopRecording(false);
                if (handleSendTextRef.current) {
                  handleSendTextRef.current(textToSend);
                }
              }
            }, 1600);
          }
        };

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e);
        };

        recognition.onend = () => {
          setIsRecording(false);
          clearInterval(recordingTimerRef.current);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          // Only auto-restart if user did not manually tap stop and assistant is not actively speaking/loading
          if (!manualStopRef.current && !isSpeaking) {
            setTimeout(() => {
              if (!manualStopRef.current && !isSpeaking) startRecording();
            }, 500);
          }
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

      // Fallback: MediaRecorder Audio Blob with Voice Activity Detection (VAD)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.minDecibels = -70;
      analyser.fftSize = 512;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let isSpeakingNow = false;
      let silenceStart = Date.now();
      let vadInterval;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        clearInterval(vadInterval);
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(recordingTimerRef.current);
        
        // Only upload audio if not a manual stop cancellation
        if (!manualStopRef.current && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (handleAudioUploadRef.current) handleAudioUploadRef.current(audioBlob);
        }
        audioChunksRef.current = [];
        
        if (!manualStopRef.current && !isSpeaking) {
          setTimeout(() => {
            if (!manualStopRef.current && !isSpeaking) startRecording();
          }, 500);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      vadInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / bufferLength;

        if (avg > 10) { // Speech detected
          if (!isSpeakingNow) {
            isSpeakingNow = true;
          }
          silenceStart = Date.now();
        } else {
          // 1.8 seconds of silence -> auto send
          if (isSpeakingNow && (Date.now() - silenceStart > 1800)) {
            isSpeakingNow = false;
            if (mediaRecorder.state !== 'inactive') {
              stopRecording(false);
            }
          }
        }
      }, 100);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = (isManual = false) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (isManual) {
      manualStopRef.current = true;
      setTranscript('');
    }

    if (recognitionRef.current) {
      try {
        if (isManual) {
          recognitionRef.current.abort();
        } else {
          recognitionRef.current.stop();
        }
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const hasAutoStartedRef = useRef(false);

  // On page mount: speak greeting and auto-start continuous listening immediately.
  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;

    const greeting = 'Hello! I am Tejas. How can I help you?';

    const doGreet = () => {
      // We start the mic AFTER the greeting finishes, otherwise the mic 
      // instantly hears the greeting and cancels it (barge-in bug)
      speakText(greeting, () => {
        setTimeout(startRecording, 100);
      });
    };

    const synth = window.speechSynthesis;
    if (!synth) {
      setTimeout(startRecording, 300);
      return;
    }

    // Small delay so React can finish painting the page first
    const timer = setTimeout(() => {
      const voices = synth.getVoices();
      if (voices && voices.length > 0) {
        doGreet();
      } else {
        let fired = false;
        // voiceschanged fires once voices are loaded (Chrome async)
        const onVoicesChanged = () => {
          if (fired) return;
          fired = true;
          synth.removeEventListener('voiceschanged', onVoicesChanged);
          doGreet();
        };
        synth.addEventListener('voiceschanged', onVoicesChanged);
        
        // Fallback if voiceschanged never fires (e.g. some browsers/OS)
        setTimeout(() => {
          if (!fired) {
            fired = true;
            synth.removeEventListener('voiceschanged', onVoicesChanged);
            doGreet();
          }
        }, 1200);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleAudioUpload = async (audioBlob) => {
    setLoading(true);
    setPipelineStage('transcribing');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('history', JSON.stringify(getRecentHistory()));
      if (lastContextRef.current) formData.append('lastContext', JSON.stringify(lastContextRef.current));

      const res = await apiClient.post('/voice/transcribe-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        const { rawTranscript, intent, confirmationGate, isConfirmPurchase } = res.data;

        const userMsg = {
          id: Date.now(),
          sender: 'user',
          text: rawTranscript || '🎙️ [Voice Command Transcribed]',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);

        const textLower = (rawTranscript || '').toLowerCase();

        // --- Local Intent Routing ---
        // 1. Budget parsing
        if (pendingIntent && (!pendingIntent.intent.budget || pendingIntent.intent.budget === 0)) {
          let parsedBudget = 0;
          const digits = textLower.match(/\d+/g);
          if (digits) {
            parsedBudget = parseInt(digits.join(''), 10);
            if (textLower.includes('thousand') || textLower.includes('k')) {
              if (parsedBudget < 1000) parsedBudget *= 1000;
            } else if (textLower.includes('hundred')) {
              if (parsedBudget < 100) parsedBudget *= 100;
            }
          }
          if (parsedBudget > 0) {
            setEditBudget(parsedBudget);
            handleConfirmIntent(parsedBudget);
            return;
          }
        }

        // 2. State-aware fuzzy routing
        if (pendingNegotiation) {
          const isNegotiate = textLower.includes('negotiat') || textLower.includes('bargain') || textLower.includes('yes') || textLower.includes('go') || textLower.includes('do it') || textLower.includes('ok') || textLower.includes('next') || textLower.includes('buy') || textLower.includes('order') || textLower.includes('confirm') || textLower.includes('proceed');
          if (isNegotiate && handleExecuteNegotiationRef.current) {
            handleExecuteNegotiationRef.current(pendingNegotiation);
            return;
          }
        }

        if (pipelineResult && !checkoutComplete) {
          const isPay = textLower.includes('pay') || textLower.includes('buy') || textLower.includes('book') || textLower.includes('ok') || textLower.includes('done') || textLower.includes('yes') || textLower.includes('proceed') || textLower.includes('go') || textLower.includes('next') || textLower.includes('confirm');
          if (isPay) {
            handleExecuteCheckout(pipelineResult);
            return;
          }
        }

        // Direct product search & proposal if user requested a product
        if (intent && (intent.action === 'buy' || intent.action === 'search' || intent.itemKeywords)) {
          lastContextRef.current = { category: intent.category, itemKeywords: intent.itemKeywords, budget: intent.budget || 0, brandPreference: intent.brandPreference };
          await executeProductSearchAndProposal(intent.itemKeywords || rawTranscript, intent.category, intent.budget);
          return;
        }

        if (pendingIntent) {
          const isConfirm = textLower.includes('ok') || textLower.includes('yes') || textLower.includes('proceed');
          if (isConfirm || CONFIRM_PHRASE_REGEX.test(rawTranscript.trim())) {
            handleConfirmIntent();
            return;
          }
        }
        
        // Explicit deny for confirm if they just said ok but nothing pending
        if (CONFIRM_PHRASE_REGEX.test(rawTranscript.trim())) {
           setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'assistant', text: `I don't have anything pending to confirm yet — tell me what you'd like to search for first.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
           return;
        }

        // Backend-resolved confirmation (fallback)
        if (isConfirmPurchase) {
          setLoading(false);
          setPipelineStage('');
          if (pendingNegotiation) {
            handleExecuteNegotiation(pendingNegotiation);
          } else if (pipelineResult && !checkoutComplete) {
            handleExecuteCheckout(pipelineResult);
          } else if (pendingIntent) {
            handleConfirmIntent();
          } else {
            setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'assistant', text: `I don't have anything pending to confirm yet — tell me what you'd like to search for first.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
          }
          return;
        }

        setPendingIntent({ rawTranscript, intent, confirmationGate });
        setEditBudget(intent.budget || 0);
        lastContextRef.current = { category: intent.category, itemKeywords: intent.itemKeywords, budget: intent.budget || 0, brandPreference: intent.brandPreference };

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
          : `Before I can search for ${intent.itemKeywords}, I need a budget. What is your budget?`);
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

    const textLower = textToSend.toLowerCase();

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setTranscript('');

    // Voice Budget Follow-up parsing
    if (pendingIntent && (!pendingIntent.intent.budget || pendingIntent.intent.budget === 0)) {
      let parsedBudget = 0;
      const digits = textLower.match(/\d+/g);
      if (digits) {
        parsedBudget = parseInt(digits.join(''), 10);
        if (textLower.includes('thousand') || textLower.includes('k')) {
          if (parsedBudget < 1000) parsedBudget *= 1000;
        } else if (textLower.includes('hundred')) {
          if (parsedBudget < 100) parsedBudget *= 100;
        }
      }
      
      if (parsedBudget > 0) {
        setEditBudget(parsedBudget);
        // Automatically trigger confirmation with the new budget
        handleConfirmIntent(parsedBudget);
        return;
      }
    }

    // State-aware fuzzy routing
    if (pendingNegotiation) {
      const isNegotiate = textLower.includes('negotiat') || textLower.includes('bargain') || textLower.includes('yes') || textLower.includes('go') || textLower.includes('do it') || textLower.includes('ok') || textLower.includes('next') || textLower.includes('buy') || textLower.includes('order') || textLower.includes('confirm') || textLower.includes('proceed');
      if (isNegotiate && handleExecuteNegotiationRef.current) {
        handleExecuteNegotiationRef.current(pendingNegotiation);
        return;
      }
    }

    if (pipelineResult && !checkoutComplete) {
      const isPay = textLower.includes('pay') || textLower.includes('buy') || textLower.includes('book') || textLower.includes('ok') || textLower.includes('done') || textLower.includes('yes') || textLower.includes('proceed') || textLower.includes('go') || textLower.includes('next') || textLower.includes('confirm');
      if (isPay) {
        handleExecuteCheckout(pipelineResult);
        return;
      }
    }

    if (pendingIntent) {
      const isConfirm = textLower.includes('ok') || textLower.includes('yes') || textLower.includes('proceed');
      if (isConfirm || CONFIRM_PHRASE_REGEX.test(textToSend.trim())) {
        handleConfirmIntent();
        return;
      }
    }

    // Explicit deny for confirm if they just said ok but nothing pending
    if (CONFIRM_PHRASE_REGEX.test(textToSend.trim())) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'assistant', text: `I don't have anything pending to confirm yet — tell me what you'd like to search for first.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }

    setLoading(true);
    setPipelineStage('parsing');

    if (textLower.includes('wallet') || textLower.includes('balance') || textLower.includes('money') || textLower.includes('funds')) {
      try {
        const walletRes = await apiClient.get('/wallet/balance');
        const data = walletRes.data || {};
        const balance = data.balance ?? walletBalance ?? 0;
        const dailySpent = data.dailySpent ?? 0;
        const perDayCap = data.perDayCap ?? 50000;
        const remainingCap = Math.max(0, perDayCap - dailySpent);

        setWalletBalance(balance);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: `💳 Here is your live AP2 Wallet & Spending summary:`,
            isWalletCard: true,
            walletData: {
              balance,
              dailySpent,
              perDayCap,
              remainingCap,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakText(`Your AP2 wallet balance is ₹${balance.toLocaleString('en-IN')}. You have ₹${remainingCap.toLocaleString('en-IN')} remaining in your daily spend limit.`);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: `💳 Your current AP2 Wallet Balance is ₹${(walletBalance || 0).toLocaleString('en-IN')}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setLoading(false);
        setPipelineStage('');
      }
      return;
    }

    if (textLower.includes('track') || textLower.includes('order') || textLower.includes('delivery') || textLower.includes('package') || textLower.includes('status')) {
      try {
        const ordersRes = await apiClient.get('/user/orders');
        const orders = ordersRes.data?.orders || ordersRes.data || [];

        if (Array.isArray(orders) && orders.length > 0) {
          const latestOrder = orders[0];
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: `📦 Found your most recent AP2 order #${latestOrder.orderId || latestOrder._id}:`,
              isOrderCard: true,
              orderData: latestOrder,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(`Your latest order #${latestOrder.orderId || ''} for ₹${latestOrder.totalAmount || latestOrder.amount} is currently ${latestOrder.status || 'confirmed'}.`);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: `📦 You don't have any placed orders yet. Would you like me to find deals on shoes, headphones, or fashion for you?`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(`You do not have any orders placed yet.`);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: `📦 You can view your live orders and fulfillment timeline in the Orders dashboard.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setLoading(false);
        setPipelineStage('');
      }
      return;
    }

    if (textLower.includes('deal') || textLower.includes('offer') || textLower.includes('recommend') || textLower.includes('top deal') || textLower.includes('trending')) {
      try {
        const discoveryRes = await apiClient.get('/discovery/search', { params: { limit: 4 } });
        const products = discoveryRes.data?.products || [];

        if (products.length > 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: `🔥 Here are today's top recommended deals with autonomous AP2 discounts:`,
              isDealsCard: true,
              deals: products,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          speakText(`Here are today's top deals from verified merchants.`);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'assistant',
              text: `🔥 Explore our catalog to discover live products eligible for autonomous agent discounts.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: `🔥 Checking catalog deals for you...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setLoading(false);
        setPipelineStage('');
      }
      return;
    }

    if (textLower.includes('security') || textLower.includes('safe') || textLower.includes('crypto') || textLower.includes('how it works') || textLower.includes('guardrail')) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `🛡️ PayGate 402 Cryptographic Integrity & Safety Architecture:`,
          isSecurityCard: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText(`All autonomous agent transactions are secured by RSA-PSS 2048-bit digital signatures and atomic double-entry ledgers.`);
      setLoading(false);
      setPipelineStage('');
      return;
    }

    try {
      const res = await apiClient.post('/voice/parse-text', {
        text: textToSend,
        history: getRecentHistory(),
        lastContext: lastContextRef.current,
      });
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
        setLoading(false);
        setPipelineStage('');
        return;
      }

      // Backend-resolved confirmation (LLM/rule-based fallback recognized a "book it" style follow-up)
      if (res.data?.isConfirmPurchase) {
        setLoading(false);
        setPipelineStage('');
        if (pipelineResult && !checkoutComplete) {
          handleExecuteCheckout(pipelineResult);
        } else if (pendingIntent) {
          handleConfirmIntent();
        } else {
          setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'assistant', text: `I don't have anything pending to confirm yet — tell me what you'd like to search for first.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }
        return;
      }

      if (res.data?.success) {
        const { rawTranscript, intent, confirmationGate } = res.data;
        lastContextRef.current = { category: intent.category, itemKeywords: intent.itemKeywords, budget: intent.budget || 0, brandPreference: intent.brandPreference };

        // If user is searching or buying a product, execute product discovery and present proposal card directly!
        if (intent.action === 'buy' || intent.action === 'search' || intent.itemKeywords) {
          await executeProductSearchAndProposal(intent.itemKeywords || textToSend, intent.category, intent.budget);
          return;
        }

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

        speakText(intent.budget
          ? `Parsed request for ${intent.itemKeywords} with budget of ${intent.budget} rupees. Please confirm.`
          : `Before I can search for ${intent.itemKeywords}, I need a budget. What is your budget?`);
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

  const executeProductSearchAndProposal = async (keywords, category = 'General', budget = 0) => {
    setLoading(true);
    setPipelineStage('matching');

    try {
      const stored = localStorage.getItem('paygate_user');
      const u = stored ? JSON.parse(stored) : null;
      const userId = u?._id || u?.id || 'agent_buyer_user';

      const discoveryRes = await apiClient.get('/discovery/search', {
        params: {
          q: keywords || category || '',
          category: category !== 'General' ? category : undefined,
          ...(budget > 0 ? { maxPrice: budget } : {}),
          limit: 6,
        },
      });

      const productsFound = discoveryRes.data?.products || [];
      if (productsFound.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 2,
            sender: 'assistant',
            text: `I searched the catalog for "${keywords}" but couldn't find items matching ₹${budget?.toLocaleString('en-IN')}. Would you like me to show all available items?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakText(`I searched for ${keywords} but couldn't find matching items. Would you like to adjust your budget?`);
        setPendingIntent(null);
        setPendingNegotiation(null);
        return;
      }

      const topProduct = productsFound[0];
      const proposalData = {
        topProduct,
        finalBudget: budget > 0 ? budget : (topProduct.price || 50000),
        intent: { itemKeywords: keywords, category, budget },
        userId,
      };

      setPendingNegotiation(proposalData);
      setPendingIntent(null);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'assistant',
          text: `I found a great match: "${topProduct.title}" for ₹${topProduct.price?.toLocaleString('en-IN')} (verified seller, high safety rating). Should I negotiate a discount with the merchant and place the order for you?`,
          isProductProposal: true,
          proposal: proposalData,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText(`I found ${topProduct.title} for ${topProduct.price} rupees. Should I negotiate a discount and place the order for you?`);
    } catch (err) {
      console.error('[Voice Search Error]:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'assistant',
          text: `⚠️ Search error: ${err.message || 'Failed to search catalog.'}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setPipelineStage('');
    }
  };

  const handleConfirmIntent = async (overrideBudget = null) => {
    if (!pendingIntent) return;
    const { intent } = pendingIntent;
    const finalBudget = (typeof overrideBudget === 'number' ? overrideBudget : Number(editBudget)) || 0;
    await executeProductSearchAndProposal(intent.itemKeywords, intent.category, finalBudget);
  };

  const handleExecuteNegotiation = async (searchData) => {
    const { topProduct, finalBudget, intent, userId } = searchData;
    setPendingNegotiation(null);
    setLoading(true);
    setPipelineStage('negotiating');

    const originalPrice = topProduct.price || (finalBudget > 0 ? finalBudget : 3000);
    const proposedPrice = Math.max(1, Math.round(originalPrice * 0.9));

    // Show simulated chat UI
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 3,
        sender: 'assistant',
        isNegotiationChat: true,
        negotiationData: {
          merchantPrice: originalPrice,
          buyerPrice: proposedPrice,
          status: 'negotiating',
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    speakText(`Merchant is negotiating a discount for ${topProduct.title}...`);

    // Simulate negotiation delay and backend call
    setTimeout(async () => {
      try {
        const intentBudgetCap = Math.max(finalBudget > 0 ? finalBudget : 0, originalPrice, 50000);
        const intentRes = await apiClient.post('/agent/intent', {
          agentId: userId,
          category: topProduct.category || intent?.category || 'General',
          keywords: intent?.itemKeywords ? [intent.itemKeywords] : [topProduct.title],
          budgetCap: intentBudgetCap,
          currency: topProduct.currency || 'INR',
          merchantPreferences: topProduct.merchant?.id ? [topProduct.merchant.id] : [],
        });
        const createdIntent = intentRes.data?.intent;
        const intentId = createdIntent?.id || createdIntent?._id;

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
          items: [{
            product: topProduct._id || topProduct.id,
            productId: topProduct._id || topProduct.id,
            title: topProduct.title,
            quantity: 1,
            unitPrice: negotiatedPrice,
            totalPrice: negotiatedPrice,
            subtotal: negotiatedPrice,
          }],
          agreedAmount: negotiatedPrice,
          userPrivateKey: userKeys.privateKey,
          userPublicKey: userKeys.publicKey,
          expiresInMinutes: 60,
        });

        const contractDoc = contractRes.data?.contract;
        if (!contractDoc) {
          throw new Error(contractRes.data?.error || 'Failed to generate signed contract from backend');
        }

        const contractId = contractDoc.contractId || contractDoc._id;

        const resultData = {
          product: topProduct,
          allProducts: [topProduct],
          originalPrice,
          finalPrice: negotiatedPrice,
          savings,
          discountPercent: Math.round(((originalPrice - negotiatedPrice) / originalPrice) * 100),
          merchant: topProduct.merchant || { name: 'Verified AP2 Merchant' },
          contractId,
          status: contractDoc.status || 'signed',
        };

        setPipelineResult(resultData);

        // Update negotiation chat message to finished
        setMessages((prev) =>
          prev.map((m) =>
            m.isNegotiationChat
              ? { ...m, negotiationData: { ...m.negotiationData, finalPrice: negotiatedPrice, status: 'agreed' } }
              : m
          )
        );

        // Check wallet balance before attempting payment
        let currentBalance = walletBalance ?? 0;
        try {
          const balRes = await apiClient.get('/wallet/balance');
          if (balRes.data?.balance !== undefined) {
            currentBalance = balRes.data.balance;
            setWalletBalance(currentBalance);
          }
        } catch (balErr) {
          console.warn('Failed to refresh balance:', balErr);
        }

        if (currentBalance < negotiatedPrice) {
          const shortage = negotiatedPrice - currentBalance;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 4,
              sender: 'assistant',
              text: `⚠️ Insufficient Wallet Balance\n\n• Agreed Price: ₹${negotiatedPrice.toLocaleString('en-IN')} (Saved ₹${savings.toLocaleString('en-IN')})\n• Available Wallet Balance: ₹${currentBalance.toLocaleString('en-IN')}\n• Required Top-up: ₹${shortage.toLocaleString('en-IN')}\n\nPlease top up your wallet to settle this signed AP2 mandate.`,
              isInsufficientBalance: true,
              pipeline: resultData,
              shortage,
              currentBalance,
              requiredAmount: negotiatedPrice,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);

          speakText(`The merchant agreed on ${negotiatedPrice} rupees, saving you ${savings} rupees! However, your wallet balance is only ${currentBalance} rupees. Please top up your wallet to complete the order.`);
          setLoading(false);
          setPipelineStage('');
          return;
        }

        // Instant Automatic Settlement via Razorpay MCP / Wallet
        setPipelineStage('paying');
        const stored = localStorage.getItem('paygate_user');
        const u = stored ? JSON.parse(stored) : null;

        const payRes = await apiClient.post('/agent/payment/execute', {
          contractId,
          customer: {
            name: u?.name || 'Authorized Buyer',
            email: u?.email || 'buyer@paygate.internal',
            phone: u?.phone || '9999999999',
            id: userId,
          },
          userId,
        });

        const orderId = payRes.data?.paymentDetails?.orderId || `ORD-${Date.now().toString().slice(-6).toUpperCase()}`;

        const orderReceipt = {
          orderId,
          amount: negotiatedPrice,
          originalPrice,
          savings,
          product: topProduct.title,
          merchant: topProduct.merchant?.name || 'Verified Merchant',
          contractId,
          settledAt: new Date().toISOString(),
        };

        setCheckoutComplete(orderReceipt);
        await fetchWalletBalance();

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 4,
            sender: 'assistant',
            text: `🎉 Order #${orderReceipt.orderId} settled successfully! Negotiated ₹${savings.toLocaleString('en-IN')} discount (paid ₹${negotiatedPrice.toLocaleString('en-IN')}). Wallet debited via AP2 Autonomous Mandate.`,
            isReceipt: true,
            receipt: orderReceipt,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        speakText(`Order placed successfully! I negotiated a discount of ${savings} rupees, so you only pay ${negotiatedPrice} rupees. Your wallet has been debited and order is confirmed!`);
      } catch (err) {
        const pipeErrMsg = err?.error || err?.message || (typeof err === 'string' ? err : 'Something went wrong. Please try again.');
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 2,
            sender: 'assistant',
            text: `⚠️ Order Error: ${pipeErrMsg}`,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakText(`There was an issue completing the order. ${pipeErrMsg}`);
      } finally {
        setLoading(false);
        setPipelineStage('');
      }
    }, 2000);
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
        orderId: payRes.data.paymentDetails?.orderId || `ORD-${Date.now().toString().slice(-6).toUpperCase()}`,
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
      
      speakText(`All ok! The transaction is completed and ${orderReceipt.amount} rupees have been paid via autonomous mandate.`);
    } catch (err) {
      const errMsg = err?.error || err?.message || (typeof err === 'string' ? err : 'Payment execution failed. Please try again.');
      setMessages((prev) => [...prev, { id: Date.now() + 3, sender: 'assistant', text: `⚠️ Payment Error: ${errMsg}`, isError: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
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
        className="flex-1 overflow-y-auto no-scrollbar px-3 sm:px-6 pt-3 sm:pt-4 pb-48 lg:pb-32 space-y-4 sm:space-y-6 scroll-smooth w-full"
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
                  {msg.isProductProposal && msg.proposal && (
                    <div className="mt-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                          <img
                            src={getProductImage(msg.proposal.topProduct)}
                            alt={msg.proposal.topProduct?.title || 'Product'}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {msg.proposal.topProduct?.category || 'Footwear'}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              ✓ Verified Merchant
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm truncate">{msg.proposal.topProduct?.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-1">{msg.proposal.topProduct?.description || `${msg.proposal.topProduct?.title}, in stock`}</p>
                          <div className="flex items-baseline gap-2 pt-0.5">
                            <span className="text-base font-black text-slate-900">₹{msg.proposal.topProduct?.price?.toLocaleString('en-IN')}</span>
                            <span className="text-[11px] text-emerald-600 font-semibold">In Stock</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <span>⭐⭐⭐⭐⭐</span>
                          <span className="text-slate-500 font-medium text-[11px]">4.9 (Safe Merchant)</span>
                        </div>
                        <span className="text-indigo-600 font-bold text-[11px]">✓ AP2 Discount Eligible</span>
                      </div>

                      {!checkoutComplete && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExecuteNegotiation(msg.proposal)}
                            disabled={loading}
                            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>✨ Yes, Negotiate & Place Order</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendText('show more options')}
                            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                          >
                            Keep Looking
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.isNegotiationChat && msg.negotiationData && (
                    <div className="mt-4 bg-white border border-indigo-100 shadow-sm rounded-2xl overflow-hidden text-sm">
                      <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-indigo-900 text-xs uppercase tracking-wide">Agent Negotiation Logs</span>
                        {msg.negotiationData.status === 'negotiating' && <span className="ml-auto text-[10px] text-indigo-500 font-bold animate-pulse">NEGOTIATING...</span>}
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex gap-2">
                           <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200"><User className="w-3 h-3 text-slate-500" /></div>
                           <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2 text-slate-700 text-xs">
                             <p className="font-bold text-[10px] text-slate-400 mb-0.5">Merchant Agent</p>
                             This is my price: <strong className="text-slate-900">₹{msg.negotiationData.merchantPrice?.toLocaleString('en-IN')}</strong>
                           </div>
                        </div>
                        {msg.negotiationData.buyerPrice && (
                          <div className="flex gap-2 flex-row-reverse">
                             <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200"><Bot className="w-3 h-3 text-indigo-600" /></div>
                             <div className="bg-indigo-50 rounded-2xl rounded-tr-sm px-3 py-2 text-indigo-900 text-xs">
                               <p className="font-bold text-[10px] text-indigo-400 mb-0.5">Buyer Agent</p>
                               I want it in this price: <strong className="text-indigo-700">₹{msg.negotiationData.buyerPrice?.toLocaleString('en-IN')}</strong>
                             </div>
                          </div>
                        )}
                        {msg.negotiationData.finalPrice && (
                          <div className="flex gap-2">
                             <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200"><User className="w-3 h-3 text-slate-500" /></div>
                             <div className="bg-emerald-50 rounded-2xl rounded-tl-sm px-3 py-2 text-emerald-900 text-xs border border-emerald-100">
                               <p className="font-bold text-[10px] text-emerald-600 mb-0.5">Merchant Agent</p>
                               Ok, you are our loyal customer, so we go with this price: <strong className="text-emerald-700">₹{msg.negotiationData.finalPrice?.toLocaleString('en-IN')}</strong>
                             </div>
                          </div>
                        )}
                      </div>
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
                  {msg.isInsufficientBalance && msg.pipeline && (
                    <div className="mt-4 p-4 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                        <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                          <span>Action Blocked: Insufficient Balance</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                          Wallet Check Failed
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Agreed Order Total</span>
                          <strong className="text-slate-900 font-black">₹{msg.requiredAmount?.toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Available in Wallet</span>
                          <strong className="text-slate-700 font-bold">₹{msg.currentBalance?.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-rose-100/80 flex justify-between items-center">
                          <span className="text-rose-700 font-bold text-[11px]">Shortage / Required Top-up:</span>
                          <span className="text-rose-700 font-black text-xs">₹{msg.shortage?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => navigate('/wallet')}
                          className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Top Up Wallet (₹{msg.shortage?.toLocaleString('en-IN')})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecuteCheckout(msg.pipeline)}
                          className="px-3.5 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Retry Payment</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {msg.isWalletCard && msg.walletData && (
                    <div className="mt-4 p-4 rounded-2xl bg-white border border-indigo-100 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Available Wallet Balance</span>
                        <span className="text-lg font-black text-slate-900">₹{msg.walletData.balance?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                          <span>Daily Spend Quota</span>
                          <span>₹{msg.walletData.dailySpent?.toLocaleString('en-IN')} / ₹{msg.walletData.perDayCap?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, ((msg.walletData.dailySpent || 0) / (msg.walletData.perDayCap || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => navigate('/wallet')}
                          className="flex-1 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Top Up & Ledger History</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.isOrderCard && msg.orderData && (
                    <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-mono">ORDER ID</span>
                          <strong className="text-xs font-bold text-slate-900">{msg.orderData.orderId || msg.orderData._id}</strong>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase border border-emerald-200">
                          {msg.orderData.status || 'Confirmed'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Paid:</span>
                          <strong className="text-slate-900 font-bold">₹{(msg.orderData.totalAmount || msg.orderData.amount)?.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Settlement:</span>
                          <span className="text-emerald-600 font-medium">AP2 Autonomous Mandate</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/orders')}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Track Delivery Timeline</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {msg.isDealsCard && msg.deals && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {msg.deals.map((item, idx) => (
                        <div key={idx} className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs space-y-2 flex flex-col justify-between hover:border-indigo-300 transition">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                              <img
                                src={getProductImage(item)}
                                alt={item.title}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400';
                                }}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-slate-900 truncate">{item.title}</h5>
                              <span className="text-[11px] font-black text-indigo-700">₹{item.price?.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSendText(`Buy ${item.title}`)}
                            className="w-full py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Zap className="w-3 h-3 text-cyan-400" />
                            <span>Negotiate & Buy</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.isSecurityCard && (
                    <div className="mt-4 p-4 rounded-2xl bg-white border border-indigo-200 shadow-xs space-y-2.5 text-xs text-slate-700">
                      <div className="flex items-center gap-2 text-indigo-900 font-bold">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        <span>AP2 Cryptographic Security Protocol</span>
                      </div>
                      <div className="space-y-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <strong className="text-slate-900 block">🔑 RSA-PSS 2048-bit Mandates</strong>
                          <span className="text-[11px] text-slate-500">Every autonomous purchase generates a cryptographically signed contract with your private key.</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <strong className="text-slate-900 block">⚡ Double-Entry Idempotency</strong>
                          <span className="text-[11px] text-slate-500">Atomic ledger updates guarantee 0 duplicate debits or stale balance states.</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <strong className="text-slate-900 block">🛡️ Safety Velocity Gates</strong>
                          <span className="text-[11px] text-slate-500">Autonomous spend limits enforce numerical echo verification before executing payments.</span>
                        </div>
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

      {/* ── Always-Listening Orb ────────────────────────────────────────── */}
      <div className="absolute bottom-14 lg:bottom-0 left-0 right-0 flex flex-col items-center pb-3 lg:pb-6 pt-2 z-30 pointer-events-none">

        {/* Live transcript bubble — shows what Tejas hears in real time */}
        {transcript && (
          <div className="mb-4 max-w-sm w-full mx-auto px-4 pointer-events-none">
            <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-700 font-medium shadow-md text-center animate-in fade-in duration-200">
              🎙️ <span className="italic">{transcript}</span>
            </div>
          </div>
        )}

        {/* Speaking status */}
        {isSpeaking && !isRecording && (
          <div className="mb-3 text-xs text-indigo-600 font-semibold animate-pulse tracking-wide">
            Tejas is speaking...
          </div>
        )}

        {/* Mic orb */}
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isRecording) {
                stopRecording(true);
              } else {
                manualStopRef.current = false;
                startRecording();
              }
            }}
            title={isRecording ? 'Tap to stop' : 'Tap to speak'}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: isRecording
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : isSpeaking
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(135deg, #0f172a, #1e293b)',
              boxShadow: isRecording
                ? '0 0 0 12px rgba(239,68,68,0.15), 0 4px 24px rgba(239,68,68,0.4)'
                : isSpeaking
                ? '0 0 0 12px rgba(99,102,241,0.15), 0 4px 24px rgba(99,102,241,0.45)'
                : '0 4px 24px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
              animation: isRecording ? 'pulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            {isRecording
              ? <MicOff style={{ color: 'white', width: 28, height: 28 }} />
              : <Mic style={{ color: isRecording ? 'white' : '#818cf8', width: 28, height: 28 }} />
            }
          </button>

          {/* Status label under orb */}
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {isRecording ? '● Listening' : isSpeaking ? '◎ Speaking' : '○ Tap to speak'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 12px rgba(239,68,68,0.15), 0 4px 24px rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 22px rgba(239,68,68,0.06), 0 4px 32px rgba(239,68,68,0.6); }
        }
      `}</style>

    </div>
  );
}
