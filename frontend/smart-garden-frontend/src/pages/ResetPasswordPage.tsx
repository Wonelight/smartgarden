import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Sprout, Lock, ArrowRight, Mail, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../api/auth';

const verifyCodeSchema = z.object({
    email: z.string().min(1, 'Email không được để trống').email('Email không đúng định dạng'),
    code: z
        .string()
        .length(6, 'Mã xác nhận phải là 6 số')
        .regex(/^\d{6}$/, 'Mã xác nhận phải là 6 chữ số'),
});

const passwordSchema = z
    .object({
        newPassword: z
            .string()
            .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
            .max(100, 'Mật khẩu tối đa 100 ký tự')
            .regex(/^(?=.*[a-zA-Z])(?=.*[0-9])/, 'Mật khẩu phải chứa cả chữ và số'),
        confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Mật khẩu xác nhận không khớp',
        path: ['confirmPassword'],
    });

type VerifyCodeFormData = z.infer<typeof verifyCodeSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export const ResetPasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const emailFromQuery = searchParams.get('email') ?? '';
    const [step, setStep] = useState<'verify' | 'password' | 'success'>('verify');
    const [verifiedEmail, setVerifiedEmail] = useState('');
    const [verifiedCode, setVerifiedCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const verifyForm = useForm<VerifyCodeFormData>({
        resolver: zodResolver(verifyCodeSchema),
        defaultValues: { email: emailFromQuery || '', code: '' },
    });

    const passwordForm = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    const onVerifyCode = async (data: VerifyCodeFormData) => {
        try {
            setIsLoading(true);
            await authApi.verifyResetCode(data.email, data.code);
            setVerifiedEmail(data.email);
            setVerifiedCode(data.code);
            setStep('password');
            toast.success('Mã xác nhận hợp lệ. Vui lòng nhập mật khẩu mới.');
        } catch {
            // Error shown by api client interceptor
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmitPassword = async (data: PasswordFormData) => {
        try {
            setIsLoading(true);
            await authApi.resetPassword({
                email: verifiedEmail,
                code: verifiedCode,
                newPassword: data.newPassword,
            });
            setStep('success');
            toast.success('Đã đổi mật khẩu. Bạn có thể đăng nhập ngay.');
        } catch {
            // Error shown by api client interceptor
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex w-full bg-white">
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-500 to-teal-600 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1530968464165-7a1861cbaf9f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
                <div className="relative z-10 p-12 text-center text-white max-w-lg">
                    <div className="bg-white/20 backdrop-blur-md w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl border border-white/30">
                        <Sprout className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-5xl font-bold mb-6 tracking-tight text-white drop-shadow-sm">
                        {step === 'verify' ? 'Xác nhận mã' : step === 'password' ? 'Mật khẩu mới' : 'Hoàn tất'}
                    </h2>
                    <p className="text-xl text-emerald-50 leading-relaxed font-medium">
                        {step === 'verify' &&
                            'Nhập mã 6 số từ email để xác nhận trước khi đặt mật khẩu mới.'}
                        {step === 'password' &&
                            'Chọn mật khẩu mạnh: tối thiểu 8 ký tự, có cả chữ và số.'}
                        {step === 'success' && 'Mật khẩu đã được cập nhật thành công.'}
                    </p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-emerald-600/50 to-transparent" />
            </div>

            <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative bg-slate-50">
                <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
                    <div className="lg:hidden text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl mb-4 text-white shadow-lg">
                            <Sprout className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Smart Garden</h1>
                    </div>

                    {step === 'verify' && (
                        <>
                            <div className="text-left space-y-2">
                                <h1 className="text-3xl font-bold tracking-tight text-slate-800">
                                    Xác nhận mã
                                </h1>
                                <p className="text-slate-500 font-medium">
                                    Nhập email và mã 6 số từ email để tiếp tục.
                                </p>
                            </div>

                            <form onSubmit={verifyForm.handleSubmit(onVerifyCode)} className="space-y-6">
                                <Input
                                    label="Email"
                                    type="email"
                                    placeholder="email@example.com"
                                    leftIcon={<Mail className="w-5 h-5" />}
                                    className="py-4 bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl font-medium text-slate-700 placeholder:text-slate-400"
                                    {...verifyForm.register('email')}
                                    error={verifyForm.formState.errors.email?.message}
                                    disabled={isLoading}
                                    readOnly={!!emailFromQuery}
                                />

                                <Input
                                    label="Mã xác nhận (6 số)"
                                    type="text"
                                    placeholder="000000"
                                    maxLength={6}
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    leftIcon={<KeyRound className="w-5 h-5" />}
                                    className="py-4 bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl font-medium text-slate-700 placeholder:text-slate-400 tracking-[0.5em] text-center"
                                    {...verifyForm.register('code')}
                                    error={verifyForm.formState.errors.code?.message}
                                    disabled={isLoading}
                                />

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="w-full py-4 text-base rounded-2xl shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold tracking-wide"
                                    isLoading={isLoading}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        Xác nhận mã <ArrowRight className="w-5 h-5" />
                                    </span>
                                </Button>
                            </form>
                        </>
                    )}

                    {step === 'password' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setStep('verify')}
                                className="text-sm text-slate-500 hover:text-emerald-600"
                            >
                                ← Quay lại nhập mã
                            </button>
                            <div className="text-left space-y-2">
                                <h1 className="text-3xl font-bold tracking-tight text-slate-800">
                                    Đặt mật khẩu mới
                                </h1>
                                <p className="text-slate-500 font-medium">
                                    Mật khẩu tối thiểu 8 ký tự, phải chứa cả chữ và số.
                                </p>
                            </div>

                            <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-6">
                                <div className="relative">
                                    <Input
                                        label="Mật khẩu mới"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Tối thiểu 8 ký tự, có chữ và số"
                                        leftIcon={<Lock className="w-5 h-5" />}
                                        className="py-4 pr-12 bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl font-medium text-slate-700 placeholder:text-slate-400"
                                        {...passwordForm.register('newPassword')}
                                        error={passwordForm.formState.errors.newPassword?.message}
                                        disabled={isLoading}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>

                                <div className="relative">
                                    <Input
                                        label="Xác nhận mật khẩu mới"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Nhập lại mật khẩu"
                                        leftIcon={<Lock className="w-5 h-5" />}
                                        className="py-4 pr-12 bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl font-medium text-slate-700 placeholder:text-slate-400"
                                        {...passwordForm.register('confirmPassword')}
                                        error={passwordForm.formState.errors.confirmPassword?.message}
                                        disabled={isLoading}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((v) => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                                        tabIndex={-1}
                                        aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="w-full py-4 text-base rounded-2xl shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold tracking-wide"
                                    isLoading={isLoading}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        Cập nhật mật khẩu <ArrowRight className="w-5 h-5" />
                                    </span>
                                </Button>
                            </form>
                        </>
                    )}

                    {step === 'success' && (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                            <p className="text-emerald-800 font-medium">
                                Mật khẩu của bạn đã được cập nhật.
                            </p>
                            <Link
                                to="/login"
                                className="mt-4 inline-block font-semibold text-emerald-600 hover:underline"
                            >
                                Đăng nhập
                            </Link>
                        </div>
                    )}

                    <p className="text-center text-sm text-slate-500 font-medium">
                        <Link
                            to="/login"
                            className="font-bold text-emerald-600 hover:text-teal-600 hover:underline decoration-2 underline-offset-4"
                        >
                            Quay lại đăng nhập
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};
