import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { storage } from '../utils/storage';
import { Button } from '../components/Button';
import { Sprout, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
    username: z.string().min(1, 'Tên đăng nhập không được để trống'),
    password: z.string().min(1, 'Mật khẩu không được để trống'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { username: '', password: '' },
    });

    useEffect(() => {
        const savedUsername = storage.getSavedUsername();
        const remembered = storage.getRememberMe();
        setRememberMe(remembered);
        if (savedUsername) {
            reset({ username: savedUsername, password: '' });
        }
    }, [reset]);

    const onSubmit = async (data: LoginFormData) => {
        const username = data.username?.trim() ?? '';
        const password = data.password ?? '';
        if (!password) {
            toast.error('Vui lòng nhập mật khẩu.');
            return;
        }
        try {
            setIsLoading(true);
            await login(username, password, rememberMe);
            toast.success('Chào mừng bạn trở lại Smart Garden!');
            navigate('/dashboard');
        } catch {
            // Error shown by api client interceptor
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="flex flex-row w-full min-h-screen bg-white"
            style={{ width: '100vw', height: '100vh', background: '#ffffff' }}
        >
            {/* AuthSection - 50% */}
            <section
                className="flex flex-col justify-center items-center flex-[1_1_50%] min-w-0 p-8"
                style={{ width: '50%' }}
            >
                <div
                    className="flex flex-col w-full max-w-[360px]"
                    style={{ width: 360, gap: 16 }}
                >
                    <h1
                        className="text-[28px] font-semibold"
                        style={{ fontSize: 28, fontWeight: 600, color: '#2DD4BF' }}
                    >
                        Chào bạn trở lại
                    </h1>
                    <p
                        className="text-sm"
                        style={{ fontSize: 14, color: '#94A3B8' }}
                    >
                        Nhập tên đăng nhập và mật khẩu để đăng nhập
                    </p>

                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col" style={{ gap: 16 }}>
                        <Controller
                            name="username"
                            control={control}
                            render={({ field }) => (
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Tên đăng nhập
                                    </label>
                                    <input
                                        {...field}
                                        type="text"
                                        placeholder="Nhập tên đăng nhập"
                                        autoComplete="username"
                                        disabled={isLoading}
                                        className="w-full border border-slate-200 rounded-lg px-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/20 focus:border-[#2DD4BF] transition-colors disabled:opacity-50"
                                        style={{ height: 44, borderRadius: 8 }}
                                    />
                                    {errors.username?.message && (
                                        <p className="mt-1 text-sm text-amber-600">{errors.username.message}</p>
                                    )}
                                </div>
                            )}
                        />

                        <Controller
                            name="password"
                            control={control}
                            render={({ field }) => (
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Mật khẩu
                                    </label>
                                    <div className="relative">
                                        <input
                                            {...field}
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Nhập mật khẩu"
                                            autoComplete="current-password"
                                            disabled={isLoading}
                                            className="w-full border border-slate-200 rounded-lg px-3 pr-10 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/20 focus:border-[#2DD4BF] transition-colors disabled:opacity-50"
                                            style={{ height: 44, borderRadius: 8 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/20 rounded"
                                            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                            tabIndex={-1}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-5 h-5" />
                                            ) : (
                                                <Eye className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password?.message && (
                                        <p className="mt-1 text-sm text-amber-600">{errors.password.message}</p>
                                    )}
                                </div>
                            )}
                        />

                        <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                            <label className="flex flex-row items-center gap-2 cursor-pointer select-none w-fit">
                            <span
                                role="switch"
                                aria-checked={rememberMe}
                                tabIndex={0}
                                onClick={() => setRememberMe((v) => !v)}
                                onKeyDown={(e) => {
                                    if (e.key === ' ' || e.key === 'Enter') {
                                        e.preventDefault();
                                        setRememberMe((v) => !v);
                                    }
                                }}
                                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 focus:ring-offset-2"
                                style={{
                                    background: rememberMe ? '#2DD4BF' : '#E2E8F0',
                                }}
                            >
                                <span
                                    className="absolute top-1/2 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
                                    style={{
                                        transform: rememberMe ? 'translate(20px, -50%)' : 'translate(0, -50%)',
                                    }}
                                />
                            </span>
                            <span className="text-[13px] leading-none" style={{ color: '#64748B' }}>
                                Ghi nhớ đăng nhập
                            </span>
                            </label>
                            <Link
                                to="/forgot-password"
                                className="text-[13px] font-medium text-[#2DD4BF] hover:underline"
                            >
                                Quên mật khẩu?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full font-semibold text-white border-0 focus:ring-2 focus:ring-[#2DD4BF]/30 focus:ring-offset-2"
                            style={{
                                height: 44,
                                borderRadius: 8,
                                background: '#2DD4BF',
                                color: '#ffffff',
                            }}
                            isLoading={isLoading}
                        >
                            ĐĂNG NHẬP
                        </Button>
                    </form>

                    <p className="text-center" style={{ fontSize: 13, color: '#94A3B8' }}>
                        Chưa có tài khoản?{' '}
                        <Link
                            to="/register"
                            className="font-medium text-[#2DD4BF] hover:underline"
                        >
                            Đăng ký
                        </Link>
                    </p>
                </div>
            </section>

            {/* BrandSection - 50% */}
            <section
                className="flex flex-col justify-center items-center flex-[1_1_50%] min-w-0 bg-gradient-to-br from-teal-400 to-teal-600"
                style={{ width: '50%', background: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)' }}
            >
                <div className="flex items-center justify-center w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-xl">
                    <Sprout className="w-12 h-12 text-white" aria-hidden />
                </div>
                <span className="sr-only">Smart Garden logo</span>
            </section>

            {/* Footer */}
            <footer
                className="fixed bottom-0 left-0 right-0 flex justify-center items-center bg-white border-t border-slate-100"
                style={{ height: 40 }}
            >
                <span className="text-sm text-slate-500">© 2026, Made by Hai Anh</span>
            </footer>
        </div>
    );
};
