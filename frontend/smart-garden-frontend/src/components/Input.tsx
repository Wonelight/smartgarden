import React, { type InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    /** Icon rendered inside the input wrapper, vertically centered with the input field */
    leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className, leftIcon, ...props }, refFromForwardRef) => {
        // Support ref from props (e.g. react-hook-form Controller's field.ref) so form values are captured correctly
        const refToUse = (props as { ref?: React.Ref<HTMLInputElement> }).ref ?? refFromForwardRef;
        const { ref: _refProp, ...restProps } = props as InputProps & { ref?: React.Ref<HTMLInputElement> };
        return (
            <div className="w-full relative">
                {label && (
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {leftIcon && (
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 transition-colors z-10 group-focus-within:text-emerald-500">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={refToUse}
                        className={clsx(
                            'w-full rounded-2xl border transition-all duration-200 outline-none',
                            'bg-slate-50',
                            'border-slate-200',
                            'text-slate-800',
                            'placeholder-slate-400',
                            'focus:border-emerald-500',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            leftIcon ? 'pl-12 pr-4' : 'px-4',
                            'py-3.5',
                            error && 'border-amber-500 focus:border-amber-500',
                            className
                        )}
                        {...restProps}
                    />
                </div>
                {error && (
                    <p className="mt-1.5 text-sm text-amber-600 font-medium">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
