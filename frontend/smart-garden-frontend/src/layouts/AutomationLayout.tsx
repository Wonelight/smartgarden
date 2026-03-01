import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Settings2, Brain } from 'lucide-react';

const tabs = [
    { to: '/automation/schedules', icon: CalendarDays, label: 'Lịch tưới' },
    { to: '/automation/config', icon: Settings2, label: 'Cấu hình' },
    { to: '/automation/predictions', icon: Brain, label: 'Dự báo' },
] as const;

export const AutomationLayout: React.FC = () => {
    return (
        <div className="space-y-5">
            <div className="border-b border-slate-200 bg-white rounded-xl shadow-sm px-1">
                <nav className="flex gap-1" aria-label="Tự động hóa">
                    {tabs.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={true}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors border-b-2 -mb-px ${
                                    isActive
                                        ? 'text-teal-600 border-teal-500 bg-teal-50/50'
                                        : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </div>
            <Outlet />
        </div>
    );
};
