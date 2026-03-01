import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../components/Button';
import { Sprout, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { userApi } from '../api/user';
import { getValidationErrors, getApiErrorCode } from '../utils/apiError';

const registerSchema = z
    .object({
        name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
        username: z.string().min(1, 'Tên đăng nhập không được để trống'),
        password: z
            .string()
            .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
            .regex(/^(?=.*[a-zA-Z])(?=.*[0-9])/, 'Mật khẩu phải chứa chữ và số'),
        confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Mật khẩu xác nhận không khớp',
        path: ['confirmPassword'],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: { name: '', username: '', password: '', confirmPassword: '' },
    });

    /** Map tên field từ BE (SelfRegisterUserRequest) sang tên field form. */
    const mapApiFieldToFormField: Record<string, keyof RegisterFormData> = {
        username: 'username',
        password: 'password',
        email: 'username',
        fullName: 'name',
    };

    const onSubmit = async (data: RegisterFormData) => {
        try {
            setIsLoading(true);
            await userApi.register({
                username: data.username.trim(),
                email: null,
                fullName: data.name.trim() || undefined,
                password: data.password,
            });
            toast.success('Tạo tài khoản thành công. Vui lòng đăng nhập.');
            navigate('/login');
        } catch (err) {
            const code = getApiErrorCode(err);
            const validationErrors = getValidationErrors(err);
            if (code === 9002 && validationErrors && Object.keys(validationErrors).length > 0) {
                for (const [apiField, message] of Object.entries(validationErrors)) {
                    const formField = mapApiFieldToFormField[apiField] ?? apiField;
                    if (formField in { name: 1, username: 1, password: 1, confirmPassword: 1 }) {
                        setError(formField as keyof RegisterFormData, {
                            type: 'server',
                            message,
                        });
                    }
                }
                toast.error('Vui lòng kiểm tra các trường bên dưới.');
            }
            // Các lỗi khác đã được interceptor hiển thị toast
        } finally {
            setIsLoading(false);
        }
    };

    const primaryColor = '#2DD4BF';
    const inputClass =
        'w-full border border-slate-200 rounded-lg px-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/20 focus:border-[#2DD4BF] transition-colors disabled:opacity-50';

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
                        style={{ fontSize: 28, fontWeight: 600, color: primaryColor }}
                    >
                        Đăng ký
                    </h1>
                    <p style={{ fontSize: 14, color: '#94A3B8' }}>
                        Tạo tài khoản bằng tên đăng nhập hoặc đăng nhập bằng mạng xã hội.
                    </p>

                    {/* Social auth - màu đúng thương hiệu (Facebook, Apple, Google), disabled */}
                    <div className="flex flex-row gap-2 w-full">
                        <button
                            type="button"
                            data-testid="social-fb"
                            disabled
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed opacity-90 border-0"
                            style={{ background: '#1877F2', color: '#FFFFFF' }}
                            title="Sắp ra mắt"
                        >
                            Facebook
                        </button>
                        <button
                            type="button"
                            data-testid="social-apple"
                            disabled
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed opacity-90 border-0"
                            style={{ background: '#000000', color: '#FFFFFF' }}
                            title="Sắp ra mắt"
                        >
                            Apple
                        </button>
                        <button
                            type="button"
                            data-testid="social-google"
                            disabled
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed opacity-90 border border-[#747775]"
                            style={{ background: '#FFFFFF', color: '#1F1F1F' }}
                            title="Sắp ra mắt"
                        >
                            Google
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="flex flex-col"
                        style={{ gap: 16 }}
                        data-testid="registration_form"
                    >
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Họ tên
                                    </label>
                                    <input
                                        {...field}
                                        type="text"
                                        name="name"
                                        placeholder="Nhập họ tên"
                                        autoComplete="name"
                                        disabled={isLoading}
                                        className={inputClass}
                                        style={{ height: 44, borderRadius: 8 }}
                                    />
                                    {errors.name?.message && (
                                        <p className="mt-1 text-sm text-amber-600 error-msg-name">
                                            {errors.name.message}
                                        </p>
                                    )}
                                </div>
                            )}
                        />

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
                                        name="username"
                                        placeholder="Nhập tên đăng nhập"
                                        autoComplete="username"
                                        disabled={isLoading}
                                        className={inputClass}
                                        style={{ height: 44, borderRadius: 8 }}
                                    />
                                    {errors.username?.message && (
                                        <p className="mt-1 text-sm text-amber-600 error-msg-username">
                                            {errors.username.message}
                                        </p>
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
                                            name="password"
                                            placeholder="Nhập mật khẩu"
                                            autoComplete="new-password"
                                            disabled={isLoading}
                                            className={inputClass + ' pr-10'}
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
                                        <p className="mt-1 text-sm text-amber-600 error-msg-password">
                                            {errors.password.message}
                                        </p>
                                    )}
                                </div>
                            )}
                        />

                        <Controller
                            name="confirmPassword"
                            control={control}
                            render={({ field }) => (
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Xác nhận mật khẩu
                                    </label>
                                    <div className="relative">
                                        <input
                                            {...field}
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="Nhập lại mật khẩu"
                                            autoComplete="new-password"
                                            disabled={isLoading}
                                            className={inputClass + ' pr-10'}
                                            style={{ height: 44, borderRadius: 8 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/20 rounded"
                                            aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                            tabIndex={-1}
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff className="w-5 h-5" />
                                            ) : (
                                                <Eye className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.confirmPassword?.message && (
                                        <p className="mt-1 text-sm text-amber-600">
                                            {errors.confirmPassword.message}
                                        </p>
                                    )}
                                </div>
                            )}
                        />

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
                                style={{ background: rememberMe ? primaryColor : '#E2E8F0' }}
                            >
                                <span
                                    className="absolute top-1/2 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
                                    style={{
                                        transform: rememberMe
                                            ? 'translate(20px, -50%)'
                                            : 'translate(0, -50%)',
                                    }}
                                />
                            </span>
                            <span className="text-[13px] leading-none" style={{ color: '#64748B' }}>
                                Ghi nhớ đăng nhập
                            </span>
                        </label>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full font-semibold text-white border-0 focus:ring-2 focus:ring-[#2DD4BF]/30 focus:ring-offset-2"
                            style={{
                                height: 44,
                                borderRadius: 8,
                                background: primaryColor,
                                color: '#ffffff',
                            }}
                            isLoading={isLoading}
                        >
                            ĐĂNG KÝ
                        </Button>
                    </form>

                    <p className="text-center" style={{ fontSize: 13, color: '#94A3B8' }}>
                        Đã có tài khoản?{' '}
                        <Link to="/login" className="font-medium text-[#2DD4BF] hover:underline">
                            Đăng nhập
                        </Link>
                    </p>
                </div>
            </section>

            {/* BrandSection - 50% */}
            <section
                className="flex flex-col justify-center items-center flex-[1_1_50%] min-w-0 bg-gradient-to-br from-teal-400 to-teal-600"
                style={{
                    width: '50%',
                    background: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)',
                }}
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
