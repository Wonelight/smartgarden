import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface ProgressBarProps {
    progress: number; // 0-100
    status?: 'loading' | 'success' | 'error' | 'idle';
    showPercentage?: boolean;
    animated?: boolean;
    className?: string;
    label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    status = 'loading',
    showPercentage = true,
    animated = true,
    className = '',
    label,
}) => {
    const [displayProgress, setDisplayProgress] = useState(0);

    useEffect(() => {
        if (animated) {
            const timer = setTimeout(() => {
                setDisplayProgress(progress);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setDisplayProgress(progress);
        }
    }, [progress, animated]);

    const statusColors = {
        loading: 'bg-teal-500',
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        idle: 'bg-slate-300',
    };

    const statusIcons = {
        loading: <Loader2 className="w-4 h-4 animate-spin text-teal-600" />,
        success: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        error: <XCircle className="w-4 h-4 text-red-600" />,
        idle: null,
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{label}</span>
                    {showPercentage && (
                        <span className="text-slate-500 font-medium">{Math.round(displayProgress)}%</span>
                    )}
                </div>
            )}
            <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`h-full ${statusColors[status]} transition-all duration-500 ease-out rounded-full`}
                    style={{ width: `${displayProgress}%` }}
                />
                {animated && status === 'loading' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]" />
                )}
            </div>
            {status !== 'idle' && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    {statusIcons[status]}
                    <span>
                        {status === 'loading' && 'Đang xử lý...'}
                        {status === 'success' && 'Hoàn thành'}
                        {status === 'error' && 'Có lỗi xảy ra'}
                    </span>
                </div>
            )}
        </div>
    );
};

// ============================================
// PROGRESS ILLUSION - Simulate progress for async operations
// ============================================

interface ProgressIllusionProps {
    duration?: number; // milliseconds
    onComplete?: () => void;
    className?: string;
    label?: string;
}

export const ProgressIllusion: React.FC<ProgressIllusionProps> = ({
    duration = 2000,
    onComplete,
    className = '',
    label = 'Đang xử lý...',
}) => {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<'loading' | 'success'>('loading');

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progressPercent = Math.min((elapsed / duration) * 100, 95); // Stop at 95%

            setProgress(progressPercent);

            if (progressPercent < 95) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Wait for actual completion
                setTimeout(() => {
                    setProgress(100);
                    setStatus('success');
                    setTimeout(() => {
                        onComplete?.();
                    }, 500);
                }, 200);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [duration, onComplete]);

    return <ProgressBar progress={progress} status={status} label={label} className={className} />;
};

// ============================================
// LINEAR PROGRESS - Simple linear progress indicator
// ============================================

export const LinearProgress: React.FC<{
    value: number;
    max?: number;
    className?: string;
    color?: 'teal' | 'blue' | 'emerald' | 'red';
}> = ({ value, max = 100, className = '', color = 'teal' }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const colorClasses = {
        teal: 'bg-teal-500',
        blue: 'bg-blue-500',
        emerald: 'bg-emerald-500',
        red: 'bg-red-500',
    };

    return (
        <div className={`w-full h-1 bg-slate-200 rounded-full overflow-hidden ${className}`}>
            <div
                className={`h-full ${colorClasses[color]} transition-all duration-300 ease-out rounded-full`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};
