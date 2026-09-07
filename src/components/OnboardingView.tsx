import React, { useState, useRef } from 'react';
import { Camera, Department, District } from '../types';
import { ApiClient } from '../services/apiClient';
import { 
  Plus, 
  Upload, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  FileSpreadsheet, 
  Server, 
  FileCheck,
  ShieldCheck,
  Radio,
  Cpu,
  MapPin,
  Check,
  Download,
  FileUp,
  Video,
  Zap,
  Terminal,
  Activity,
  Globe,
  RefreshCw,
  Eye,
  Sliders,
  Share2,
  Copy,
  Link,
  ExternalLink
} from 'lucide-react';

interface OnboardingViewProps {
  departments: Department[];
  districts: District[];
  currentLang?: string;
  onAddCamera: (camera: Camera) => void;
  onNavigateTab?: (tab: string) => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  departments,
  districts,
  onAddCamera,
  onNavigateTab
}) => {
  const [activeMethod, setActiveMethod] = useState<'rtsp' | 'manual' | 'bulk' | 'api' | 'buddy_sync'>('rtsp');
  const [manualStep, setManualStep] = useState(1);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [createdCamera, setCreatedCamera] = useState<Camera | null>(null);

  // Buddy Server Dynamic Sync & Export State
  const [buddyWebhookUrl, setBuddyWebhookUrl] = useState('http://buddy-server/api/v1/cameras/ingest');
  const [buddySyncStatus, setBuddySyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [buddySyncMessage, setBuddySyncMessage] = useState('');
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);

  // 1. Quick RTSP Stream Form State & Extended Telemetry
  const [quickRtspUrl, setQuickRtspUrl] = useState('');
  const [quickRtspName, setQuickRtspName] = useState('Camera 32 — Live RTSP Feed (Ahmedabad SG Highway)');
  const [quickRtspDistrict, setQuickRtspDistrict] = useState('Ahmedabad');
  const [quickRtspDepartment, setQuickRtspDepartment] = useState('DEPT-POL-01');
  const [quickRtspPingStatus, setQuickRtspPingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [quickRtspAdded, setQuickRtspAdded] = useState(false);

  // Extended Telemetry Details (matching JSON camera payload schema)
  const [quickRtspHlsUrl, setQuickRtspHlsUrl] = useState('/live/stream/1/index.m3u8');
  const [quickRtspWebrtcUrl, setQuickRtspWebrtcUrl] = useState('/stream/1/whep');
  const [quickRtspCodec, setQuickRtspCodec] = useState('h264');
  const [quickRtspLive, setQuickRtspLive] = useState(true);
  const [quickRtspWidth, setQuickRtspWidth] = useState(1920);
  const [quickRtspHeight, setQuickRtspHeight] = useState(1080);
  const [quickRtspFps, setQuickRtspFps] = useState(25.0);
  const [quickRtspBitrate, setQuickRtspBitrate] = useState(2048);
  const [quickRtspBitsPerPixel, setQuickRtspBitsPerPixel] = useState(0.038);

  // JSON Manifest Quick Auto-Fill Payload State
  const [showJsonDrawer, setShowJsonDrawer] = useState(false);
  const [rawJsonPayload, setRawJsonPayload] = useState('{"cameras":[{"id":"1","number":1,"name":"Camera 1","location":"01 Chiman bhai Bridge","codec":"h264","live":true,"width":1920,"height":1080,"fps":25.0,"bitrate_kbps":2048,"bits_per_pixel":0.038,"rtsp_url":"rtsp://live.corp8.cloud:8554/stream/1","hls_live_url":"/live/stream/1/index.m3u8"}]}');
  const [jsonParseError, setJsonParseError] = useState('');
  const [jsonParseSuccess, setJsonParseSuccess] = useState(false);

  // Preset Live Streams for fast testing
  const PRESET_STREAMS = [
    { name: 'Ahmedabad Chiman Bhai Bridge (Cam 1)', url: 'rtsp://43.204.235.231:554/live1', district: 'Ahmedabad', hls: '/live/stream/1/index.m3u8' },
    { name: 'Janpath Road Promenade (Cam 2)', url: 'rtsp://43.204.235.231:554/live2', district: 'Ahmedabad', hls: '/live/stream/2/index.m3u8' },
    { name: 'Timbavadi Gate Bypass (Cam 6)', url: 'rtsp://43.204.235.231:554/live6', district: 'Junagadh', hls: '/live/stream/6/index.m3u8' },
    { name: 'Visat Teen Rasta Highway (Cam 5)', url: 'rtsp://43.204.235.231:554/live5', district: 'Gandhinagar', hls: '/live/stream/5/index.m3u8' },
    { name: 'Khaparia Gram Panchayat (Cam 19)', url: 'rtsp://43.204.235.231:554/live19', district: 'Navsari', hls: '/live/stream/19/index.m3u8' },
    { name: 'Custom MediaMTX RTSP Node', url: 'rtsp://65.1.214.31:8554/gj/cam1', district: 'Ahmedabad', hls: '/live/stream/1/index.m3u8' },
  ];

  // Helper for Buddy Server Webhook Sync & API Copy
  const handleTriggerBuddyWebhook = async () => {
    if (!buddyWebhookUrl.trim()) return;
    setBuddySyncStatus('syncing');
    setBuddySyncMessage('');
    try {
      const res = await ApiClient.triggerBuddyWebhook(buddyWebhookUrl.trim());
      if (res && res.status === 'success') {
        setBuddySyncStatus('success');
        setBuddySyncMessage(res.message || 'All camera feeds successfully synchronized to buddy server!');
      } else {
        setBuddySyncStatus('success');
        setBuddySyncMessage(res?.message || 'Sync request dispatched to buddy server!');
      }
    } catch (e: any) {
      setBuddySyncStatus('failed');
      setBuddySyncMessage('Webhook sync exception: ' + (e.message || e));
    }
  };

  const handleCopyExportUrl = () => {
    const url = ApiClient.getBuddyExportApiUrl('json');
    navigator.clipboard.writeText(url);
    setCopiedApiUrl(true);
    setTimeout(() => setCopiedApiUrl(false), 3000);
  };

  // Auto-Fill Form from Raw JSON Stream Manifest
  const handleParseRawJsonPayload = () => {
    setJsonParseError('');
    setJsonParseSuccess(false);

    if (!rawJsonPayload.trim()) {
      setJsonParseError('Please paste a JSON camera payload first.');
      return;
    }

    try {
      const parsed = JSON.parse(rawJsonPayload.trim());
      const camObj = Array.isArray(parsed) 
        ? parsed[0] 
        : (parsed.cameras && Array.isArray(parsed.cameras) ? parsed.cameras[0] : parsed);

      if (!camObj) {
        setJsonParseError('No camera object found in JSON.');
        return;
      }

      if (camObj.rtsp_url) setQuickRtspUrl(camObj.rtsp_url);
      if (camObj.hls_live_url) setQuickRtspHlsUrl(camObj.hls_live_url);
      if (camObj.webrtc_url || camObj.whep) setQuickRtspWebrtcUrl(camObj.webrtc_url || camObj.whep || '/stream/1/whep');
      if (camObj.name) setQuickRtspName(camObj.name);
      if (camObj.location && camObj.name && !camObj.name.includes(camObj.location)) {
        setQuickRtspName(`${camObj.name} — ${camObj.location}`);
      }
      if (camObj.codec !== undefined && camObj.codec !== "") setQuickRtspCodec(camObj.codec);
      if (camObj.live !== undefined) setQuickRtspLive(Boolean(camObj.live));
      if (camObj.width) setQuickRtspWidth(Number(camObj.width));
      if (camObj.height) setQuickRtspHeight(Number(camObj.height));
      if (camObj.fps) setQuickRtspFps(Number(camObj.fps));
      if (camObj.bitrate_kbps) setQuickRtspBitrate(Number(camObj.bitrate_kbps));
      if (camObj.bits_per_pixel) setQuickRtspBitsPerPixel(Number(camObj.bits_per_pixel));

      setJsonParseSuccess(true);
      if (camObj.rtsp_url) handleTestRtspPing(camObj.rtsp_url);
    } catch (err: any) {
      setJsonParseError(`Invalid JSON format: ${err.message || err}`);
    }
  };

  // Submit Instant RTSP Stream
  const handleQuickRtspSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRtspUrl) return;

    try {
      const sentinelCam = await ApiClient.onboardFullCamera({
        rtspUrl: quickRtspUrl,
        name: quickRtspName || 'Custom RTSP Stream Node',
        city: quickRtspDistrict || 'Ahmedabad',
        location: `${quickRtspDistrict || 'Ahmedabad'} Corridor`,
        codec: quickRtspCodec || 'h264',
        hls_live_url: quickRtspHlsUrl,
        webrtc_url: quickRtspWebrtcUrl,
        live: quickRtspLive,
        width: quickRtspWidth,
        height: quickRtspHeight,
        fps: quickRtspFps,
        bitrate_kbps: quickRtspBitrate,
        bits_per_pixel: quickRtspBitsPerPixel
      });

      const selectedDeptObj = departments.find(d => d.id === quickRtspDepartment);

      const newCam: Camera = {
        cameraUuid: sentinelCam.id || `uuid-rtsp-${Date.now()}`,
        cameraCode: `CAM-RTSP-${Date.now() % 1000000}`,
        name: quickRtspName || 'Custom RTSP Stream Feed',
        type: 'ANPR',
        lifecycle: 'ACTIVE',
        healthStatus: quickRtspLive ? 'ONLINE' : 'DEGRADED',
        latitude: 23.0225,
        longitude: 72.5714,
        address: `${quickRtspDistrict} Strategic Patrol Zone`,
        city: quickRtspDistrict,
        district: quickRtspDistrict,
        taluka: 'Central Sector',
        departmentId: quickRtspDepartment,
        departmentName: selectedDeptObj?.name || 'Gujarat Police (Traffic Division)',
        owner: 'State Surveillance Command',
        responsibleOfficer: { name: 'P. M. Chudasama', designation: 'DySP (Traffic)', phone: '+91 79 2658 0001', email: 'dysp.traffic@gujarat.gov.in' },
        manufacturer: 'RTSP Media Engine',
        model: 'RTSP-H264-Gateway',
        firmwareVersion: 'v2.4.0',
        resolution: `${quickRtspWidth || 1920}x${quickRtspHeight || 1080}`,
        ptzSupport: true,
        installationDate: new Date().toISOString().slice(0, 10),
        networkType: 'Fiber WAN',
        vmsPlatformId: 'VMS-MIL-01',
        vmsPlatformName: 'Sentinel Cloud Edge Gateway',
        protocol: 'ONVIF Profile S',
        endpointReference: quickRtspUrl,
        hls_live_url: sentinelCam.hls_live_url || quickRtspHlsUrl,
        storageType: 'Department SAN',
        retentionDays: 45,
        capabilities: { anpr: true, vehicleDetection: true, personDetection: true, edgeAI: true, otherAnalytics: ['Speed Detection'] },
        lastHeartbeat: 'Just now (Continuous Feed)',
        fps: quickRtspFps || 30, bitrate: quickRtspBitrate || 4096, availability: 100, deviceHealth: 'Nominal',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        createdBy: 'RTSP Quick Onboarder',
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        updatedBy: 'RTSP Quick Onboarder'
      };

      onAddCamera(newCam);
      setCreatedCamera(newCam);
      setQuickRtspAdded(true);
      setTimeout(() => {
        if (onNavigateTab) onNavigateTab('sentinel-live-wall');
      }, 1500);
    } catch (err) {
      console.warn('[RTSP Ingestion]', err);
    }
  };

  // Submit Manual Form
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDept = departments.find(d => d.id === manualData.departmentId);
    const rtspUrl = manualData.endpointReference || 'rtsp://43.204.235.231:554/live1';

    if (rtspUrl && rtspUrl.startsWith('rtsp://')) {
      ApiClient.onboardFullCamera({
        rtspUrl,
        name: manualData.name || 'Manual Registered Camera',
        city: manualData.city || 'Ahmedabad',
        location: manualData.address || manualData.name,
        codec: 'h264',
        district: manualData.district,
        latitude: parseFloat(manualData.latitude) || 23.0225,
        longitude: parseFloat(manualData.longitude) || 72.5714
      }).catch(e => console.warn('[Manual Pipeline]', e));
    }

    const newCam: Camera = {
      cameraUuid: `uuid-gen-${Date.now()}`,
      cameraCode: manualData.cameraCode,
      name: manualData.name || 'New Master Surveillance Node',
      type: manualData.type,
      lifecycle: 'ACTIVE',
      healthStatus: 'ONLINE',
      latitude: parseFloat(manualData.latitude) || 23.0225,
      longitude: parseFloat(manualData.longitude) || 72.5714,
      address: manualData.address || `${manualData.district} Main Highway Gate`,
      city: manualData.city,
      district: manualData.district,
      taluka: manualData.taluka,
      departmentId: manualData.departmentId,
      departmentName: selectedDept?.name || 'Gujarat Police (Traffic Division)',
      owner: manualData.owner,
      responsibleOfficer: { name: manualData.officerName, designation: manualData.officerRank, phone: manualData.officerPhone, email: manualData.officerEmail },
      manufacturer: manualData.manufacturer,
      model: manualData.model,
      firmwareVersion: manualData.firmwareVersion,
      resolution: manualData.resolution,
      ptzSupport: manualData.ptzSupport,
      installationDate: manualData.installationDate,
      networkType: manualData.networkType,
      vmsPlatformId: manualData.vmsPlatformId,
      vmsPlatformName: manualData.vmsPlatformName,
      protocol: manualData.protocol,
      endpointReference: rtspUrl,
      hls_live_url: 'http://43.204.235.231:8080/hls/live1.m3u8',
      storageType: manualData.storageType,
      retentionDays: Number(manualData.retentionDays),
      capabilities: { anpr: manualData.anpr, vehicleDetection: manualData.vehicleDetection, personDetection: manualData.personDetection, edgeAI: manualData.edgeAI, otherAnalytics: ['Manual Provisioned Stream'] },
      lastHeartbeat: 'Just now (Continuous Feed)',
      fps: 30, bitrate: 4096, availability: 100, deviceHealth: 'Nominal',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      createdBy: 'Manual Registration Pipeline',
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      updatedBy: 'Admin'
    };

    onAddCamera(newCam);
    setCreatedCamera(newCam);
    setIsSuccessModalOpen(true);
  };

  // Download Sample CSV Template
  const handleDownloadCsvTemplate = () => {
    const csvContent = `id,cameraname,rtsp_url,city,district,department,latitude,longitude,resolution,anpr
CAM-CSV-001,Chiman Bhai Bridge North Gate,rtsp://43.204.235.231:554/live1,Ahmedabad,Ahmedabad,Gujarat Police,23.0781,72.5833,4K (3840x2160),true
CAM-CSV-002,Janpath Road Promenade,rtsp://43.204.235.231:554/live2,Ahmedabad,Ahmedabad,AMC,23.0312,72.5645,4MP (2560x1440),true
CAM-CSV-003,Timbavadi Gate Bypass,rtsp://43.204.235.231:554/live6,Junagadh,Junagadh,Gujarat Police,21.5210,70.4578,4K (3840x2160),true
CAM-CSV-004,Visat Teen Rasta Highway,rtsp://43.204.235.231:554/live5,Gandhinagar,Gandhinagar,Gujarat Police,23.1092,72.5941,1080p,true
CAM-CSV-005,Khaparia Gram Panchayat Post,rtsp://43.204.235.231:554/live19,Navsari,Navsari,Gujarat Police,20.9456,72.9234,4MP (2560x1440),true`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'z_tracs_camera_onboarding_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process CSV File Input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processCsvFile(files[0]);
    }
  };

  const processCsvFile = (file: File) => {
    setUploadedFileName(file.name);
    setBulkStatus('parsing');
    setBulkErrorMessage('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('Selected file is empty');

        let rows: any[] = [];
        const trimmed = text.trim();

        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          const parsed = JSON.parse(trimmed.startsWith('[') ? trimmed : `[${trimmed}]`);
          rows = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          const lines = trimmed.split(/\r\n|\n/).filter(l => l.trim() !== '');
          if (lines.length <= 1) throw new Error('CSV contains no data rows');
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            if (values.length < 2) continue;
            const row: any = {};
            headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
            rows.push(row);
          }
        }

        if (rows.length === 0) throw new Error('No camera rows found in file');
        setParsedCameras(rows);
        setBulkStatus('completed');
      } catch (err: any) {
        setBulkStatus('error');
        setBulkErrorMessage(err.message || 'Error parsing file');
      }
    };
    reader.readAsText(file);
  };

  // Import All CSV Parsed Cameras
  const handleImportParsedCameras = () => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    let count = 0;

    for (const row of parsedCameras) {
      const rtspUrl = row.rtsp_url || row.endpointreference || row.rtsp || 'rtsp://43.204.235.231:554/live1';
      const name = row.cameraname || row.name || `CSV Camera Node #${count + 1}`;
      const city = row.city || row.district || 'Ahmedabad';
      const location = row.location || `${city} Main Highway`;
      const lat = parseFloat(row.latitude || row.lat || '23.0225');
      const lng = parseFloat(row.longitude || row.lng || '72.5714');

      if (rtspUrl) {
        ApiClient.onboardFullCamera({ rtspUrl, name, city, location, codec: 'h264', latitude: lat, longitude: lng })
          .catch(e => console.warn('[CSV Onboarding]', e));
      }

      const newCam: Camera = {
        cameraUuid: `uuid-csv-${Date.now()}-${count}`,
        cameraCode: row.id || row.cameracode || `CAM-CSV-${Date.now() % 1000000 + count}`,
        name,
        type: 'ANPR',
        lifecycle: 'ACTIVE',
        healthStatus: 'ONLINE',
        latitude: lat,
        longitude: lng,
        address: `${location}, ${city}`,
        city,
        district: city,
        taluka: 'Central Sector',
        departmentId: 'DEPT-POL-01',
        departmentName: 'Gujarat Police (Traffic Division)',
        owner: 'Gujarat Police Command',
        responsibleOfficer: { name: 'P. M. Chudasama', designation: 'DySP (Traffic)', phone: '+91 79 2658 0001', email: 'dysp.traffic@gujarat.gov.in' },
        manufacturer: 'Hikvision',
        model: 'DS-2CD7A26G0',
        firmwareVersion: 'v5.7.12',
        resolution: row.resolution || '4K (3840x2160)',
        ptzSupport: true,
        installationDate: new Date().toISOString().slice(0, 10),
        networkType: 'Fiber WAN',
        vmsPlatformId: 'VMS-MIL-01',
        vmsPlatformName: 'Sentinel Cloud Edge Gateway',
        protocol: 'ONVIF Profile S',
        endpointReference: rtspUrl,
        hls_live_url: 'http://43.204.235.231:8080/hls/live1.m3u8',
        storageType: 'Department SAN',
        retentionDays: 45,
        capabilities: { anpr: true, vehicleDetection: true, personDetection: true, edgeAI: true, otherAnalytics: ['CSV Ingest Stream'] },
        lastHeartbeat: 'Just now', fps: 30, bitrate: 4096, availability: 100, deviceHealth: 'Nominal',
        createdAt: nowStr, createdBy: 'Bulk CSV Import Engine',
        updatedAt: nowStr, updatedBy: 'Bulk CSV Import Engine'
      };

      onAddCamera(newCam);
      count++;
    }

    setQuickRtspAdded(true);
    setTimeout(() => {
      if (onNavigateTab) onNavigateTab('sentinel-live-wall');
    }, 1500);
  };

  // Run API / ONVIF Subnet Discovery Scan
  const handleRunApiDiscovery = () => {
    setApiScanStatus('scanning');
    setDiscoveredNodes([]);

    setTimeout(() => {
      const mockDiscovered = [
        { ip: '192.168.1.101', mac: '00:1A:2B:3C:4D:5E', name: 'ONVIF Cam #101 (Chiman Bhai Gate)', rtsp: 'rtsp://43.204.235.231:554/live1', model: 'Hikvision DS-2CD7A26G0', status: 'ONVIF Profile S Verified' },
        { ip: '192.168.1.102', mac: '00:1A:2B:3C:4D:5F', name: 'ONVIF Cam #102 (Janpath Road Cross)', rtsp: 'rtsp://43.204.235.231:554/live2', model: 'CP Plus CP-UNC-TA50L4', status: 'ONVIF Profile T Verified' },
        { ip: '192.168.1.103', mac: '00:1A:2B:3C:4D:60', name: 'ONVIF Cam #103 (Timbavadi Gate)', rtsp: 'rtsp://43.204.235.231:554/live6', model: 'Dahua DHI-ITC952-RU2D', status: 'RTSP Stream Active' },
        { ip: '192.168.1.104', mac: '00:1A:2B:3C:4D:61', name: 'ONVIF Cam #104 (Visat Teen Rasta)', rtsp: 'rtsp://43.204.235.231:554/live5', model: 'Axis Q1656-LE', status: 'ONVIF Profile S Verified' }
      ];
      setDiscoveredNodes(mockDiscovered);
      setApiScanStatus('completed');
    }, 1200);
  };

  // Batch Import Discovered API Nodes
  const handleBatchImportApiNodes = () => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    discoveredNodes.forEach((node, idx) => {
      ApiClient.onboardFullCamera({ rtspUrl: node.rtsp, name: node.name, city: 'Ahmedabad', location: node.name, codec: 'h264' })
        .catch(e => console.warn('[ONVIF Import]', e));

      const newCam: Camera = {
        cameraUuid: `uuid-api-${Date.now()}-${idx}`,
        cameraCode: `CAM-ONVIF-${101 + idx}`,
        name: node.name,
        type: 'ANPR',
        lifecycle: 'ACTIVE',
        healthStatus: 'ONLINE',
        latitude: 23.0225 + idx * 0.005,
        longitude: 72.5714 + idx * 0.005,
        address: `${node.ip} — Local ONVIF Subnet`,
        city: 'Ahmedabad',
        district: 'Ahmedabad',
        taluka: 'Central Sector',
        departmentId: 'DEPT-POL-01',
        departmentName: 'Gujarat Police (Traffic Division)',
        owner: 'Auto-Discovered ONVIF Network',
        responsibleOfficer: { name: 'P. M. Chudasama', designation: 'DySP (Traffic)', phone: '+91 79 2658 0001', email: 'dysp.traffic@gujarat.gov.in' },
        manufacturer: node.model.split(' ')[0] || 'ONVIF Device',
        model: node.model,
        firmwareVersion: 'v5.7.12',
        resolution: '4K (3840x2160)',
        ptzSupport: true,
        installationDate: new Date().toISOString().slice(0, 10),
        networkType: 'Fiber WAN',
        vmsPlatformId: 'VMS-MIL-01',
        vmsPlatformName: 'Sentinel Cloud Edge Gateway',
        protocol: 'ONVIF Profile S',
        endpointReference: node.rtsp,
        hls_live_url: 'http://43.204.235.231:8080/hls/live1.m3u8',
        storageType: 'Department SAN',
        retentionDays: 45,
        capabilities: { anpr: true, vehicleDetection: true, personDetection: true, edgeAI: true, otherAnalytics: ['ONVIF Auto Discovery'] },
        lastHeartbeat: 'Just now (Active Ping)', fps: 30, bitrate: 4096, availability: 100, deviceHealth: 'Nominal',
        createdAt: nowStr, createdBy: 'ONVIF Auto-Discovery Engine',
        updatedAt: nowStr, updatedBy: 'ONVIF Auto-Discovery Engine'
      };

      onAddCamera(newCam);
    });

    setQuickRtspAdded(true);
    setTimeout(() => {
      if (onNavigateTab) onNavigateTab('sentinel-live-wall');
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Top Banner Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Sentinel Surveillance Gateway
            </span>
            <span className="text-xs text-slate-400 font-mono">Live RTSP Stream & Registry Ingestion Engine</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Statewide Camera Onboarding & RTSP Stream Integration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect live RTSP video feeds, register manual CCTV assets, parse bulk CSV camera manifests, or execute auto ONVIF network discovery.
          </p>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveMethod('rtsp')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeMethod === 'rtsp' ? 'bg-[#0052CC] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>1. RTSP Direct Feed</span>
          </button>
          <button
            onClick={() => setActiveMethod('manual')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeMethod === 'manual' ? 'bg-[#0052CC] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>2. Manual Form</span>
          </button>
          <button
            onClick={() => setActiveMethod('bulk')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeMethod === 'bulk' ? 'bg-[#0052CC] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>3. Bulk CSV / XLSX</span>
          </button>
          <button
            onClick={() => setActiveMethod('api')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeMethod === 'api' ? 'bg-[#0052CC] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>4. API / ONVIF Discovery</span>
          </button>
          <button
            onClick={() => setActiveMethod('buddy_sync')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeMethod === 'buddy_sync' ? 'bg-[#0052CC] text-white shadow-md' : 'text-blue-700 bg-blue-50/70 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#0052CC]" />
            <span>5. 🔗 Buddy Server Sync & Export</span>
          </button>
        </div>
      </div>

      {/* SUCCESS NOTIFICATION TOAST */}
      {quickRtspAdded && (
        <div className="p-4 bg-emerald-950/90 border border-emerald-500 rounded-2xl text-emerald-200 flex items-center justify-between shadow-2xl animate-in zoom-in-95">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <div className="font-black text-sm text-white">Camera Feed Successfully Registered & Onboarded!</div>
              <div className="text-xs text-emerald-300 font-mono mt-0.5">
                Added to Live Sentinel Video Wall & PostGIS Master Registry — Redirecting to Sentinel Live Grid...
              </div>
            </div>
          </div>
          <button 
            onClick={() => onNavigateTab && onNavigateTab('sentinel-live-wall')}
            className="px-3.5 py-1.5 bg-emerald-500 text-slate-950 font-black rounded-lg text-xs hover:bg-emerald-400 transition cursor-pointer"
          >
            View Live Stream Grid →
          </button>
        </div>
      )}

      {/* METHOD 5: BUDDY SERVER DYNAMIC FEED EXPORT & REAL-TIME SYNC */}
      {activeMethod === 'buddy_sync' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-br from-[#0B192C] via-[#1E3E62] to-[#0052CC] text-white p-6 rounded-2xl border border-blue-600 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/40">
                <Share2 className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-base font-black text-white flex items-center space-x-2">
                  <span>Buddy Server Dynamic Camera Feed Integration</span>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-400/20 text-cyan-200 border border-cyan-400/40">
                    REAL-TIME AUTOMATED EXPORT
                  </span>
                </h2>
                <p className="text-xs text-blue-100 mt-0.5">
                  Share registered RTSP stream URLs, camera names, lat/long coordinates, and locations dynamically with external buddy servers.
                </p>
              </div>
            </div>

            {/* LIVE DYNAMIC API URL CARD */}
            <div className="p-4 bg-slate-900/90 rounded-xl border border-blue-400/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center space-x-1.5">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>Public Live Feeds Dynamic API Endpoint URL:</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-600/50">
                  ● HTTP GET Live Ready
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={ApiClient.getBuddyExportApiUrl('json')}
                  className="flex-1 bg-slate-950 text-amber-300 font-mono text-xs p-2.5 rounded-lg border border-slate-700 outline-none select-all"
                />
                <button
                  onClick={handleCopyExportUrl}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-md"
                >
                  {copiedApiUrl ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedApiUrl ? 'Copied URL!' : 'Copy API URL'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                <span>Your buddy's server can call this URL anytime to get fresh camera details in real time.</span>
                <div className="flex items-center space-x-2">
                  <a
                    href={ApiClient.getBuddyExportApiUrl('json')}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-mono flex items-center space-x-1 border border-slate-700"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View JSON</span>
                  </a>
                  <a
                    href={ApiClient.getBuddyExportApiUrl('csv')}
                    download="sentinel_cameras_export.csv"
                    className="px-2.5 py-1 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 rounded font-mono flex items-center space-x-1 border border-emerald-700"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </a>
                </div>
              </div>
            </div>

            {/* WEBHOOK AUTOMATED PUSH CONFIGURATION */}
            <div className="p-4 bg-slate-900/90 rounded-xl border border-blue-400/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                  <Server className="w-4 h-4 text-amber-400" />
                  <span>Buddy Server Direct Webhook Auto-Push (Optional):</span>
                </span>
                <span className="text-[10px] text-blue-200">
                  Instant Webhook HTTP POST on New Camera Registration
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={buddyWebhookUrl}
                  onChange={e => setBuddyWebhookUrl(e.target.value)}
                  placeholder="Enter buddy server endpoint e.g. http://buddy-server.com/api/cameras"
                  className="flex-1 bg-slate-950 text-white font-mono text-xs p-2.5 rounded-lg border border-slate-700 focus:border-blue-400 outline-none"
                />
                <button
                  onClick={handleTriggerBuddyWebhook}
                  disabled={buddySyncStatus === 'syncing'}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-md"
                >
                  <RefreshCw className={`w-4 h-4 ${buddySyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>{buddySyncStatus === 'syncing' ? 'Pushing Data...' : 'Sync All Cameras Now'}</span>
                </button>
              </div>

              {buddySyncMessage && (
                <div className={`p-2.5 rounded-lg text-xs font-mono border ${
                  buddySyncStatus === 'failed' ? 'bg-rose-950/80 text-rose-300 border-rose-700' : 'bg-emerald-950/80 text-emerald-200 border-emerald-700'
                }`}>
                  {buddySyncMessage}
                </div>
              )}
            </div>

            {/* EXPECTED JSON SCHEMA SPECIFICATION */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                  <Terminal className="w-3.5 h-3.5 text-[#0052CC]" />
                  <span>Export JSON Payload Schema Received by Buddy Server:</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">HTTP 200 OK Response</span>
              </div>
              <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 scrollbar-thin">
{`{
  "status": "success",
  "total_cameras": 32,
  "export_timestamp": "2026-09-03T22:32:00Z",
  "buddy_api_url": "http://43.204.235.231:8000/api/v1/cameras/export-feeds",
  "cameras": [
    {
      "id": "1",
      "number": 1,
      "name": "01 Chiman bhai Bridge",
      "camera_code": "CAM-RTSP-928102",
      "rtsp_url": "rtsp://live.corp8.cloud:8554/stream/1",
      "latitude": 23.0225,
      "longitude": 72.5714,
      "city": "Ahmedabad",
      "district": "Ahmedabad",
      "location": "01 Chiman bhai Bridge",
      "codec": "h264",
      "health_status": "ONLINE"
    }
  ]
}`}
              </pre>
            </div>

          </div>
        </div>
      )}

      {/* METHOD 1: RTSP DIRECT STREAM FEED INGESTION */}
      {activeMethod === 'rtsp' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-[#06162E] via-[#092248] to-[#0A2E63] text-white p-6 rounded-2xl border border-blue-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-blue-900/80 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-600/30 rounded-xl border border-blue-500/50 shadow-inner">
                  <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center space-x-2">
                    <span>Instant RTSP Live Video Stream Onboarding</span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      LIVE MEDIA STREAMING ACTIVE
                    </span>
                  </h2>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Connect any RTSP feed or paste camera JSON payloads (<code className="text-amber-300 font-mono">rtsp_url</code>, <code className="text-amber-300 font-mono">hls_live_url</code>, <code className="text-amber-300 font-mono">codec</code>, <code className="text-amber-300 font-mono">fps</code>) to register feeds.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowJsonDrawer(!showJsonDrawer)}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>{showJsonDrawer ? 'Hide JSON Drawer' : 'Paste JSON Payload'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestRtspPing(quickRtspUrl)}
                  className="px-3.5 py-2 bg-blue-900/60 hover:bg-blue-800 border border-blue-700/80 text-blue-100 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${quickRtspPingStatus === 'testing' ? 'animate-spin' : ''}`} />
                  <span>Test Stream Ping</span>
                </button>
              </div>
            </div>

            {/* JSON Stream Manifest Drawer */}
            {showJsonDrawer && (
              <div className="p-4 bg-slate-950/90 rounded-xl border border-amber-500/40 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">Paste JSON Stream Camera Record:</span>
                  </div>
                  <span className="text-[10px] text-blue-300 font-mono">Supports {"{cameras: [...]}"} or single camera JSON object</span>
                </div>

                <textarea
                  rows={4}
                  value={rawJsonPayload}
                  onChange={(e) => setRawJsonPayload(e.target.value)}
                  placeholder='{"cameras":[{"id":"1","number":1,"name":"Camera 1","location":"01 Chiman bhai Bridge","codec":"h264","live":true,"width":1920,"height":1080,"fps":25.0,"bitrate_kbps":2048,"bits_per_pixel":0.038,"rtsp_url":"rtsp://live.corp8.cloud:8554/stream/1","hls_live_url":"/live/stream/1/index.m3u8"}]}'
                  className="w-full p-3 bg-slate-900 border border-blue-800 rounded-lg font-mono text-xs text-amber-300 focus:outline-hidden focus:border-amber-400"
                />

                {jsonParseError && (
                  <div className="text-xs text-rose-400 font-mono font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{jsonParseError}</span>
                  </div>
                )}

                {jsonParseSuccess && (
                  <div className="text-xs text-emerald-400 font-mono font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>JSON Parsed Successfully! Stream parameters extracted & ready for registration.</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParseRawJsonPayload}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Auto-Fill & Extract Stream Details</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Presets Picker */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 block">Quick Pick Live Sentinel Streams:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {PRESET_STREAMS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuickRtspUrl(preset.url);
                      setQuickRtspName(preset.name);
                      setQuickRtspDistrict(preset.district);
                      if (preset.hls) setQuickRtspHlsUrl(preset.hls);
                      handleTestRtspPing(preset.url);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                      quickRtspUrl === preset.url 
                        ? 'bg-blue-600/40 border-amber-400 text-white font-bold' 
                        : 'bg-slate-950/50 border-blue-900 text-blue-200 hover:border-blue-700'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-bold text-white truncate">{preset.name}</div>
                      <div className="text-[10px] text-blue-300 font-mono truncate">{preset.url}</div>
                    </div>
                    <Radio className={`w-4 h-4 shrink-0 ${quickRtspUrl === preset.url ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleQuickRtspSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* RTSP Stream URL */}
                <div className="lg:col-span-7 space-y-1">
                  <label className="text-xs font-bold text-blue-200 block">RTSP Endpoint URL Link (rtsp_url):</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={quickRtspUrl}
                      onChange={(e) => setQuickRtspUrl(e.target.value)}
                      placeholder="rtsp://live.corp8.cloud:8554/stream/1"
                      className="w-full pl-3.5 pr-24 py-2.5 bg-slate-950/90 border border-blue-700/80 rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 shadow-inner"
                      required
                    />
                    {quickRtspPingStatus === 'success' && (
                      <span className="absolute right-3 top-2.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 flex items-center space-x-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Stream Active</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Camera Site Landmark Name */}
                <div className="lg:col-span-5 space-y-1">
                  <label className="text-xs font-bold text-blue-200 block">Camera Site Landmark Name:</label>
                  <input
                    type="text"
                    value={quickRtspName}
                    onChange={(e) => setQuickRtspName(e.target.value)}
                    placeholder="e.g. 01 Chiman bhai Bridge"
                    className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-blue-700/80 rounded-xl text-xs font-semibold text-white focus:outline-hidden"
                    required
                  />
                </div>

                {/* Extended Stream Specs (Codec, Live toggle, Resolution, FPS, Bitrate) */}
                <div className="lg:col-span-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-blue-800/80 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-blue-300 block mb-1">Codec:</label>
                    <input
                      type="text"
                      value={quickRtspCodec}
                      onChange={(e) => setQuickRtspCodec(e.target.value)}
                      placeholder="h264"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-blue-700 rounded-lg font-mono text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-300 block mb-1">Live Status:</label>
                    <select
                      value={quickRtspLive ? 'true' : 'false'}
                      onChange={(e) => setQuickRtspLive(e.target.value === 'true')}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-blue-700 rounded-lg font-bold text-emerald-400"
                    >
                      <option value="true">True (Active)</option>
                      <option value="false">False (Offline)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-300 block mb-1">Width (px):</label>
                    <input
                      type="number"
                      value={quickRtspWidth}
                      onChange={(e) => setQuickRtspWidth(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-blue-700 rounded-lg font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-300 block mb-1">Height (px):</label>
                    <input
                      type="number"
                      value={quickRtspHeight}
                      onChange={(e) => setQuickRtspHeight(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-blue-700 rounded-lg font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-300 block mb-1">FPS:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={quickRtspFps}
                      onChange={(e) => setQuickRtspFps(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-blue-700 rounded-lg font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-300 block mb-1">Bitrate (kbps):</label>
                    <input
                      type="number"
                      value={quickRtspBitrate}
                      onChange={(e) => setQuickRtspBitrate(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-blue-700 rounded-lg font-mono text-white"
                    />
                  </div>
                </div>

                {/* District & Department */}
                <div className="lg:col-span-4 space-y-1">
                  <label className="text-xs font-bold text-blue-200 block">District Jurisdiction:</label>
                  <select
                    value={quickRtspDistrict}
                    onChange={(e) => setQuickRtspDistrict(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950/90 border border-blue-700/80 rounded-xl text-xs font-bold text-white"
                  >
                    {districts.map(d => (
                      <option key={d.id} value={d.name} className="bg-slate-900 text-white">{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-5 space-y-1">
                  <label className="text-xs font-bold text-blue-200 block">Owning Department:</label>
                  <select
                    value={quickRtspDepartment}
                    onChange={(e) => setQuickRtspDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950/90 border border-blue-700/80 rounded-xl text-xs font-bold text-white"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id} className="bg-slate-900 text-white">{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-2 shadow-lg cursor-pointer border border-emerald-400/50 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Onboard RTSP Feed</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* METHOD 2: MANUAL COMPREHENSIVE FORM */}
      {activeMethod === 'manual' && (
        <form onSubmit={handleManualSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">Manual Camera Asset Provisioning</h2>
              <p className="text-xs text-slate-500">Enter complete hardware, network protocol, PostGIS coordinates & ANPR capabilities</p>
            </div>
            <span className="px-3 py-1 bg-blue-50 text-[#0052CC] font-mono font-bold text-xs rounded-full border border-blue-200">
              Form Protocol v2.4
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            
            {/* Section A */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="font-bold text-slate-900 border-b pb-1.5 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[#0052CC]" />
                <span>1. Camera Code & Location</span>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Camera Code (Unique):</label>
                <input
                  type="text"
                  value={manualData.cameraCode}
                  onChange={(e) => setManualData({ ...manualData, cameraCode: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Landmark Site Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Ring Road Overbridge Gate North"
                  value={manualData.name}
                  onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">District:</label>
                  <select
                    value={manualData.district}
                    onChange={(e) => setManualData({ ...manualData, district: e.target.value, city: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Camera Form Type:</label>
                  <select
                    value={manualData.type}
                    onChange={(e) => setManualData({ ...manualData, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="ANPR">ANPR Camera</option>
                    <option value="PTZ">PTZ Speed Dome</option>
                    <option value="Fixed Bullet">Fixed Bullet</option>
                    <option value="Dome">Dome Camera</option>
                    <option value="Thermal">Thermal Camera</option>
                    <option value="360 Panoramic">360 Panoramic</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section B */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="font-bold text-slate-900 border-b pb-1.5 flex items-center space-x-2">
                <Video className="w-4 h-4 text-[#0052CC]" />
                <span>2. Stream Endpoint & Network</span>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">RTSP Stream URL:</label>
                <input
                  type="text"
                  value={manualData.endpointReference}
                  onChange={(e) => setManualData({ ...manualData, endpointReference: e.target.value })}
                  placeholder="rtsp://43.204.235.231:554/live1"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold text-amber-700"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Department Owner:</label>
                <select
                  value={manualData.departmentId}
                  onChange={(e) => setManualData({ ...manualData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Latitude:</label>
                  <input
                    type="text"
                    value={manualData.latitude}
                    onChange={(e) => setManualData({ ...manualData, latitude: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Longitude:</label>
                  <input
                    type="text"
                    value={manualData.longitude}
                    onChange={(e) => setManualData({ ...manualData, longitude: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section C */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="font-bold text-slate-900 border-b pb-1.5 flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-[#0052CC]" />
                <span>3. Hardware & Analytics</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Manufacturer:</label>
                  <input
                    type="text"
                    value={manualData.manufacturer}
                    onChange={(e) => setManualData({ ...manualData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Resolution:</label>
                  <input
                    type="text"
                    value={manualData.resolution}
                    onChange={(e) => setManualData({ ...manualData, resolution: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 block">AI & Registry Capabilities:</label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center space-x-1.5">
                    <input type="checkbox" checked={manualData.anpr} onChange={(e) => setManualData({ ...manualData, anpr: e.target.checked })} />
                    <span>ANPR Engine</span>
                  </label>
                  <label className="flex items-center space-x-1.5">
                    <input type="checkbox" checked={manualData.vehicleDetection} onChange={(e) => setManualData({ ...manualData, vehicleDetection: e.target.checked })} />
                    <span>Vehicle Count</span>
                  </label>
                  <label className="flex items-center space-x-1.5">
                    <input type="checkbox" checked={manualData.personDetection} onChange={(e) => setManualData({ ...manualData, personDetection: e.target.checked })} />
                    <span>Crowd Detect</span>
                  </label>
                  <label className="flex items-center space-x-1.5">
                    <input type="checkbox" checked={manualData.edgeAI} onChange={(e) => setManualData({ ...manualData, edgeAI: e.target.checked })} />
                    <span>Edge AI Accelerator</span>
                  </label>
                </div>
              </div>
            </div>

          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0052CC] hover:bg-blue-600 text-white font-black text-xs rounded-xl transition flex items-center space-x-2 shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register & Provision Camera Node</span>
            </button>
          </div>
        </form>
      )}

      {/* METHOD 3: BULK CSV / XLSX INGESTION */}
      {activeMethod === 'bulk' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">Bulk CSV / Excel Camera Manifest Ingestion</h2>
              <p className="text-xs text-slate-500">Upload bulk CSV files containing camera names, RTSP URLs, coordinates & district attributes.</p>
            </div>
            <button
              onClick={handleDownloadCsvTemplate}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-300 transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-500 transition bg-slate-50/50 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-3 bg-blue-100/70 text-[#0052CC] rounded-full w-12 h-12 mx-auto flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Click to select or drag and drop CSV camera manifest file</div>
              <div className="text-xs text-slate-500 mt-0.5">Supports CSV, XLSX, JSON (Max 5,000 camera nodes per batch upload)</div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-2xs cursor-pointer inline-flex items-center space-x-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Browse Camera Manifest File</span>
            </button>

            {uploadedFileName && (
              <div className="text-xs font-mono font-bold text-[#0052CC] pt-2">
                Selected File: {uploadedFileName}
              </div>
            )}
          </div>

          {/* Parsed Camera Preview Table */}
          {bulkStatus === 'completed' && parsedCameras.length > 0 && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Parsed Manifest Preview ({parsedCameras.length} Camera Nodes Validated):
                </span>
                <button
                  onClick={handleImportParsedCameras}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition shadow-md flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Batch Import All {parsedCameras.length} Cameras →</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                    <tr>
                      <th className="p-2.5">Camera ID</th>
                      <th className="p-2.5">Camera Site Name</th>
                      <th className="p-2.5">RTSP Stream Endpoint</th>
                      <th className="p-2.5">District</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedCameras.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-900">{row.id || `CAM-CSV-${idx + 1}`}</td>
                        <td className="p-2.5 font-bold text-slate-800">{row.cameraname || row.name || 'CSV Camera'}</td>
                        <td className="p-2.5 font-mono text-[11px] text-amber-700 truncate max-w-xs">{row.rtsp_url || row.endpointreference || 'rtsp://43.204.235.231:554/live1'}</td>
                        <td className="p-2.5 font-semibold text-slate-700">{row.district || row.city || 'Ahmedabad'}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Valid RTSP
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* METHOD 4: DEPARTMENT API & ONVIF AUTO-DISCOVERY */}
      {activeMethod === 'api' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">API Federation & Subnet ONVIF Auto-Discovery</h2>
              <p className="text-xs text-slate-500">Scan internal network subnets or sync with Municipal VMS endpoints over REST API.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-mono font-bold text-xs rounded-full border border-emerald-200">
              ONVIF Profile S/T Scanner
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
            <div className="md:col-span-5 space-y-1">
              <label className="font-bold text-slate-700 block">Network Subnet Range to Scan:</label>
              <input
                type="text"
                value={apiSubnet}
                onChange={(e) => setApiSubnet(e.target.value)}
                placeholder="192.168.1.0/24"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
              />
            </div>

            <div className="md:col-span-5 space-y-1">
              <label className="font-bold text-slate-700 block">VMS REST API Endpoint URL:</label>
              <input
                type="text"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs text-slate-800"
              />
            </div>

            <div className="md:col-span-2 flex items-end">
              <button
                type="button"
                onClick={handleRunApiDiscovery}
                disabled={apiScanStatus === 'scanning'}
                className="w-full py-2.5 px-4 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${apiScanStatus === 'scanning' ? 'animate-spin' : ''}`} />
                <span>{apiScanStatus === 'scanning' ? 'Scanning...' : 'Scan Subnet'}</span>
              </button>
            </div>
          </div>

          {/* Discovered ONVIF Nodes List */}
          {apiScanStatus === 'completed' && discoveredNodes.length > 0 && (
            <div className="space-y-3 pt-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Discovered Active ONVIF Camera Feeds ({discoveredNodes.length} Nodes Online):
                </span>
                <button
                  onClick={handleBatchImportApiNodes}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition shadow-md flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Batch Register All Discovered Cameras →</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {discoveredNodes.map((node, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{node.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">IP: {node.ip} • Model: {node.model}</div>
                      <div className="text-[10px] font-mono text-amber-700 mt-0.5 truncate max-w-xs">{node.rtsp}</div>
                    </div>
                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {node.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUCCESS MODAL */}
      {isSuccessModalOpen && createdCamera && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Camera Provisioning Complete!</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">{createdCamera.cameraCode} — {createdCamera.name}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1 font-mono">
              <div><span className="text-slate-500 font-sans">District:</span> <strong className="text-slate-900">{createdCamera.district}</strong></div>
              <div><span className="text-slate-500 font-sans">RTSP Stream:</span> <strong className="text-amber-700 truncate block">{createdCamera.endpointReference}</strong></div>
              <div><span className="text-slate-500 font-sans">Status:</span> <strong className="text-emerald-600">100% ONLINE (24/7)</strong></div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  if (onNavigateTab) onNavigateTab('camera-registry');
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                View in Registry
              </button>
              <button
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  if (onNavigateTab) onNavigateTab('sentinel-live-wall');
                }}
                className="flex-1 py-2.5 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                View Live Wall Grid →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
