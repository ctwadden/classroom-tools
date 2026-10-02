import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  RotateCcw, 
  Check, 
  Trash2, 
  Sparkles, 
  AlertCircle, 
  Volume2, 
  Info,
  Clock,
  FileText
} from 'lucide-react';
import { saveVoiceBlob, deleteVoiceBlob } from '../utils/indexedDb';
import { CourseId } from '../types/evidenceContract';

interface VoiceNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnerId: string;
  learnerName: string;
  courseId: CourseId;
  onAcceptTranscriptAsNote: (transcript: string, voiceNoteId: string) => void;
}

export const VoiceNotesModal: React.FC<VoiceNotesModalProps> = ({
  isOpen,
  onClose,
  learnerId,
  learnerName,
  courseId,
  onAcceptTranscriptAsNote,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [voiceNoteId, setVoiceNoteId] = useState<string>('');
  
  // Transcription & Gemini state
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptDraft, setTranscriptDraft] = useState<string>('');
  const [isReviewed, setIsReviewed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state for new capture
      setVoiceNoteId(`vn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      setAudioUrl(null);
      setAudioBlob(null);
      setRecordingDuration(0);
      setTranscriptDraft('');
      setIsReviewed(false);
      setErrorMessage(null);
    } else {
      stopRecordingCleanup();
    }
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
    setIsPlaying(false);
  };

  useEffect(()=>()=>{stopRecordingCleanup();mediaRecorderRef.current?.stream.getTracks().forEach(track=>track.stop());audioElementRef.current?.pause();},[]);

  const startRecording = async () => {
    setErrorMessage(null);
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscriptDraft('');
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Audio recording is not supported on this browser/device. You can use standard iPad keyboard dictation directly in the note field.');
        return;
      }

      // Feature-detect supported mimeTypes
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Save privately into IndexedDB
        if (voiceNoteId) {
          try{await saveVoiceBlob(voiceNoteId, blob, mimeType);}catch{setErrorMessage('Audio could not be stored. Keep a typed note; the recording is not backed up.');}
        }
      };

      mediaRecorder.start(250); // Collect 250ms chunks
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer (3 minutes max limit)
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 180) { // 3 minutes limit
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setErrorMessage(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone permission was denied. You can enable it in iPad Safari Settings, or use iPad keyboard dictation.'
          : 'Could not start audio recording: ' + (err.message || 'Unknown device error')
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handlePlayToggle = () => {
    if (!audioElementRef.current && audioUrl) {
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    } else if (audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElementRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTranscribeWithGemini = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      // Convert audioBlob to Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Call server-side Gemini transcription endpoint with actual audio data
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Data,
          mimeType: audioBlob.type || 'audio/webm',

          courseId,
          voiceNoteId,
          duration: recordingDuration,
        }),
      });

      const data = await response.json();
      if (data.success && data.transcript) {
        setTranscriptDraft(data.transcript);
      } else {
        // Never invent student evidence on failure; show clear error and keep source intact
        setErrorMessage(data.error || 'Gemini audio transcription is currently unavailable. Please enter your transcript manually.');
      }
    } catch (err: any) {
      console.warn('Transcription service error:', err);
      setErrorMessage(err.message || 'Gemini service offline; check network or server configuration.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAcceptAndApply = () => {
    if (!transcriptDraft.trim() || !isReviewed) return;
    onAcceptTranscriptAsNote(transcriptDraft.trim(), voiceNoteId);
    onClose();
  };

  const handleDeleteRecording = async () => {
    if (voiceNoteId) {
      await deleteVoiceBlob(voiceNoteId);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingDuration(0);
    setTranscriptDraft('');
    setIsReviewed(false);
  };

  if (!isOpen) return null;

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Voice Note & Dictation</h3>
              <p className="text-xs text-slate-500">Audio capture for {learnerName} ({courseId})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* iPad Dictation Instructions Notice */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs text-slate-700">
          <div className="flex items-center space-x-2 font-bold text-slate-900">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>iPad Keyboard Dictation is Always Available:</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Tap directly into any text note field and tap the microphone icon <Mic className="w-3 h-3 inline text-indigo-600 mx-0.5" /> on the on-screen iPad keyboard to dictate speech into text in real-time.
          </p>
        </div>

        {/* Recording Controls */}
        <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 text-center space-y-4">
          
          {/* Recording Timer / State */}
          <div className="flex items-center justify-center space-x-2 text-sm font-extrabold text-slate-800">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>{formatSeconds(recordingDuration)} / 3:00 Max</span>
            {isRecording && (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>Recording...</span>
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center space-x-3">
            {!isRecording && !audioUrl && (
              <button
                type="button"
                onClick={startRecording}
                className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md flex items-center space-x-2 transition-all min-h-[44px]"
              >
                <Mic className="w-4 h-4" />
                <span>Record Voice Note</span>
              </button>
            )}

            {isRecording && (
              <button
                type="button"
                onClick={stopRecording}
                className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-md flex items-center space-x-2 transition-all min-h-[44px]"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Recording</span>
              </button>
            )}

            {audioUrl && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePlayToggle}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 min-h-[44px]"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'Pause' : 'Play Clip'}</span>
                </button>

                <button
                  type="button"
                  onClick={startRecording}
                  className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center space-x-1 min-h-[44px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-record</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteRecording}
                  className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 font-bold min-h-[44px]"
                  title="Delete recording"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Privacy Note */}
          <p className="text-[10px] text-slate-400">
            Audio is stored in private local storage. Raw audio bytes are never placed in public cells or spreadsheet worksheets.
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Transcription Section */}
        {audioUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Transcript Draft (Review required before evidence use):</span>
              <button
                type="button"
                onClick={handleTranscribeWithGemini}
                disabled={isTranscribing}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center space-x-1 border border-indigo-200 transition-all min-h-[36px]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isTranscribing ? 'Transcribing...' : 'Transcribe with Gemini'}</span>
              </button>
            </div>

            {transcriptDraft && (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={transcriptDraft}
                  onChange={(e) => {
                    setTranscriptDraft(e.target.value);
                    setIsReviewed(true);
                  }}
                  placeholder="Review and edit transcript text..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                />

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Check className={`w-3.5 h-3.5 ${isReviewed ? 'text-emerald-600 font-bold' : 'text-slate-400'}`} />
                    <span>{isReviewed ? 'Teacher reviewed' : 'Unreviewed draft'}</span>
                  </span>
                  <span>Audio ID: <span className="font-mono text-[10px]">{voiceNoteId.slice(0, 12)}...</span></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs min-h-[44px]"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleAcceptAndApply}
            disabled={!transcriptDraft.trim()}
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm min-h-[44px]"
          >
            <Check className="w-4 h-4" />
            <span>Apply Transcript to Note</span>
          </button>
        </div>

      </div>
    </div>
  );
};
