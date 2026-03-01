import React from 'react';

const TEAL = '#2DD4BF';
const GRAY = '#E2E8F0';

export interface PlatformSettingItem {
    id: string;
    name: string;
    label: string;
    defaultChecked?: boolean;
}

interface PlatformSettingsProps {
    title?: string;
    items: PlatformSettingItem[];
    values: Record<string, boolean>;
    onChange: (name: string, checked: boolean) => void;
}

export const PlatformSettings: React.FC<PlatformSettingsProps> = ({
    title = 'Cài đặt nền tảng',
    items,
    values,
    onChange,
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            </div>
            <div className="p-5 space-y-4">
                {items.map((item) => {
                    const checked = values[item.name] ?? item.defaultChecked ?? false;
                    return (
                        <label
                            key={item.id}
                            className="flex items-center justify-between gap-4 cursor-pointer group"
                        >
                            <span className="text-sm text-slate-700">{item.label}</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={checked}
                                onClick={() => onChange(item.name, !checked)}
                                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:ring-offset-2"
                                style={{ background: checked ? TEAL : GRAY }}
                            >
                                <span
                                    className="absolute top-1/2 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
                                    style={{
                                        transform: checked ? 'translate(20px, -50%)' : 'translate(0, -50%)',
                                    }}
                                />
                            </button>
                        </label>
                    );
                })}
            </div>
        </div>
    );
};
