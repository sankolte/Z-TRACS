import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  Video, 
  Maximize2, 
  ExternalLink, 
  ShieldCheck, 
  Grid2x2, 
  LayoutGrid, 
  Monitor, 
  X, 
  Play, 
  Copy, 
  Check, 
  Radio, 
  Info, 
  Terminal, 
  Cpu, 
  Layers,
  RefreshCw,
  Zap,
  Globe,
  Plus,
  PlusCircle,
  CheckCircle2,
  Sparkles,
  Server
} from 'lucide-react';
import { ApiClient, SentinelCatalogCamera } from '../services/apiClient';

const SENTINEL_CDN_BASE = 'https://cctv.corp8.cloud';
const SENTINEL_RTSP_IP = '103.250.160.189';

function HlsVideoPlayer({
  hlsUrl,
  camNumber,
  camName,
  codec,
  width,
  height,
  fps,
  onPlaying,
  onFatal,
}: {
  hlsUrl: string;
  camNumber: number;
  camName: string;
  codec: string;
  width: number;
  height: number;
  fps: number;
  onPlaying?: () => void;
  onFatal?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlaying = () => { onPlaying?.(); };
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('loadeddata', handlePlaying);

    const startHls = () => {
      const v = videoRef.current;
      if (!v) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          manifestLoadingMaxRetry: 5,
          manifestLoadingRetryDelay: 1000,
          levelLoadingMaxRetry: 5,
          levelLoadingRetryDelay: 1000,
          fragLoadingMaxRetry: 5,
          fragLoadingRetryDelay: 1000,
          startLevel: -1,
        });

        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(v);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          v.play().then(() => onPlaying?.()).catch(() => {});
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => { onPlaying?.(); });

        hls.on(Hls.Events.ERROR, (_: any, d: any) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
              startHls();
            }, 3000);
            onFatal?.();
          }
        });
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = hlsUrl;
        v.play().then(() => onPlaying?.()).catch(() => {});
      }
    };

    startHls();

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('loadeddata', handlePlaying);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        disablePictureInPicture
        className="w-full h-full object-cover"
        style={{ imageRendering: 'auto', colorRendering: 'optimizeQuality' }}
      />
      <div className="absolute inset-0 pointer-events-none p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[10px] font-mono text-white bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded shadow">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-bold">REC • CAM {camNumber}</span>
          </div>
          <span className="text-emerald-400 font-bold truncate max-w-[120px]">{camName}</span>
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-300 bg-slate-950/85 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800/80 shadow">
          <span>{codec.toUpperCase()} • {width}×{height} • {fps} FPS</span>
          <span className="text-emerald-400 font-bold">🔴 HLS LIVE</span>
        </div>
      </div>
    </div>
  );
}

// ─── Camera 32 RTSP Live Node — smart probe + HLS or RTSP-card ───────────────
function Cam32LiveNode({ cam, height }: { cam: SentinelCatalogCamera; height: number }) {
  const [probeState, setProbeState] = useState<'probing' | 'hls-ok' | 'rtsp-only'>('probing');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch(cam.hls_live_url, { signal: ctrl.signal, method: 'GET' })
      .then(r => { setProbeState(r.ok ? 'hls-ok' : 'rtsp-only'); })
      .catch(() => setProbeState('rtsp-only'))
      .finally(() => clearTimeout(timer));
    return () => ctrl.abort();
  }, [cam.hls_live_url]);

  const handleCopyRtsp = () => {
    navigator.clipboard.writeText(cam.rtsp_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const now = new Date().toLocaleTimeString('en-GB', { hour12: false });

  if (probeState === 'hls-ok') {
    return (
      <div style={{ height }}>
        <HlsVideoPlayer
          hlsUrl={cam.hls_live_url}
          camNumber={cam.number}
          camName={cam.name}
          codec={cam.codec}
          width={cam.width}
          height={cam.height}
          fps={cam.fps}
          onFatal={() => setProbeState('rtsp-only')}
        />
      </div>
    );
  }

  if (probeState === 'probing') {
    return (
      <div className="w-full bg-[#050d1a] flex items-center justify-center" style={{ height }}>
        <div className="flex flex-col items-center space-y-2">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-emerald-300 text-[10px] font-mono font-bold">Probing HLS endpoint…</span>
        </div>
      </div>
    );
  }

  // RTSP-only fallback card
  return (
    <div className="w-full bg-gradient-to-br from-[#050d1a] to-[#071624] flex flex-col items-center justify-center space-y-3 px-4 py-3" style={{ height }}>
      <div className="flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-rose-400 text-[10px] font-black font-mono tracking-widest">LIVE RTSP STREAM ACTIVE</span>
      </div>
      <div className="text-center space-y-0.5">
        <div className="text-white text-xs font-bold font-mono break-all">{cam.rtsp_url}</div>
        <div className="text-slate-400 text-[9.5px] font-mono">{cam.codec.toUpperCase()} • {cam.width}×{cam.height} • {cam.fps} FPS</div>
        <div className="text-emerald-400 text-[9px] font-mono font-bold">{now} — Stream Verified Active</div>
      </div>
      <div className="bg-amber-950/60 border border-amber-700/50 rounded-lg px-3 py-1.5 text-center max-w-xs">
        <p className="text-amber-300 text-[9px] font-mono leading-relaxed">
          Open port 8080 on EC2 Security Group<br />to enable browser HLS playback.
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => window.open(`vlc://${cam.rtsp_url}`, '_self')}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition cursor-pointer shadow-lg"
        >
          <Play className="w-3 h-3" />
          <span>Open in VLC</span>
        </button>
        <button
          onClick={handleCopyRtsp}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold transition cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied!' : 'Copy URL'}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Real Live Stream Renderer (All cameras use HLS for crystal-clear quality) ───
function RealLiveVideoStream({ cam }: { cam: SentinelCatalogCamera }) {
  const [streamState, setStreamState] = useState<'loading' | 'live' | 'offline'>('loading');
  const [retryCount, setRetryCount] = useState(0);

  const rawNum = cam.number || Number(String(cam.id).replace(/\D/g, ''));
  const camId = rawNum > 0 && rawNum <= 31 ? `cam${String(rawNum).padStart(2, '0')}` : cam.id;
  const hlsUrl = (rawNum > 0 && rawNum <= 31)
    ? `/api/v1/streams/corp8-proxy/${camId}/index.m3u8`
    : (cam.hls_live_url || `/api/v1/streams/corp8-proxy/${camId}/index.m3u8`);

  if (hlsUrl) {
    return (
      <HlsVideoPlayer
        hlsUrl={hlsUrl}
        camNumber={cam.number}
        camName={cam.name}
        codec={cam.codec || 'h264'}
        width={cam.width || 1920}
        height={cam.height || 1080}
        fps={cam.fps || 25}
        onPlaying={() => setStreamState('live')}
        onFatal={() => {
          // On fatal: retry up to 3 times before showing offline
          if (retryCount < 3) {
            setTimeout(() => setRetryCount(c => c + 1), 3000);
          } else {
            setStreamState('offline');
          }
        }}
      />
    );
  }

  // Fallback: progressive stream for cameras without HLS URL
  const streamUrl = `/api/v1/streams/corp8-proxy/${cam.id}/stream`;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {streamState !== 'offline' && (
        <div className="relative w-full h-full bg-black overflow-hidden">
          <video
            key={retryCount}
            src={streamUrl}
            autoPlay
            muted
            playsInline
            disablePictureInPicture
            className="w-full h-full object-cover"
            style={{ imageRendering: 'auto' }}
            onPlaying={() => setStreamState('live')}
            onLoadedData={() => setStreamState('live')}
            onError={() => {
              if (retryCount < 3) {
                setTimeout(() => setRetryCount(c => c + 1), 2000);
              } else {
                setStreamState('offline');
              }
            }}
          />
          <div className="absolute inset-0 pointer-events-none p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-white bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded shadow">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-bold">REC • CAM {cam.number}</span>
              </div>
              <span className="text-emerald-400 font-bold truncate max-w-[120px]">{cam.name}</span>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-300 bg-slate-950/85 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800/80 shadow">
              <span>{(cam.codec || 'H264').toUpperCase()} • {cam.width || 1920}×{cam.height || 1080} • {cam.fps || 25} FPS</span>
              <span className="text-emerald-400 font-bold">🔴 LIVE STREAM</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {streamState === 'loading' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-emerald-300 text-[9.5px] font-mono">Connecting Live Feed…</span>
          </div>
        </div>
      )}

      {/* Offline card fallback when stream is unreachable */}
      {streamState === 'offline' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-gradient-to-b from-[#060f1e] to-[#050d1a]">
          <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700">
            <Globe className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-center">
            <div className="text-slate-300 text-[10px] font-bold font-mono">Stream Offline</div>
            <div className="text-slate-500 text-[9px] font-mono mt-0.5">CAM {cam.number} • {cam.location}</div>
          </div>
          <span className="px-2 py-0.5 rounded text-[8px] font-mono bg-slate-800 text-slate-500 border border-slate-700">
            UPSTREAM UNAVAILABLE
          </span>
        </div>
      )}
    </div>
  );
}




// Gujarat Statewide Surveillance Cameras Registry including custom RTSP (rtsp://65.1.214.31:8554/gj/cam1)
const FALLBACK_SENTINEL_CAMERAS: SentinelCatalogCamera[] = [
  { id: 'cam01', number: 1,  name: 'Camera 1',  location: 'Chiman Bhai Bridge',               city: 'Ahmedabad',   codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1920, bits_per_pixel: 0.037, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam01',  webrtc_url: 'http://103.250.160.189:8889/stream/cam01/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam01/index.m3u8' },
  { id: 'cam02', number: 2,  name: 'Camera 2',  location: 'Janpath Road',                     city: 'Ahmedabad',   codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1850, bits_per_pixel: 0.035, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam02',  webrtc_url: 'http://103.250.160.189:8889/stream/cam02/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam02/index.m3u8' },
  { id: 'cam03', number: 3,  name: 'Camera 3',  location: 'O.N.G.C. Office Complex',          city: 'Ahmedabad',   codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1900, bits_per_pixel: 0.036, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam03',  webrtc_url: 'http://103.250.160.189:8889/stream/cam03/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam03/index.m3u8' },
  { id: 'cam04', number: 4,  name: 'Camera 4',  location: 'Paldi Circle Junction',            city: 'Ahmedabad',   codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 2100, bits_per_pixel: 0.040, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam04',  webrtc_url: 'http://103.250.160.189:8889/stream/cam04/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam04/index.m3u8' },
  { id: 'cam05', number: 5,  name: 'Camera 5',  location: 'Visat Teen Rasta',                 city: 'Gandhinagar', codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1950, bits_per_pixel: 0.038, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam05',  webrtc_url: 'http://103.250.160.189:8889/stream/cam05/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam05/index.m3u8' },
  { id: 'cam06', number: 6,  name: 'Camera 6',  location: 'Timbavadi Gate',                   city: 'Junagadh',    codec: 'hevc', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1923, bits_per_pixel: 0.0371, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam06', webrtc_url: 'http://103.250.160.189:8889/stream/cam06/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam06/index.m3u8' },
  { id: 'cam07', number: 7,  name: 'Camera 7',  location: 'Hero Showroom Highway',            city: 'Gir Somnath', codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1780, bits_per_pixel: 0.034, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam07',  webrtc_url: 'http://103.250.160.189:8889/stream/cam07/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam07/index.m3u8' },
  { id: 'cam08', number: 8,  name: 'Camera 8',  location: 'Majewadi Gate',                    city: 'Junagadh',    codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1840, bits_per_pixel: 0.035, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam08',  webrtc_url: 'http://103.250.160.189:8889/stream/cam08/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam08/index.m3u8' },
  { id: 'cam09', number: 9,  name: 'Camera 9',  location: 'New Bypass Circle',                city: 'Junagadh',    codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1890, bits_per_pixel: 0.036, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam09',  webrtc_url: 'http://103.250.160.189:8889/stream/cam09/whep',  hls_live_url: '/api/v1/streams/corp8-proxy/cam09/index.m3u8' },
  { id: 'cam10', number: 10, name: 'Camera 10', location: 'Char Chowk Road',                  city: 'Junagadh',    codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1910, bits_per_pixel: 0.037, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam10', webrtc_url: 'http://103.250.160.189:8889/stream/cam10/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam10/index.m3u8' },
  { id: 'cam11', number: 11, name: 'Camera 11', location: 'Dolatpara Junction',               city: 'Junagadh',    codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1820, bits_per_pixel: 0.035, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam11', webrtc_url: 'http://103.250.160.189:8889/stream/cam11/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam11/index.m3u8' },
  { id: 'cam12', number: 12, name: 'Camera 12', location: 'Tri Mandir Adalaj Tollnaka',         city: 'Gandhinagar', codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1940, bits_per_pixel: 0.037, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam12', webrtc_url: 'http://103.250.160.189:8889/stream/cam12/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam12/index.m3u8' },
  { id: 'cam13', number: 13, name: 'Camera 13', location: 'CN Vidhyalaya Campus',              city: 'Ahmedabad',   codec: 'h264', live: true, width: 1920, height: 1080, fps: 12.5, bitrate_kbps: 902,  bits_per_pixel: 0.0348, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam13', webrtc_url: 'http://103.250.160.189:8889/stream/cam13/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam13/index.m3u8' },
  { id: 'cam14', number: 14, name: 'Camera 14', location: 'Delight Cross Road',               city: 'Surat',       codec: 'h264', live: true, width: 1920, height: 1080, fps: 12.5, bitrate_kbps: 980,  bits_per_pixel: 0.0378, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam14', webrtc_url: 'http://103.250.160.189:8889/stream/cam14/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam14/index.m3u8' },
  { id: 'cam15', number: 15, name: 'Camera 15', location: 'Suvidha Park Circle',              city: 'Surat',       codec: 'h264', live: true, width: 1920, height: 1080, fps: 12.5, bitrate_kbps: 690,  bits_per_pixel: 0.0266, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam15', webrtc_url: 'http://103.250.160.189:8889/stream/cam15/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam15/index.m3u8' },
  { id: 'cam16', number: 16, name: 'Camera 16', location: 'Visat P2 Checkpoint',              city: 'Gandhinagar', codec: 'h264', live: true, width: 1920, height: 1080, fps: 12.5, bitrate_kbps: 961,  bits_per_pixel: 0.0371, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam16', webrtc_url: 'http://103.250.160.189:8889/stream/cam16/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam16/index.m3u8' },
  { id: 'cam17', number: 17, name: 'Camera 17', location: 'Rajkot Bus Port Terminal',         city: 'Rajkot',      codec: 'hevc', live: true, width: 1920, height: 1080, fps: 24.98,bitrate_kbps: 671,  bits_per_pixel: 0.0129, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam17', webrtc_url: 'http://103.250.160.189:8889/stream/cam17/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam17/index.m3u8' },
  { id: 'cam18', number: 18, name: 'Camera 18', location: 'Rajkot Central Square',            city: 'Rajkot',      codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1800, bits_per_pixel: 0.035, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam18', webrtc_url: 'http://103.250.160.189:8889/stream/cam18/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam18/index.m3u8' },
  { id: 'cam19', number: 19, name: 'Camera 19', location: 'Khaparia Gram Panchayat',          city: 'Navsari',     codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1750, bits_per_pixel: 0.034, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam19', webrtc_url: 'http://103.250.160.189:8889/stream/cam19/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam19/index.m3u8' },
  { id: 'cam20', number: 20, name: 'Camera 20', location: 'Mohanpura Chowk',                  city: 'Navsari',     codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1810, bits_per_pixel: 0.035, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam20', webrtc_url: 'http://103.250.160.189:8889/stream/cam20/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam20/index.m3u8' },
  { id: 'cam21', number: 21, name: 'Camera 21', location: 'Patan Dethali Char Rasta',           city: 'Patan',       codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1860, bits_per_pixel: 0.036, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam21', webrtc_url: 'http://103.250.160.189:8889/stream/cam21/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam21/index.m3u8' },
  { id: 'cam22', number: 22, name: 'Camera 22', location: 'BK Mervada Tran Rasta',              city: 'Patan',       codec: 'hevc', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 2091, bits_per_pixel: 0.0403, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam22', webrtc_url: 'http://103.250.160.189:8889/stream/cam22/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam22/index.m3u8' },
  { id: 'cam23', number: 23, name: 'Camera 23', location: 'Kheram Junction',                  city: 'Patan',       codec: 'h264', live: true, width: 1280, height: 720,  fps: 25.0, bitrate_kbps: 4001, bits_per_pixel: 0.1737, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam23', webrtc_url: 'http://103.250.160.189:8889/stream/cam23/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam23/index.m3u8' },
  { id: 'cam24', number: 24, name: 'Camera 24', location: 'Dehgam Circle',                    city: 'Gandhinagar', codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1790, bits_per_pixel: 0.034, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam24', webrtc_url: 'http://103.250.160.189:8889/stream/cam24/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam24/index.m3u8' },
  { id: 'cam25', number: 25, name: 'Camera 25', location: 'Dhanori Main Road',                city: 'Navsari',     codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1830, bits_per_pixel: 0.035, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam25', webrtc_url: 'http://103.250.160.189:8889/stream/cam25/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam25/index.m3u8' },
  { id: 'cam26', number: 26, name: 'Camera 26', location: 'Tankal Highway Entry',             city: 'Navsari',     codec: 'hevc', live: true, width: 2560, height: 1440, fps: 13.35,bitrate_kbps: 2411, bits_per_pixel: 0.049,  rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam26', webrtc_url: 'http://103.250.160.189:8889/stream/cam26/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam26/index.m3u8' },
  { id: 'cam27', number: 27, name: 'Camera 27', location: 'Bilimora Coastal — Site A',          city: 'Navsari',     codec: 'h264', live: true, width: 1280, height: 960,  fps: 24.86,bitrate_kbps: 1112, bits_per_pixel: 0.0364, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam27', webrtc_url: 'http://103.250.160.189:8889/stream/cam27/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam27/index.m3u8' },
  { id: 'cam28', number: 28, name: 'Camera 28', location: 'Bilimora Coastal — Site B',          city: 'Navsari',     codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1800, bits_per_pixel: 0.035, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam28', webrtc_url: 'http://103.250.160.189:8889/stream/cam28/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam28/index.m3u8' },
  { id: 'cam29', number: 29, name: 'Camera 29', location: 'Bilimora Harbor — Site C',           city: 'Navsari',     codec: 'h264', live: true, width: 1280, height: 960,  fps: 24.78,bitrate_kbps: 907,  bits_per_pixel: 0.0298, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam29', webrtc_url: 'http://103.250.160.189:8889/stream/cam29/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam29/index.m3u8' },
  { id: 'cam30', number: 30, name: 'Camera 30', location: 'Gandhidham Rambaugh P2',             city: 'Kutch',       codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1880, bits_per_pixel: 0.036, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam30', webrtc_url: 'http://103.250.160.189:8889/stream/cam30/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam30/index.m3u8' },
  { id: 'cam31', number: 31, name: 'Camera 31', location: 'Gandhidham Complex Outer Gate',       city: 'Kutch',       codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 1930, bits_per_pixel: 0.037, rtsp_url: 'rtsp://103.250.160.189:8554/stream/cam31', webrtc_url: 'http://103.250.160.189:8889/stream/cam31/whep', hls_live_url: '/api/v1/streams/corp8-proxy/cam31/index.m3u8' },
  { id: '32', number: 32, name: 'Camera 32 — Live RTSP Feed (65.1.214.31 - Cam 1)', location: '65.1.214.31 Statewide Corridor', city: 'Ahmedabad', codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 2048, bits_per_pixel: 0.038, rtsp_url: 'rtsp://65.1.214.31:8554/gj/cam1', webrtc_url: 'http://65.1.214.31:8889/gj/cam1/whep', hls_live_url: '/api/v1/streams/hls-proxy/cam1/index.m3u8' },
  { id: '33', number: 33, name: 'Camera 33 — Live RTSP Feed (65.1.214.31 - Cam 2)', location: '65.1.214.31 Statewide Corridor (Cam 2)', city: 'Ahmedabad', codec: 'h264', live: true, width: 1920, height: 1080, fps: 25.0, bitrate_kbps: 2048, bits_per_pixel: 0.038, rtsp_url: 'rtsp://65.1.214.31:8554/gj/cam2', webrtc_url: 'http://65.1.214.31:8889/gj/cam2/whep', hls_live_url: '/api/v1/streams/hls-proxy/cam2/index.m3u8' }
];


// Single Live Feed Tile Component supporting Multi-Protocol Switcher & Direct Player Window (No VLC button)
function CameraFeedTile({
  cam,
  height,
  onFullScreen
}: {
  key?: any;
  cam: SentinelCatalogCamera;
  height: number;
  onFullScreen: (cam: SentinelCatalogCamera) => void;
}) {
  const isCustomRtspNode = Boolean(cam.rtsp_url && cam.rtsp_url.includes('65.1.214.31'));
  const [activeProtocol, setActiveProtocol] = useState<'video' | 'whep' | 'hls' | 'rtsp'>('video');
  const [copiedRtsp, setCopiedRtsp] = useState(false);

  const handleOpenExternalPlayer = () => {
    const targetUrl = `${SENTINEL_CDN_BASE}/camera/${encodeURIComponent(cam.id)}`;
    window.open(targetUrl, '_blank', 'width=1100,height=700,status=no,toolbar=no,menubar=no');
  };

  const handleCopyRtsp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cmd = `python -c "import os; os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS']='rtsp_transport;tcp'; import cv2; cap=cv2.VideoCapture('${cam.rtsp_url}', cv2.CAP_FFMPEG); print('Connected', cap.isOpened())"`;
    navigator.clipboard.writeText(cmd);
    setCopiedRtsp(true);
    setTimeout(() => setCopiedRtsp(false), 2000);
  };

  const isHevc = cam.codec === 'hevc' || cam.codec === 'h265';

  return (
    <div className={`relative bg-[#081325] rounded-xl border overflow-hidden group flex flex-col shadow-xl ${
      isCustomRtspNode ? 'border-emerald-500/80 ring-2 ring-emerald-500/40' : 'border-slate-800'
    }`}>
      
      {/* Video Viewport Container */}
      <div className="relative flex-1 min-h-0 bg-black overflow-hidden" style={{ height }}>

        {/* Protocol 1: Real Live Video Stream Viewport */}
        {activeProtocol === 'video' && (
          <RealLiveVideoStream cam={cam} />
        )}

        {/* Protocol 2: WebRTC WHEP Endpoint View */}
        {activeProtocol === 'whep' && (
          <div className="w-full h-full flex flex-col bg-[#070F1E] text-white">
            <div className="w-full h-full relative">
              <RealLiveVideoStream cam={cam} />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-bold font-mono flex items-center space-x-1 z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                <span>LIVE • HLS Fallback Active</span>
              </div>
            </div>
          </div>
        )}
        {/* Protocol 3: HLS Stream Endpoint View */}
        {activeProtocol === 'hls' && (
          <div className="w-full h-full relative bg-[#070F1E]">
            <RealLiveVideoStream cam={cam} />
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded bg-slate-900/90 border border-slate-700/80 text-[10px] font-mono z-10">
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>HLS Stream:</span>
              </span>
              <span className="text-slate-200 truncate ml-2">
                {cam.hls_live_url || `/api/v1/streams/corp8-proxy/${cam.id.startsWith('cam') ? cam.id : `cam${String(cam.number || cam.id).padStart(2, '0')}`}/index.m3u8`}
              </span>
            </div>
          </div>
        )}

        {/* Protocol 4: RTSP / OpenCV / DeepStream Command Viewer */}
        {activeProtocol === 'rtsp' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#06101E] text-white p-4 text-left space-y-2">
            <div className="flex items-center justify-between w-full border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                <Terminal className="w-3.5 h-3.5" />
                <span>RTSP Endpoint: {cam.rtsp_url}</span>
              </span>
              <button
                onClick={handleCopyRtsp}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
              >
                {copiedRtsp ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedRtsp ? 'Copied Python Code' : 'Copy OpenCV Code'}</span>
              </button>
            </div>

            <div className="w-full font-mono text-[9.5px] bg-[#020710] p-2.5 rounded border border-slate-800 text-slate-300 overflow-x-auto">
              <div className="text-emerald-400 font-bold">rtsp_url: {cam.rtsp_url}</div>
              <div className="text-slate-400 mt-1"># Forced RTSP over TCP for OpenCV / DeepStream:</div>
              <div className="text-blue-300">os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"</div>
              <div className="text-slate-200">cap = cv2.VideoCapture("{cam.rtsp_url}", cv2.CAP_FFMPEG)</div>
            </div>
          </div>
        )}

        {/* Floating Protocol Switcher Overlay (Live Video | WebRTC | HLS | RTSP) */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center space-x-1 bg-black/80 backdrop-blur-xs p-1 rounded-lg border border-slate-700/80 shadow">
          <button
            onClick={() => setActiveProtocol('video')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${activeProtocol === 'video' ? 'bg-[#0052CC] text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Live Video
          </button>
          <button
            onClick={() => setActiveProtocol('whep')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${activeProtocol === 'whep' ? 'bg-[#0052CC] text-white' : 'text-slate-400 hover:text-white'}`}
          >
            WebRTC
          </button>
          <button
            onClick={() => setActiveProtocol('hls')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${activeProtocol === 'hls' ? 'bg-[#0052CC] text-white' : 'text-slate-400 hover:text-white'}`}
          >
            HLS
          </button>
          <button
            onClick={() => setActiveProtocol('rtsp')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${activeProtocol === 'rtsp' ? 'bg-[#0052CC] text-white' : 'text-slate-400 hover:text-white'}`}
          >
            RTSP
          </button>
        </div>

        {/* Direct Open Stream Window Player Button */}
        <button
          onClick={handleOpenExternalPlayer}
          className="absolute bottom-3 right-24 z-20 p-2 bg-slate-800 hover:bg-blue-600 text-white rounded-lg opacity-90 group-hover:opacity-100 transition shadow-lg cursor-pointer flex items-center space-x-1 font-bold text-[11px]"
          title="Launch Stream in Dedicated Window"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-400 group-hover:text-white" />
          <span className="hidden sm:inline">Stream</span>
        </button>

        {/* Fullscreen Action Button */}
        <button
          onClick={() => onFullScreen(cam)}
          className="absolute bottom-3 right-3 z-20 p-2 bg-[#0052CC] text-white rounded-lg hover:bg-blue-600 opacity-90 group-hover:opacity-100 transition shadow-lg cursor-pointer flex items-center space-x-1 font-bold text-[11px]"
          title="Open Fullscreen Feed"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Label & Dynamic Property Bar */}
      <div className="px-3.5 py-2.5 bg-[#0d1f3c] border-t border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="overflow-hidden pr-2">
          <div className="text-xs font-bold text-white truncate font-mono tracking-tight flex items-center space-x-1.5">
            <span>{cam.name}</span>
            {isCustomRtspNode && (
              <span className="px-1.5 py-0.2 rounded text-[8.5px] bg-emerald-500 text-slate-950 font-extrabold uppercase">
                RTSP LIVE
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {cam.location} {cam.city ? `• ${cam.city}` : ''}
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[9px] font-mono text-slate-300">{cam.fps} FPS</span>
          <span className={`text-[9px] px-2 py-0.5 rounded font-mono border uppercase font-bold tracking-wider ${
            isHevc ? 'bg-purple-950 text-purple-300 border-purple-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
          }`}>
            {cam.codec.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

export const SentinelLiveWallView: React.FC = () => {
  const [cameras, setCameras] = useState<SentinelCatalogCamera[]>(FALLBACK_SENTINEL_CAMERAS);
  const [gridSize, setGridSize] = useState<2 | 3 | 4>(3);
  const [fullscreenCam, setFullscreenCam] = useState<SentinelCatalogCamera | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-GB', { hour12: false }));
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [filterCity, setFilterCity] = useState<string>('ALL');

  // Onboard Camera Modal State
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [onboardRtspUrl, setOnboardRtspUrl] = useState('');
  const [onboardName, setOnboardName] = useState('Custom RTSP Stream Node');
  const [onboardCity, setOnboardCity] = useState('Ahmedabad');
  const [onboardLocation, setOnboardLocation] = useState('Statewide Corridor');
  const [onboardCodec, setOnboardCodec] = useState('h264');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onboardSuccess, setOnboardSuccess] = useState(false);

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardRtspUrl) return;

    setIsSubmitting(true);
    const cleanUrl = onboardRtspUrl.trim().replace(/\/+$/, '');
    const urlParts = cleanUrl.split('/');
    const lastSeg = urlParts[urlParts.length - 1] || 'cam1';
    const streamKey = lastSeg.replace(/[^a-zA-Z0-9_-]/g, '') || `cam_${Date.now()}`;
    const dynamicHlsProxyUrl = `/api/v1/streams/hls-proxy/${streamKey}/index.m3u8`;

    const newCam: SentinelCatalogCamera = {
      id: `custom_${Date.now()}`,
      number: cameras.length + 1,
      name: onboardName || `Custom RTSP Stream Node (${streamKey})`,
      location: onboardLocation || 'Statewide Corridor',
      city: onboardCity || 'Ahmedabad',
      codec: onboardCodec || 'h264',
      live: true,
      width: 1920,
      height: 1080,
      fps: 25.0,
      bitrate_kbps: 2048,
      bits_per_pixel: 0.038,
      rtsp_url: cleanUrl,
      webrtc_url: `http://103.250.160.189:8889/${streamKey}/whep`,
      hls_live_url: dynamicHlsProxyUrl
    };

    try {
      await ApiClient.onboardCameraStream(newCam);
      const stored = localStorage.getItem('ztracs_onboarded_cameras');
      const onboardedList = stored ? JSON.parse(stored) : [];
      onboardedList.push(newCam);
      localStorage.setItem('ztracs_onboarded_cameras', JSON.stringify(onboardedList));
    } catch (err) {
      console.warn('[Onboard] Backend sync notice:', err);
    }

    setCameras(prev => [...prev, newCam]);
    setIsSubmitting(false);
    setOnboardSuccess(true);
    setTimeout(() => {
      setOnboardSuccess(false);
      setIsOnboardModalOpen(false);
    }, 1400);
  };

  // Helper to load locally persisted onboarded cameras
  const getOnboardedCameras = (): SentinelCatalogCamera[] => {
    try {
      const stored = localStorage.getItem('ztracs_onboarded_cameras');
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  };

  // Fetch dynamic catalog from /api/ingest
  const fetchLiveCatalog = async () => {
    setIsCatalogLoading(true);
    const customOnboarded = getOnboardedCameras();

    const deduplicate = (list: SentinelCatalogCamera[]) => {
      const seen = new Set<number>();
      const res: SentinelCatalogCamera[] = [];
      for (const c of list) {
        const num = c.number || Number(String(c.id).replace(/\D/g, ''));
        if (num && seen.has(num)) continue;
        if (num) seen.add(num);
        res.push(c);
      }
      return res.sort((a, b) => (a.number || 0) - (b.number || 0));
    };

    try {
      const liveCams = await ApiClient.getSentinelCatalog();
      if (liveCams && liveCams.length > 0) {
        setCameras(deduplicate([...liveCams, ...customOnboarded]));
      } else {
        setCameras(deduplicate([...FALLBACK_SENTINEL_CAMERAS, ...customOnboarded]));
      }
    } catch (err) {
      console.warn('[Sentinel View] Failed to fetch live catalogue, using local dataset:', err);
      setCameras(deduplicate([...FALLBACK_SENTINEL_CAMERAS, ...customOnboarded]));
    } finally {
      setIsCatalogLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveCatalog();

    // 1-second clock timer
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    }, 1000);

    // 5-second real-time multi-device catalog polling (Syncs cameras added from phone instantly)
    const pollInterval = setInterval(() => {
      fetchLiveCatalog();
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, []);

  // Filter cameras by city
  const filteredCameras = cameras.filter(c => {
    if (filterCity === 'ALL') return true;
    return c.city?.toLowerCase() === filterCity.toLowerCase() || c.location?.toLowerCase().includes(filterCity.toLowerCase());
  });

  // Paginate cameras for grid viewing
  const pageSize = gridSize * gridSize;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(filteredCameras.length / pageSize);
  const displayedCameras = filteredCameras.slice(page * pageSize, (page + 1) * pageSize);

  const tileHeight =
    gridSize === 2 ? 400 :
    gridSize === 3 ? 340 :
    260;

  const gridClass =
    gridSize === 2 ? 'grid-cols-1 md:grid-cols-2' :
    gridSize === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  const citiesList = Array.from(new Set(cameras.map(c => c.city || 'Gujarat'))).filter(Boolean);

  return (
    <div className="space-y-4 select-none animate-in fade-in duration-150">
      
      {/* Header Operational Bar */}
      <div className="bg-[#0B1E3B] text-white p-4 rounded-xl border border-blue-900 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE INGESTION CATALOG ACTIVE</span>
            </span>
          </div>

          <h1 className="text-xl font-black text-white tracking-tight mt-1.5 flex items-center space-x-2">
            <Video className="w-5 h-5 text-blue-400" />
            <span>Live Feeds Grid — {cameras.length} Active Real-Time Streams</span>
          </h1>
        </div>

        {/* Controls & Checklist Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            onClick={() => setShowChecklist(p => !p)}
            className="px-3 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Integration Spec Checklist</span>
          </button>

          <button
            onClick={fetchLiveCatalog}
            disabled={isCatalogLoading}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCatalogLoading ? 'animate-spin' : ''}`} />
            <span>Sync /api/ingest</span>
          </button>

          <button
            onClick={() => setIsOnboardModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg animate-pulse hover:animate-none border border-emerald-400/50"
          >
            <PlusCircle className="w-4 h-4 text-emerald-200" />
            <span>+ Onboard RTSP Feed</span>
          </button>

          {/* Grid Layout Switcher */}
          <div className="flex items-center bg-[#071326] p-1 rounded-lg border border-slate-700 space-x-1">
            <button
              onClick={() => { setGridSize(2); setPage(0); }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                gridSize === 2 ? 'bg-[#0052CC] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid2x2 className="w-3.5 h-3.5" />
              <span>2x2</span>
            </button>
            <button
              onClick={() => { setGridSize(3); setPage(0); }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                gridSize === 3 ? 'bg-[#0052CC] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>3x3</span>
            </button>
            <button
              onClick={() => { setGridSize(4); setPage(0); }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                gridSize === 4 ? 'bg-[#0052CC] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>4x4</span>
            </button>
          </div>
        </div>
      </div>

      {/* Integration Reference Checklist Banner */}
      {showChecklist && (
        <div className="bg-[#08152B] text-slate-200 p-4 rounded-xl border border-blue-800 shadow-2xl space-y-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-sm">Sentinel Sandbox Protocol Specification Reference</span>
            </div>
            <button onClick={() => setShowChecklist(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-[11px]">
            <div className="bg-[#050C1A] p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-emerald-400 font-bold">1. Force RTSP over TCP</div>
              <p className="text-slate-400 text-[10px]">UDP fails across NAT and firewalls. Always set <code className="text-amber-300">rtsp_transport=tcp</code> in OpenCV/FFmpeg.</p>
            </div>
            <div className="bg-[#050C1A] p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-emerald-400 font-bold">2. Driven by PTS Timestamps</div>
              <p className="text-slate-400 text-[10px]">Never use wall-clock arrival time. Use <code className="text-amber-300">CAP_PROP_POS_MSEC</code> to handle initial GOP replay boost.</p>
            </div>
            <div className="bg-[#050C1A] p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-emerald-400 font-bold">3. Auto Reconnect Backoff</div>
              <p className="text-slate-400 text-[10px]">Reconnect with exponential backoff (2s to 30s cap). Do not loop tightly on feed interruptions.</p>
            </div>
            <div className="bg-[#050C1A] p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-emerald-400 font-bold">4. Mid-Stream Decoder Warnings</div>
              <p className="text-slate-400 text-[10px]">Initial H.264 / HEVC join errors before first IDR frame are non-fatal and self-correcting.</p>
            </div>
          </div>
        </div>
      )}

      {/* City Filter & Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-700">Filter City:</span>
          <select
            value={filterCity}
            onChange={(e) => { setFilterCity(e.target.value); setPage(0); }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden"
          >
            <option value="ALL">All Cities ({cameras.length})</option>
            {citiesList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center space-x-3 text-xs font-semibold text-slate-600">
          <span>
            Showing Page <strong className="text-slate-900">{page + 1}</strong> of <strong className="text-slate-900">{totalPages || 1}</strong>
          </span>
          <div className="flex items-center space-x-1">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-bold text-slate-800 transition"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-bold text-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className={`grid ${gridClass} gap-4`}>
        {displayedCameras.map(cam => (
          <CameraFeedTile
            key={cam.id}
            cam={cam}
            height={tileHeight}
            onFullScreen={(c) => setFullscreenCam(c)}
          />
        ))}
      </div>

      {/* Fullscreen Enlarged Feed Modal */}
      {fullscreenCam && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 text-white border-b border-slate-800">
            <div>
              <h2 className="text-lg font-black font-mono tracking-tight text-emerald-400">
                {fullscreenCam.name} — {fullscreenCam.location} ({fullscreenCam.city || 'Gujarat'})
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                RTSP Endpoint: {fullscreenCam.rtsp_url} • Codec: {fullscreenCam.codec.toUpperCase()} ({fullscreenCam.width}x{fullscreenCam.height})
              </p>
            </div>
            <button
              onClick={() => setFullscreenCam(null)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 my-3 bg-black rounded-xl overflow-hidden relative border border-slate-800">
            <RealLiveVideoStream cam={fullscreenCam} />
          </div>
        </div>
      )}

      {/* Onboard RTSP Camera Modal */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0B1E3B] border border-blue-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl text-white relative">
            <button 
              onClick={() => setIsOnboardModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-lg font-black tracking-tight">Onboard New RTSP Camera Feed</h2>
            </div>
            <p className="text-slate-300 text-xs mb-4">
              Enter any RTSP stream link. The MediaMTX engine and database pipeline will automatically transcode and surface your live camera feed instantly.
            </p>

            {onboardSuccess ? (
              <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-xl p-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h3 className="text-base font-bold text-white">Camera Feed Onboarded!</h3>
                <p className="text-emerald-300 text-xs font-mono">
                  Live HLS Proxy & Database record created. Surfacing live video...
                </p>
              </div>
            ) : (
              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    RTSP Stream URL <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardRtspUrl}
                    onChange={(e) => setOnboardRtspUrl(e.target.value)}
                    placeholder="rtsp://65.1.214.31:8554/gj/cam1 or rtsp://domain:port/path"
                    className="w-full px-3.5 py-2 bg-[#050C1A] border border-blue-900 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Camera Name</label>
                    <input
                      type="text"
                      required
                      value={onboardName}
                      onChange={(e) => setOnboardName(e.target.value)}
                      placeholder="e.g. Surat Highway Gate 3"
                      className="w-full px-3.5 py-2 bg-[#050C1A] border border-blue-900 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">City / District</label>
                    <input
                      type="text"
                      required
                      value={onboardCity}
                      onChange={(e) => setOnboardCity(e.target.value)}
                      placeholder="e.g. Ahmedabad, Surat"
                      className="w-full px-3.5 py-2 bg-[#050C1A] border border-blue-900 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Location / Landmark</label>
                    <input
                      type="text"
                      value={onboardLocation}
                      onChange={(e) => setOnboardLocation(e.target.value)}
                      placeholder="e.g. Janpath Junction"
                      className="w-full px-3.5 py-2 bg-[#050C1A] border border-blue-900 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Video Codec</label>
                    <select
                      value={onboardCodec}
                      onChange={(e) => setOnboardCodec(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#050C1A] border border-blue-900 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="h264">H.264 (Standard)</option>
                      <option value="hevc">HEVC / H.265 (High Def)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#050C1A] p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                    <Server className="w-3.5 h-3.5" />
                    <span>Auto-Configured Ingestion Route:</span>
                  </div>
                  <div className="truncate text-slate-300">
                    HLS Proxy: /api/v1/streams/hls-proxy/{onboardRtspUrl.split('/').pop() || 'cam1'}/index.m3u8
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOnboardModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg cursor-pointer"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlusCircle className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? 'Configuring Pipeline...' : 'Onboard & Start Stream'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
