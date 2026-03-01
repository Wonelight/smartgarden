import React from 'react';

export interface ConversationItem {
    id: string;
    user: string;
    messageSnippet: string;
    onReply?: () => void;
}

interface ConversationsListProps {
    title?: string;
    items: ConversationItem[];
}

export const ConversationsList: React.FC<ConversationsListProps> = ({
    title = 'Hội thoại',
    items,
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            </div>
            <div className="p-5 space-y-4">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">{item.user}</p>
                            <p className="text-sm text-slate-600 truncate mt-0.5">{item.messageSnippet}</p>
                        </div>
                        {item.onReply && (
                            <button
                                type="button"
                                data-user-id={item.user.toLowerCase().replace(/\s+/g, '-')}
                                onClick={item.onReply}
                                className="shrink-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            >
                                TRẢ LỜI
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
