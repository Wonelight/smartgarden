import React from 'react';
import { Link } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';

const triggerStyles =
    'px-3 py-2 text-sm font-medium text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-sm outline-none focus:outline-none focus:ring-0 border-0 transition-colors';

const contentStyles =
    'min-w-[200px] bg-white rounded-sm border border-slate-200 shadow-sm p-1.5 z-[100]';

const itemStyles =
    'flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-sm outline-none cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors';

const itemDangerStyles =
    'flex items-center gap-2 px-2 py-2 text-sm text-red-600 rounded-sm outline-none cursor-pointer hover:bg-red-50 transition-colors';

interface DropdownProps {
    /** Custom trigger element, or use triggerLabel for default button */
    trigger?: React.ReactNode;
    /** Label for default trigger button (used when trigger is not provided) */
    triggerLabel?: string;
    children: React.ReactNode;
    contentClassName?: string;
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
}

export const Dropdown: React.FC<DropdownProps> & {
    Item: typeof DropdownItem;
    LinkItem: typeof DropdownLinkItem;
} = ({ trigger, triggerLabel, children, contentClassName, align = 'end', sideOffset = 8 }) => {
    const triggerNode = trigger ?? (
        <button type="button" className={triggerStyles}>
            {triggerLabel}
        </button>
    );
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>{triggerNode}</DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className={clsx(contentStyles, contentClassName)}
                    sideOffset={sideOffset}
                    align={align}
                >
                    {children}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
};

interface DropdownItemProps {
    children: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
    onClick?: () => void;
    variant?: 'default' | 'danger';
}

const DropdownItem: React.FC<DropdownItemProps> = ({
    children,
    icon,
    className,
    onClick,
    variant = 'default',
}) => (
    <DropdownMenu.Item
        className={clsx(
            variant === 'danger' ? itemDangerStyles : itemStyles,
            className
        )}
        onClick={onClick}
    >
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
    </DropdownMenu.Item>
);

interface DropdownLinkItemProps {
    to: string;
    state?: unknown;
    children: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

const DropdownLinkItem: React.FC<DropdownLinkItemProps> = ({
    to,
    state,
    children,
    icon,
    className,
}) => (
    <DropdownMenu.Item asChild>
        <Link
            to={to}
            state={state}
            className={clsx(itemStyles, 'w-full', className)}
        >
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
        </Link>
    </DropdownMenu.Item>
);

Dropdown.Item = DropdownItem;
Dropdown.LinkItem = DropdownLinkItem;
