import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Sparkles, Upload, FileAudio, Check, Loader2 } from 'lucide-react';

interface AudioVoiceRecorderProps {
  onTranscriptReady: (transcript: string, summary: string, audioDataUrl?: string) => void;
  currentTranscript: string;
}

export const AudioVoiceRecorder: React.FC<AudioVoiceRecorderProps> = ({
  onTranscriptReady,
  currentTranscript,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(currentTranscript);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [liveSpeechActive, setLiveSpeechActive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  useEffect(() => {
    setTranscriptDraft(currentTranscript);
  }, [currentTranscript]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          setAudioBase64(base64data);
        };

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Try browser Web Speech API for live dictation on iPad/Chrome if supported
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let fullText = '';
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript + ' ';
            }
            if (fullText.trim()) {
              setTranscriptDraft((prev) => {
                const combined = prev ? `${prev.trim()}\n${fullText.trim()}` : fullText.trim();
                return combined;
              });
              setLiveSpeechActive(true);
            }
          };

          recognition.onerror = () => {
            setLiveSpeechActive(false);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.log('Web Speech API not available or blocked, relying on Gemini audio transcription');
        }
      }
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      alert('Microphone access is needed to record voice notes. Please allow microphone permissions in your browser settings.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
    }
    setIsRecording(false);
    setLiveSpeechActive(false);
  };

  const togglePlayback = () => {
    if (!audioElementRef.current && audioUrl) {
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      audio.onended = () => setIsPlaying(false);
    }

    if (audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElementRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1];
      setAudioBase64(base64data);
    };
  };

  const resetRecording = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setAudioUrl(null);
    setAudioBase64(null);
    setIsPlaying(false);
    setRecordingTime(0);
  };

  // AI Transcription & Summary Call
  const handleAiTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const response = await fetch('/api/ai/transcribe-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: audioBase64,
          mimeType: 'audio/webm',
          textDraft: transcriptDraft,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTranscriptDraft(data.transcript);
        setSummaryDraft(data.summary);
        onTranscriptReady(data.transcript, data.summary, audioUrl || undefined);
      } else {
        alert(data.error || 'Transcription failed');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      alert('Could not transcribe audio. Please verify your network connection.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Student Voice Note & Conversation Audio</h4>
            <p className="text-xs text-slate-500">Record 1-on-1 dialogue, student explanations, or voice summary</p>
          </div>
        </div>

        {isRecording && (
          <div className="flex items-center space-x-2 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-full animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            <span className="text-xs font-bold text-rose-700 font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {/* Recording / Playback Controls - Tactile iPad size */}
      <div className="flex flex-wrap items-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm shadow-md shadow-rose-200 hover:bg-rose-700 active:scale-95 transition-all min-h-[48px]"
          >
            <Mic className="w-5 h-5" />
            <span>Record Student / Voice Note</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md hover:bg-slate-800 active:scale-95 transition-all min-h-[48px]"
          >
            <Square className="w-5 h-5 fill-white" />
            <span>Stop Recording</span>
          </button>
        )}

        {/* Audio Playback Controls if recorded */}
        {audioUrl && !isRecording && (
          <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <button
              type="button"
              onClick={togglePlayback}
              className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={resetRecording}
              className="w-10 h-10 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
              title="Delete audio"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 font-medium px-1">
              Audio recorded ({formatTime(recordingTime || 1)})
            </span>
          </div>
        )}

        {/* Upload Audio Option */}
        <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-all min-h-[48px]">
          <Upload className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">Upload Audio</span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* AI Transcribe / Summarize Trigger */}
        {(audioBase64 || transcriptDraft.trim().length > 0) && (
          <button
            type="button"
            onClick={handleAiTranscribe}
            disabled={isTranscribing}
            className="inline-flex items-center space-x-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-sm hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all min-h-[48px]"
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isTranscribing ? 'Transcribing with AI...' : 'Transcribe & Summarize'}</span>
          </button>
        )}
      </div>

      {/* Transcript Textbox & Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
            <span>Verbatim Quotes / Conversation Transcript:</span>
            {liveSpeechActive && (
              <span className="text-[11px] font-normal text-emerald-600 animate-pulse">
                • Live Speech Capturing
              </span>
            )}
          </label>
          {transcriptDraft && (
            <button
              type="button"
              onClick={() => onTranscriptReady(transcriptDraft, summaryDraft, audioUrl || undefined)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Apply to Assessment
            </button>
          )}
        </div>
        <textarea
          rows={3}
          value={transcriptDraft}
          onChange={(e) => {
            setTranscriptDraft(e.target.value);
            onTranscriptReady(e.target.value, summaryDraft, audioUrl || undefined);
          }}
          placeholder="Student quotes or transcript will appear here, or you can type direct student statements (e.g. 'I noticed when I doubled the denominator, the pieces got smaller')..."
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {summaryDraft && (
        <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900">
          <div className="font-bold flex items-center space-x-1 text-indigo-950 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Voice Note Summary:</span>
          </div>
          <p className="leading-relaxed">{summaryDraft}</p>
        </div>
      )}
    </div>
  );
};
