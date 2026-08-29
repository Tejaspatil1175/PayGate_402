import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic } from 'lucide-react';

/**
 * Prime the Web Audio + SpeechSynthesis context within a user click gesture
 * so the OS/browser allows TTS on the destination page without blocking.
 */
function primeAudioContext() {
  try {
    if (window.speechSynthesis) {
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

  // Don't render the floating widget on the dedicated voice page or admin pages
  const isVoicePage = location.pathname === '/voice';
  const isAdminPage = location.pathname.startsWith('/admin');

  if (isVoicePage || isAdminPage) return null;

  const handleClick = () => {
    primeAudioContext();
    navigate('/voice', { state: { autoStart: true, fromWakeWord: false } });
  };

  return (
    <button
      onClick={handleClick}
      title="Open Voice Assistant"
      className="hidden lg:flex fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white items-center justify-center shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
      aria-label="Open Voice Assistant"
    >
      <Mic className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
      <span className="sr-only">Open Voice Assistant</span>
    </button>
  );
}
