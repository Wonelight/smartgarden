import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopNavbar } from '../components/TopNavbar';
import { PageTransition } from '../components/PageTransition';
import { ChatbotModal } from '../components/ChatbotModal';
import { MonitoringDeviceProvider } from '../contexts/MonitoringDeviceContext';

export const MainLayout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <MonitoringDeviceProvider>
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto overflow-x-auto min-h-0 w-full">
                    <div className="min-h-full w-full p-5">
                        <PageTransition />
                    </div>
                </main>
            </div>
            <ChatbotModal />
        </div>
        </MonitoringDeviceProvider>
    );
};
