import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Camera, Upload, Search, Loader2, AlertTriangle,
    CheckCircle, XCircle, Video, VideoOff,
    Maximize2, Leaf, Bug, Activity, Zap
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { plantApi } from '../api/plant';
import type {
    PlantAnalyzeResponse,
    Detection,
    CameraCaptureResponse,
    CameraStatusResponse,
} from '../api/plant';
import { getApiErrorMessage } from '../utils/apiError';

// ============================================
// HEALTH STATUS
// ============================================

const HEALTH_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
    healthy: { label: 'Khoẻ mạnh', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle className="w-5 h-5 text-emerald-600" /> },
    mild_stress: { label: 'Nhẹ', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200', icon: <AlertTriangle className="w-5 h-5 text-yellow-500" /> },
    moderate_stress: { label: 'Trung bình', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200', icon: <AlertTriangle className="w-5 h-5 text-orange-500" /> },
    severe_stress: { label: 'Nghiêm trọng', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: <XCircle className="w-5 h-5 text-red-500" /> },
    critical: { label: 'Nguy hiểm', color: 'text-red-900', bgColor: 'bg-red-100 border-red-300', icon: <XCircle className="w-5 h-5 text-red-700" /> },
};

// ============================================
// MAIN PAGE
// ============================================

export const PlantDiagnosisPage: React.FC = () => {

    // ── State ─────────────────────────────────────
    const [mode, setMode] = useState<'upload' | 'camera' | 'stream'>('upload');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<PlantAnalyzeResponse | null>(null);
    const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
    const [confidence, setConfidence] = useState(0.25);
    const [isStreaming, setIsStreaming] = useState(false);

    // Browser camera
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Camera status ─────────────────────────────
    const { data: cameraStatus } = useQuery<CameraStatusResponse>({
        queryKey: ['cameraStatus'],
        queryFn: () => plantApi.cameraStatus(),
        retry: false,
        refetchInterval: isStreaming ? 5000 : false,
    });

    // ── Analyze mutation ──────────────────────────
    const analyzeMutation = useMutation({
        mutationFn: (imageBase64: string) =>
            plantApi.analyze({
                imageBase64,
                task: 'detect',
                confidenceThreshold: confidence,
            }),
        onSuccess: (data) => {
            setAnalysisResult(data);
            setAnnotatedImage(null);
            toast.success(`Phân tích hoàn tất — ${data.inferenceMs}ms`);
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
    });

    // ── Camera capture mutation ───────────────────
    const captureMutation = useMutation({
        mutationFn: () =>
            plantApi.cameraCapture({ confidence, deviceId: 0 }),
        onSuccess: (data: CameraCaptureResponse) => {
            setAnalysisResult(data.analysis);
            setAnnotatedImage(data.annotatedImageBase64);
            toast.success(`Capture hoàn tất — ${data.analysis.inferenceMs}ms`);
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
    });

    // ── File upload handler ───────────────────────
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Chỉ hỗ trợ file ảnh (JPEG, PNG)');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File quá lớn (tối đa 10 MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data:image/...;base64, prefix
            const base64 = result.split(',')[1];
            setUploadedImage(result);
            setAnnotatedImage(null);
            setAnalysisResult(null);
            analyzeMutation.mutate(base64);
        };
        reader.readAsDataURL(file);
    }, [confidence]);

    // ── Browser camera controls ───────────────────
    const startBrowserCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 640, height: 480 },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            toast.error('Không thể truy cập camera. Kiểm tra quyền truy cập.');
        }
    }, []);

    const stopBrowserCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const captureFromBrowser = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        setUploadedImage(dataUrl);
        analyzeMutation.mutate(base64);
    }, [confidence]);

    // ── Server camera stream ──────────────────────
    const toggleServerStream = useCallback(() => {
        if (isStreaming) {
            setIsStreaming(false);
            plantApi.cameraClose().catch(() => { });
        } else {
            setIsStreaming(true);
            plantApi.cameraOpen(0).catch((err) => {
                toast.error(getApiErrorMessage(err));
                setIsStreaming(false);
            });
        }
    }, [isStreaming]);

    // Cleanup on mode change
    useEffect(() => {
        return () => {
            stopBrowserCamera();
        };
    }, [mode]);

    useEffect(() => {
        if (mode === 'camera') {
            startBrowserCamera();
        } else {
            stopBrowserCamera();
        }
    }, [mode]);

    const streamUrl = plantApi.getCameraStreamUrl({
        detect: true,
        confidence,
        fps: 10,
    });

    const isLoading = analyzeMutation.isPending || captureMutation.isPending;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Chẩn đoán bệnh cây</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Sử dụng AI (YOLO11) để phát hiện và phân tích bệnh trên lá cây
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Confidence:</span>
                    <input
                        type="range"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={confidence}
                        onChange={(e) => setConfidence(Number(e.target.value))}
                        className="w-20 h-1 accent-emerald-600"
                    />
                    <span className="text-xs font-medium text-gray-600 w-8">{(confidence * 100).toFixed(0)}%</span>
                </div>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2">
                <ModeButton
                    active={mode === 'upload'}
                    onClick={() => setMode('upload')}
                    icon={<Upload className="w-4 h-4" />}
                    label="Tải ảnh lên"
                />
                <ModeButton
                    active={mode === 'camera'}
                    onClick={() => setMode('camera')}
                    icon={<Camera className="w-4 h-4" />}
                    label="Camera trình duyệt"
                />
                <ModeButton
                    active={mode === 'stream'}
                    onClick={() => setMode('stream')}
                    icon={<Video className="w-4 h-4" />}
                    label="Camera server (YOLO live)"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Input / Camera */}
                <div className="space-y-4">
                    {/* Upload Mode */}
                    {mode === 'upload' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            {!uploadedImage ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                                >
                                    <Upload className="w-10 h-10 text-gray-400" />
                                    <span className="text-sm text-gray-500">
                                        Kéo thả hoặc nhấn để chọn ảnh
                                    </span>
                                    <span className="text-xs text-gray-400">JPEG, PNG — tối đa 10 MB</span>
                                </button>
                            ) : (
                                <div className="relative">
                                    <img
                                        src={annotatedImage ? `data:image/jpeg;base64,${annotatedImage}` : uploadedImage}
                                        alt="Uploaded"
                                        className="w-full rounded-lg object-contain max-h-96"
                                    />
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => {
                                                setUploadedImage(null);
                                                setAnalysisResult(null);
                                                setAnnotatedImage(null);
                                            }}
                                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            Ảnh khác
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isLoading}
                                            className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                            Phân tích lại
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Browser Camera Mode */}
                    {mode === 'camera' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full rounded-lg bg-gray-900 max-h-96"
                            />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={captureFromBrowser}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Camera className="w-4 h-4" />
                                    )}
                                    Chụp & Phân tích
                                </button>
                            </div>
                            {uploadedImage && (
                                <div className="mt-3">
                                    <p className="text-xs text-gray-400 mb-1">Ảnh đã chụp:</p>
                                    <img
                                        src={annotatedImage ? `data:image/jpeg;base64,${annotatedImage}` : uploadedImage}
                                        alt="Captured"
                                        className="w-full rounded-lg object-contain max-h-48"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Server Camera Stream Mode */}
                    {mode === 'stream' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                                    <span className="text-sm font-medium text-gray-700">
                                        {isStreaming ? 'LIVE — YOLO Detection' : 'Camera tắt'}
                                    </span>
                                </div>
                                {cameraStatus && (
                                    <span className="text-xs text-gray-400">
                                        Model: {cameraStatus.modelLoaded ? '✓' : '✗'}
                                    </span>
                                )}
                            </div>

                            {isStreaming ? (
                                <img
                                    src={streamUrl}
                                    alt="YOLO Live Stream"
                                    className="w-full rounded-lg bg-gray-900 max-h-96 object-contain"
                                />
                            ) : (
                                <div className="w-full h-64 bg-gray-900 rounded-lg flex items-center justify-center">
                                    <VideoOff className="w-12 h-12 text-gray-600" />
                                </div>
                            )}

                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={toggleServerStream}
                                    className={`flex-1 px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium ${isStreaming
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        }`}
                                >
                                    {isStreaming ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                                    {isStreaming ? 'Dừng stream' : 'Bắt đầu stream'}
                                </button>
                                {isStreaming && (
                                    <button
                                        onClick={() => captureMutation.mutate()}
                                        disabled={captureMutation.isPending}
                                        className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
                                    >
                                        {captureMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Maximize2 className="w-4 h-4" />
                                        )}
                                        Capture
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Results */}
                <div className="space-y-4">
                    {isLoading && !analysisResult && (
                        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                            <span className="text-sm text-gray-500">Đang phân tích ảnh...</span>
                        </div>
                    )}

                    {analysisResult && (
                        <>
                            {/* Health Summary Card */}
                            <HealthSummaryCard summary={analysisResult.summary} inferenceMs={analysisResult.inferenceMs} />

                            {/* Detections List */}
                            {analysisResult.detections.length > 0 && (
                                <DetectionsList detections={analysisResult.detections} />
                            )}

                            {/* No detections */}
                            {analysisResult.detections.length === 0 && analysisResult.summary.status === 'healthy' && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-emerald-800">Không phát hiện bệnh</p>
                                    <p className="text-xs text-emerald-600 mt-1">Cây trồng có vẻ khoẻ mạnh</p>
                                </div>
                            )}
                        </>
                    )}

                    {!analysisResult && !isLoading && (
                        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center gap-3 text-center">
                            <Leaf className="w-10 h-10 text-gray-300" />
                            <p className="text-sm text-gray-400">
                                {mode === 'upload'
                                    ? 'Tải ảnh lên để bắt đầu phân tích'
                                    : mode === 'camera'
                                        ? 'Chụp ảnh từ camera để phân tích'
                                        : 'Bắt đầu stream hoặc capture để phân tích'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// SUB-COMPONENTS
// ============================================

const ModeButton: React.FC<{
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${active
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
    >
        {icon}
        {label}
    </button>
);

const HealthSummaryCard: React.FC<{
    summary: PlantAnalyzeResponse['summary'];
    inferenceMs: number;
}> = ({ summary, inferenceMs }) => {
    const config = HEALTH_CONFIG[summary.status] ?? HEALTH_CONFIG.healthy;

    return (
        <div className={`rounded-xl border p-5 ${config.bgColor}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {config.icon}
                    <span className={`font-semibold ${config.color}`}>{config.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {inferenceMs}ms
                    </span>
                    <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {(summary.healthScore * 100).toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* Health score bar */}
            <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden mb-3">
                <div
                    className={`h-full rounded-full transition-all ${summary.healthScore >= 0.85 ? 'bg-emerald-500'
                        : summary.healthScore >= 0.65 ? 'bg-yellow-500'
                            : summary.healthScore >= 0.4 ? 'bg-orange-500'
                                : 'bg-red-500'
                        }`}
                    style={{ width: `${summary.healthScore * 100}%` }}
                />
            </div>

            {/* Disease / pest names */}
            {summary.diseaseNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {summary.diseaseNames.map((name, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                            <Leaf className="w-3 h-3" /> {name}
                        </span>
                    ))}
                </div>
            )}
            {summary.pestNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {summary.pestNames.map((name, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                            <Bug className="w-3 h-3" /> {name}
                        </span>
                    ))}
                </div>
            )}

            {/* Recommendation */}
            {summary.recommendation && (
                <p className="text-sm text-gray-700 mt-2">{summary.recommendation}</p>
            )}
        </div>
    );
};

const DetectionsList: React.FC<{ detections: Detection[] }> = ({ detections }) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
                Phát hiện ({detections.length})
            </h3>
        </div>
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {detections.map((det, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-xs font-bold text-emerald-700">
                            {i + 1}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">{det.label}</p>
                            <p className="text-xs text-gray-400">
                                [{Math.round(det.bbox.x1)}, {Math.round(det.bbox.y1)}] →
                                [{Math.round(det.bbox.x2)}, {Math.round(det.bbox.y2)}]
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                            {(det.confidence * 100).toFixed(1)}%
                        </div>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                            <div
                                className={`h-full rounded-full ${det.confidence >= 0.8 ? 'bg-emerald-500'
                                    : det.confidence >= 0.5 ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                    }`}
                                style={{ width: `${det.confidence * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);
