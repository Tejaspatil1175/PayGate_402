/**
 * GlobalWidget — "Doorbell" mode
 *
 * Listens for the "Hey Tejas" wake phrase in the background.
 * When heard (or button clicked), navigates to /voice page.
 *
 * IMPORTANT: We prime the TTS audio context INSIDE the user gesture (click/wake)
 * so the browser allows speech synthesis on the voice page.
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic } from 'lucide-react';

// Wake phrase: "Hey Tejas" — also accepts common mishearings
const KAIRO_WAKE_REGEX = /\b(tejas|teja|tejus|tajas|tejs|hey\s*tejas|hi\s*tejas|a\s*tejas|aye\s*tejas)\b/i;

// Prime the Web Audio + SpeechSynthesis context within a user gesture
// so the OS/browser allows TTS on the destination page.
function primeAudioContext() {
  try {
    if (window.speechSynthesis) {
      // A zero-length utterance unlocks the audio context
      const primer = new SpeechSynthesisUtterance('');
      primer.volume = 0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(primer);
    }
  } catch (_) {}
}

export default function GlobalKairoWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const recognitionRef = useRef(null);
  const isMountedRef = useRef(true);

  // Don't render anything on the voice page itself
  const isVoicePage = location.pathname === '/voice';

  useEffect(() => {
    isMountedRef.current = true;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || isVoicePage) return;

    let recognition = null;

    const start = () => {
      if (!isMountedRef.current) return;
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const heard = event.results[i][0].transcript.toLowerCase();
            if (KAIRO_WAKE_REGEX.test(heard)) {
              try { recognition.stop(); } catch (_) {}
              // The recognition callback is a user-initiated context — prime audio here
              primeAudioContext();
              navigate('/voice', { state: { autoStart: true, fromWakeWord: true } });
              break;
            }
          }
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          if (isMountedRef.current && !isVoicePage) {
            setTimeout(start, 1200);
          }
        };

        recognition.start();
      } catch (_) {}
    };

    start();

    return () => {
      isMountedRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, [isVoicePage, navigate]);

  // When NOT on the voice page: show a small floating mic button as shortcut
  if (isVoicePage) return null;

  const handleClick = () => {
    // Must prime audio INSIDE the click handler (user gesture)
    primeAudioContext();
    navigate('/voice', { state: { autoStart: true, fromWakeWord: true } });
  };

  return (
    <button
      onClick={handleClick}
      title="Open Hey Tejas Voice Assistant (or say 'Hey Tejas')"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 24px rgba(99,102,241,0.45)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(99,102,241,0.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.45)'; }}
    >
      <Mic style={{ color: 'white', width: '24px', height: '24px' }} />
    </button>
  );
}
