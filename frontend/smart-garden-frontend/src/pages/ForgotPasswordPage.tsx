import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Sprout, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../api/auth';

const forgotSchema = z.object({
    email: z.string().min(1, 'Email không được để trống').email('Email không đúng định dạng'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export const ForgotPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotFormData>({
        resolver: zodResolver(forgotSchema),
    });

    const onSubmit = async (data: ForgotFormData) => {
        try {
            setIsLoading(true);
            const res = await authApi.forgotPassword({ email: data.email });
            setSubmitted(true);
            toast.success(res.message || 'Vui lòng kiểm tra email và nhập mã xác nhận 6 số.');
            navigate(`/reset-password?email=${encodeURIComponent(data.email)}`);
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
                    <h2 className="text-5xl font-bold mb-6 tracking-tight text-white drop-shadow-sm">Đặt lại mật khẩu</h2>
                    <p className="text-xl text-emerald-50 leading-relaxed font-medium">
                        Nhập email của bạn, chúng tôi sẽ gửi mã xác nhận 6 số qua email.
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

                    <div className="text-left space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Quên mật khẩu?</h1>
                        <p className="text-slate-500 font-medium">
                            Nhập email của bạn, chúng tôi sẽ gửi mã xác nhận 6 số qua email.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                            <p className="text-emerald-800 font-medium">
                                Nếu có tài khoản với email đó, bạn sẽ nhận được mã xác nhận 6 số. Vui lòng kiểm tra email và chuyển đến trang đặt lại mật khẩu.
                            </p>
                            <Link
                                to="/login"
                                className="mt-4 inline-block text-emerald-600 font-semibold hover:underline"
                            >
                                Quay lại đăng nhập
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <Input
                                label="Email"
                                type="email"
                                placeholder="email@example.com"
                                leftIcon={<Mail className="w-5 h-5" />}
                                className="pl-12 py-4 bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl font-medium text-slate-700 placeholder:text-slate-400"
                                {...register('email')}
                                error={errors.email?.message}
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
                                    Gửi mã xác nhận <ArrowRight className="w-5 h-5" />
                                </span>
                            </Button>
                        </form>
                    )}

                    <p className="text-center text-sm text-slate-500 font-medium">
                        Đã nhớ mật khẩu?{' '}
                        <Link to="/login" className="font-bold text-emerald-600 hover:text-teal-600 hover:underline decoration-2 underline-offset-4">
                            Đăng nhập
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};
