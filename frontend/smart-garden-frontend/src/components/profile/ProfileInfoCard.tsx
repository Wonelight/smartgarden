import React from 'react';
import { Edit2 } from 'lucide-react';

export interface ProfileInfoField {
    label: string;
    value: string;
    dataField: string;
}

interface ProfileInfoCardProps {
    title?: string;
    fields: ProfileInfoField[];
    onEdit?: () => void;
}

export const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
    title = 'Thông tin cá nhân',
    fields,
    onEdit,
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                {onEdit && (
                    <button
                        type="button"
                        aria-label="Chỉnh sửa hồ sơ"
                        onClick={onEdit}
                        className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="p-5 space-y-4">
                {fields.map((field) => (
                    <div key={field.dataField} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <span className="text-sm font-medium text-slate-500 min-w-[100px]">{field.label}</span>
                        <span className="text-sm text-slate-900" data-field={field.dataField}>
                            {field.value || '—'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
