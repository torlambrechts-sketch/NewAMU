// VoiceComposer — MediaRecorder-based voice intake. Stores the audio Blob
// in component state until the parent submits; then the parent uploads to
// the alert-attachments bucket and (optionally) requests a Whisper
// transcription via the alerts-voice-transcribe edge function.
//
// No pitch-shift / anonymisation per the design handover's "Deferred
// (Post-v1)" list.

import { useEffect, useRef, useState } from 'react'

type Props = {
  lang: 'nb' | 'en'
  onChange: (blob: Blob | null, transcribe: boolean) => void
  /** Whisper toggle visible only when the edge function is enabled. */
  transcriptionEnabled: boolean
  maxSeconds?: number
}

const COPY = {
  nb: {
    title: 'Spill inn taleopptak (valgfritt)',
    body: 'Maks 5 minutter. Lyden lagres kryptert sammen med saken.',
    start: 'Start opptak',
    stop: 'Stopp opptak',
    discard: 'Slett opptak',
    reRecord: 'Spill inn på nytt',
    duration: 'Lengde',
    transcribe: 'Lag tekst-transkript via OpenAI Whisper (krever opt-in)',
    transcribeOff: 'Transkripsjon avskrudd — kun lyd lagres',
    permissionDenied: 'Mikrofontilgang nektet. Sjekk nettleserens innstillinger.',
    noMediaRecorder: 'Nettleseren støtter ikke opptak. Bruk en moderne nettleser.',
  },
  en: {
    title: 'Voice recording (optional)',
    body: 'Up to 5 minutes. Audio is stored encrypted with the case.',
    start: 'Start recording',
    stop: 'Stop recording',
    discard: 'Discard recording',
    reRecord: 'Record again',
    duration: 'Duration',
    transcribe: 'Generate text transcript via OpenAI Whisper (opt-in required)',
    transcribeOff: 'Transcription disabled — only audio is stored',
    permissionDenied: 'Microphone access denied. Check browser settings.',
    noMediaRecorder: 'Your browser does not support recording.',
  },
}

export function VoiceComposer({ lang, onChange, transcriptionEnabled, maxSeconds = 300 }: Props) {
  const copy = COPY[lang]
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [transcribe, setTranscribe] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const tickRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (tickRef.current) window.clearInterval(tickRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function isSupported(): boolean {
    return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
  }

  async function start() {
    setError(null)
    if (!isSupported()) {
      setError(copy.noMediaRecorder)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime })
        setBlob(b)
        onChange(b, transcribe)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setSeconds(0)
      tickRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= maxSeconds) {
            stop()
            return maxSeconds
          }
          return s + 1
        })
      }, 1000)
    } catch (e) {
      setError(`${copy.permissionDenied} ${String((e as Error)?.message ?? '')}`)
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    setRecording(false)
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  function discard() {
    setBlob(null)
    setSeconds(0)
    onChange(null, transcribe)
  }

  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-white p-4">
      <div className="text-sm font-semibold">{copy.title}</div>
      <p className="text-xs text-neutral-600">{copy.body}</p>
      {error && <div className="mt-2 text-xs text-red-700">{error}</div>}
      <div className="mt-3 flex items-center gap-3">
        {!recording && !blob && (
          <button
            type="button"
            onClick={start}
            className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
          >
            ● {copy.start}
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stop}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            ■ {copy.stop} ({formatDuration(seconds)})
          </button>
        )}
        {!recording && blob && (
          <>
            <span className="text-xs text-neutral-700">
              {copy.duration}: {formatDuration(seconds)}
            </span>
            <audio controls src={URL.createObjectURL(blob)} className="h-8" />
            <button
              type="button"
              onClick={discard}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50"
            >
              {copy.discard}
            </button>
            <button
              type="button"
              onClick={() => {
                discard()
                start()
              }}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50"
            >
              {copy.reRecord}
            </button>
          </>
        )}
      </div>
      {transcriptionEnabled ? (
        <label className="mt-3 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={transcribe}
            onChange={(e) => {
              setTranscribe(e.target.checked)
              onChange(blob, e.target.checked)
            }}
            className="mt-0.5"
          />
          <span>{copy.transcribe}</span>
        </label>
      ) : (
        <p className="mt-3 text-xs italic text-neutral-500">{copy.transcribeOff}</p>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
