import React, { useEffect, useRef, useState } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { PageSkeleton } from './ui/Skeleton';

const MIN_SKELETON_MS = 0;

/**
 * Khi chuyển trang: hiển thị skeleton tối thiểu 200ms, sau đó mới render nội dung thật.
 * Lần đầu load app không hiện skeleton. Áp dụng cho toàn bộ page trong MainLayout.
 */
export const PageTransition: React.FC = () => {
    const location = useLocation();
    const [showSkeleton, setShowSkeleton] = useState(false);
    const prevPathRef = useRef(location.pathname);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevPathRef.current = location.pathname;
            return;
        }
        if (prevPathRef.current === location.pathname) return;
        prevPathRef.current = location.pathname;
        setShowSkeleton(true);
        const t = setTimeout(() => setShowSkeleton(false), MIN_SKELETON_MS);
        return () => clearTimeout(t);
    }, [location.pathname]);

    if (showSkeleton) {
        return <PageSkeleton />;
    }
    return <Outlet />;
};
