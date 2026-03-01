import React, { useState, useEffect } from 'react';
import { User, Box, Users, FileText, Loader2, X, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { userApi } from '../api/user';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import type { UserProfile, UpdateProfileRequest } from '../types';
import {
    PlatformSettings,
    ProfileInfoCard,
    ConversationsList,
    ProjectsGrid,
} from '../components/profile';

const TEAL = '#2DD4BF';

const PLATFORM_SETTINGS_ITEMS = [
    { id: 'switch_email_follows', name: 'email_follows', label: 'Gửi email khi có người theo dõi tôi', defaultChecked: true },
    { id: 'switch_email_answers', name: 'email_answers', label: 'Gửi email khi có người trả lời bài viết của tôi', defaultChecked: false },
    { id: 'switch_new_launches', name: 'new_launches', label: 'Tin ra mắt và dự án mới', defaultChecked: false },
];

type ProfileTab = 'overview' | 'teams' | 'projects';

export const ProfilePage: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
    const [platformSettings, setPlatformSettings] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(PLATFORM_SETTINGS_ITEMS.map((i) => [i.name, i.defaultChecked ?? false]))
    );

    // Edit profile modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFullName, setEditFullName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Đổi mật khẩu (dropdown)
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const data = await userApi.getMyProfile();
            setProfile(data);
        } catch {
            toast.error('Không thể tải thông tin người dùng');
        } finally {
            setLoading(false);
        }
    };

    const handlePlatformSettingChange = (name: string, checked: boolean) => {
        setPlatformSettings((prev) => ({ ...prev, [name]: checked }));
    };

    const openEditModal = () => {
        setEditFullName(profile?.fullName ?? '');
        setEditEmail(profile?.email ?? '');
        setShowEditModal(true);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        const payload: UpdateProfileRequest = {
            fullName: editFullName.trim() || undefined,
            email: editEmail.trim() || undefined,
        };
        if (payload.fullName === profile.fullName && payload.email === profile.email) {
            toast.info('Không có thay đổi nào để cập nhật');
            return;
        }
        try {
            setSavingProfile(true);
            const updated = await userApi.updateMyProfile(payload);
            setProfile(updated);
            setShowEditModal(false);
            toast.success('Cập nhật thông tin thành công!');
        } catch {
            toast.error('Cập nhật thông tin thất bại');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('Mật khẩu xác nhận không khớp!');
            return;
        }
        if (newPassword.length < 8) {
            toast.error('Mật khẩu mới phải có ít nhất 8 ký tự!');
            return;
        }
        if (!/(?=.*[A-Za-z])(?=.*[0-9])/.test(newPassword)) {
            toast.error('Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số');
            return;
        }
        try {
            setChangingPassword(true);
            await userApi.changePassword({
                currentPassword,
                newPassword,
            });
            toast.success('Đổi mật khẩu thành công!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            toast.error('Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại');
        } finally {
            setChangingPassword(false);
        }
    };

    const profileFields = [
        { label: 'Họ và tên', value: profile?.fullName ?? '', dataField: 'fullname' },
        { label: 'Số điện thoại', value: '', dataField: 'mobile' },
        { label: 'Email', value: profile?.email ?? '', dataField: 'email' },
        { label: 'Địa chỉ', value: 'Việt Nam', dataField: 'location' },
    ];

    const conversationItems = [
        { id: 'conv_item_1', user: 'Esthera Jackson', messageSnippet: 'Xin chào! Tôi cần thêm thông tin...', onReply: () => {} },
    ];

    const projectCards = [
        { id: 'project-1', title: 'Hiện đại', subtitle: 'Dự án #1', imageAlt: 'Nội thất hiện đại', onViewAll: () => {} },
    ];

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: TEAL }} />
                    <p className="mt-4 text-slate-600 font-medium">Đang tải thông tin tài khoản...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
            {/* ProfileHeader */}
            <div className="profile-header bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-6">
                    <div className="profile-header-avatar shrink-0">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-50 border-2 border-white shadow flex items-center justify-center">
                            <User className="w-10 h-10 text-teal-600" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-slate-900 truncate">
                            {profile?.fullName || profile?.username || 'Chưa đặt tên'}
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">@{profile?.username}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1 border-t border-slate-200 px-6">
                    {[
                        { id: 'overview', label: 'TỔNG QUAN', icon: Box },
                        { id: 'teams', label: 'NHÓM', icon: Users },
                        { id: 'projects', label: 'DỰ ÁN', icon: FileText },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                name={tab.id}
                                aria-selected={isSelected}
                                onClick={() => setActiveTab(tab.id as ProfileTab)}
                                className={`
                                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                                    ${isSelected
                                        ? 'border-teal-500 text-teal-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ContentGrid + ProjectsArea */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <PlatformSettings
                        title="Cài đặt nền tảng"
                        items={PLATFORM_SETTINGS_ITEMS}
                        values={platformSettings}
                        onChange={handlePlatformSettingChange}
                    />
                    <ProfileInfoCard
                        title="Thông tin cá nhân"
                        fields={profileFields}
                        onEdit={openEditModal}
                    />

                    {/* Đổi mật khẩu - dropdown */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setChangePasswordOpen((o) => !o)}
                            className="w-full px-5 py-4 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors"
                            aria-expanded={changePasswordOpen}
                        >
                            <div className="flex items-center gap-2">
                                <Lock className="w-5 h-5 text-slate-600 shrink-0" />
                                <h3 className="text-base font-semibold text-slate-900">Đổi mật khẩu</h3>
                            </div>
                            {changePasswordOpen ? (
                                <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                            )}
                        </button>
                        {changePasswordOpen && (
                            <div className="border-t border-slate-200">
                                <form onSubmit={handleChangePassword} className="p-5 space-y-4">
                                    <Input
                                        label="Mật khẩu hiện tại"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu hiện tại"
                                        autoComplete="current-password"
                                    />
                                    <Input
                                        label="Mật khẩu mới"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Ít nhất 8 ký tự, có chữ và số"
                                        autoComplete="new-password"
                                    />
                                    <Input
                                        label="Xác nhận mật khẩu mới"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu mới"
                                        autoComplete="new-password"
                                        error={confirmPassword && newPassword !== confirmPassword ? 'Mật khẩu không khớp' : undefined}
                                    />
                                    <Button
                                        type="submit"
                                        disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                                        isLoading={changingPassword}
                                        className="bg-teal-500 hover:bg-teal-600 text-white border-0"
                                    >
                                        Đổi mật khẩu
                                    </Button>
                                </form>
                            </div>
                        )}
                    </div>

                    <ConversationsList title="Hội thoại" items={conversationItems} />
                </div>
                <div className="lg:col-span-1">
                    <ProjectsGrid
                        projects={projectCards}
                        onCreateNew={() => toast.info('Chức năng tạo dự án sắp ra mắt')}
                    />
                </div>
            </div>

            {/* Edit Profile Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">Chỉnh sửa thông tin</h3>
                            <button
                                type="button"
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                                onClick={() => setShowEditModal(false)}
                                aria-label="Đóng"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
                            <Input
                                label="Họ và tên"
                                type="text"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                placeholder="Nguyễn Văn A"
                            />
                            <Input
                                label="Email"
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="email@example.com"
                            />
                            <p className="text-xs text-slate-500">Tên đăng nhập (@{profile?.username}) không thể thay đổi.</p>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowEditModal(false)}
                                >
                                    Hủy
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={savingProfile}
                                    className="flex-1 bg-teal-500 hover:bg-teal-600 text-white border-0"
                                >
                                    Lưu thay đổi
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
