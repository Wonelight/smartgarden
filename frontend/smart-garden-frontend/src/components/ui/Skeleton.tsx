import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rectangular',
    width,
    height,
    animation = 'pulse',
}) => {
    const baseClasses = 'bg-slate-200';
    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: '',
        rounded: 'rounded-lg',
    };
    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-[shimmer_2s_infinite]',
        none: '',
    };

    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
            style={style}
        />
    );
};

// ============================================
// SKELETON VARIANTS
// ============================================

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm ${className}`}>
        <div className="flex items-center gap-3 mb-3">
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="text" width="40%" height={20} />
        </div>
        <Skeleton variant="text" width="60%" height={24} className="mb-2" />
        <Skeleton variant="text" width="80%" height={16} />
    </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
            <Skeleton variant="text" width="30%" height={20} />
        </div>
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        {Array.from({ length: cols }).map((_, i) => (
                            <th key={i} className="px-4 py-3 text-left">
                                <Skeleton variant="text" width="60%" height={16} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-slate-50">
                            {Array.from({ length: cols }).map((_, colIdx) => (
                                <td key={colIdx} className="px-4 py-3">
                                    <Skeleton variant="text" width={colIdx === 0 ? '80%' : '60%'} height={16} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export const SkeletonChart: React.FC<{ height?: number }> = ({ height = 300 }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <Skeleton variant="text" width="40%" height={20} className="mb-4" />
        <Skeleton variant="rounded" width="100%" height={height} />
    </div>
);

export const SkeletonStatsGrid: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} />
        ))}
    </div>
);

export const SkeletonList: React.FC<{ items?: number }> = ({ items = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                    <Skeleton variant="circular" width={48} height={48} />
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" width="60%" height={18} />
                        <Skeleton variant="text" width="40%" height={14} />
                    </div>
                    <Skeleton variant="rounded" width={80} height={32} />
                </div>
            </div>
        ))}
    </div>
);

/** Skeleton layout cho toàn bộ vùng nội dung trang (khi chuyển route) */
export const PageSkeleton: React.FC = () => (
    <div className="space-y-6">
        <div>
            <Skeleton variant="text" width={240} height={32} className="mb-2" />
            <Skeleton variant="text" width={360} height={20} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <SkeletonChart height={280} />
            </div>
            <SkeletonCard />
        </div>
        <SkeletonList items={4} />
    </div>
);

// Add shimmer animation to global CSS (or use Tailwind)
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
        }
        .animate-\\[shimmer_2s_infinite\\] {
            background: linear-gradient(to right, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
            background-size: 1000px 100%;
            animation: shimmer 2s infinite;
        }
    `;
    document.head.appendChild(style);
}
