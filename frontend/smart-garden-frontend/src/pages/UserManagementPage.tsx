import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    X,
    Search,
    UserCheck,
    UserX,
    Eye,
    MoreVertical,
    Download,
    Upload,
    Columns3,
    Filter,
    ChevronLeft,
    ChevronRight,
    Save,
    FileSpreadsheet,
    History,
} from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { toast } from 'sonner';
import { userApi } from '../api/user';
import { roleApi } from '../api/role';
import type {
    AdminUserListItem,
    AdminUserDetail,
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
    RoleListItem,
} from '../types';
import { useAuth } from '../hooks/useAuth';
import { Dropdown } from '../components/Dropdown';
import { Input } from '../components/Input';
import { cn } from '../utils/cn';

const PAGE_SIZES = [10, 20, 50] as const;
const SAVED_FILTERS_KEY = 'user-mgmt-saved-filters';

type ColumnId = 'user' | 'email' | 'roles' | 'status' | 'createdAt' | 'actions';
const COLUMNS: { id: ColumnId; label: string }[] = [
    { id: 'user', label: 'Người dùng' },
    { id: 'email', label: 'Email' },
    { id: 'roles', label: 'Vai trò' },
    { id: 'status', label: 'Trạng thái' },
    { id: 'createdAt', label: 'Ngày tạo' },
    { id: 'actions', label: 'Thao tác' },
];

interface SavedFilter {
    id: string;
    name: string;
    search: string;
    role: string;
    status: string;
}

function loadSavedFilters(): SavedFilter[] {
    try {
        const raw = localStorage.getItem(SAVED_FILTERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveSavedFilters(filters: SavedFilter[]) {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}

export const UserManagementPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<AdminUserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(
        new Set(COLUMNS.map((c) => c.id))
    );
    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(loadSavedFilters);
    const [newFilterName, setNewFilterName] = useState('');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
    const [viewDetailUser, setViewDetailUser] = useState<AdminUserDetail | null>(null);
    const [formSubmitting, setFormSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await userApi.adminGetAllUsers();
            setUsers(data);
        } catch {
            // Error handled by API interceptor
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (data: AdminCreateUserRequest) => {
        try {
            setFormSubmitting(true);
            await userApi.adminCreateUser(data);
            toast.success('Tạo người dùng thành công!');
            setIsCreateModalOpen(false);
            fetchUsers();
        } catch {
            // Error handled by API interceptor
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleUpdateUser = async (data: AdminUpdateUserRequest) => {
        if (!selectedUser) return;
        try {
            setFormSubmitting(true);
            await userApi.adminUpdateUser(selectedUser.id, data);
            toast.success('Cập nhật người dùng thành công!');
            setIsEditModalOpen(false);
            setSelectedUser(null);
            fetchUsers();
        } catch {
            // Error handled by API interceptor
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        try {
            setFormSubmitting(true);
            await userApi.adminDeleteUser(selectedUser.id);
            toast.success('Xóa người dùng thành công!');
            setIsDeleteModalOpen(false);
            setSelectedUser(null);
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(selectedUser.id);
                return next;
            });
            fetchUsers();
        } catch {
            // Error handled by API interceptor
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedIds).filter((id) => id !== currentUserId);
        if (ids.length === 0) {
            toast.error('Không thể xóa chính mình. Vui lòng bỏ chọn tài khoản của bạn.');
            return;
        }
        try {
            setFormSubmitting(true);
            await Promise.all(ids.map((id) => userApi.adminDeleteUser(id)));
            toast.success(`Đã xóa ${ids.length} người dùng`);
            setSelectedIds(new Set());
            fetchUsers();
        } catch {
            // Error handled by API interceptor
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleBulkUpdateStatus = async (isActive: boolean) => {
        const ids = Array.from(selectedIds).filter((id) => id !== currentUserId);
        if (ids.length === 0) {
            toast.error('Không thể thay đổi trạng thái chính mình. Vui lòng bỏ chọn tài khoản của bạn.');
            return;
        }
        try {
            setFormSubmitting(true);
            await Promise.all(
                ids.map((id) => userApi.adminUpdateUser(id, { isActive }))
            );
            toast.success(
                isActive
                    ? `Đã kích hoạt ${ids.length} người dùng`
                    : `Đã vô hiệu ${ids.length} người dùng`
            );
            setSelectedIds(new Set());
            fetchUsers();
        } catch {
            // Error handled by API interceptor
        } finally {
            setFormSubmitting(false);
        }
    };

    const openViewDetail = async (user: AdminUserListItem) => {
        setViewDetailUser(null);
        setIsViewModalOpen(true);
        try {
            const detail = await userApi.adminGetUserById(user.id);
            setViewDetailUser(detail);
        } catch {
            toast.error('Không thể tải thông tin chi tiết');
        }
    };

    const uniqueRoles = useMemo(() => {
        const set = new Set<string>();
        users.forEach((u) => u.roles.forEach((r) => set.add(r)));
        return Array.from(set).sort();
    }, [users]);

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchSearch =
                !searchQuery ||
                user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchRole =
                roleFilter === 'all' || user.roles.includes(roleFilter);
            const matchStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && user.isActive) ||
                (statusFilter === 'inactive' && !user.isActive);
            return matchSearch && matchRole && matchStatus;
        });
    }, [users, searchQuery, roleFilter, statusFilter]);

    const totalCount = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const paginatedUsers = filteredUsers.slice(start, start + pageSize);
    const startItem = totalCount === 0 ? 0 : start + 1;
    const endItem = Math.min(start + pageSize, totalCount);

    const currentUserId = useMemo(
        () => users.find((u) => u.username === currentUser?.username)?.id ?? null,
        [users, currentUser?.username]
    );
    const selectableUsers = useMemo(
        () => paginatedUsers.filter((u) => u.id !== currentUserId),
        [paginatedUsers, currentUserId]
    );

    const toggleColumn = (id: ColumnId) => {
        if (id === 'actions') return;
        setVisibleColumns((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const saveCurrentFilter = () => {
        const name = newFilterName.trim() || `Bộ lọc ${savedFilters.length + 1}`;
        const newFilter: SavedFilter = {
            id: Date.now().toString(),
            name,
            search: searchQuery,
            role: roleFilter,
            status: statusFilter,
        };
        const next = [...savedFilters, newFilter];
        setSavedFilters(next);
        saveSavedFilters(next);
        setNewFilterName('');
        toast.success('Đã lưu bộ lọc');
    };

    const loadFilter = (f: SavedFilter) => {
        setSearchQuery(f.search);
        setRoleFilter(f.role);
        setStatusFilter(f.status);
        setPage(1);
    };

    const removeSavedFilter = (id: string) => {
        const next = savedFilters.filter((f) => f.id !== id);
        setSavedFilters(next);
        saveSavedFilters(next);
    };

    const exportCSV = () => {
        const headers = ['Username', 'Email', 'Họ tên', 'Vai trò', 'Trạng thái', 'Ngày tạo'];
        const rows = filteredUsers.map((u) => [
            u.username,
            u.email ?? '',
            u.fullName ?? '',
            u.roles.join('; '),
            u.isActive ? 'Hoạt động' : 'Vô hiệu',
            new Date(u.createdAt).toLocaleDateString('vi-VN'),
        ]);
        const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Đã xuất CSV');
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    };

    const toggleSelectAll = () => {
        const allSelectableSelected =
            selectableUsers.length > 0 &&
            selectableUsers.every((u) => selectedIds.has(u.id));
        if (allSelectableSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectableUsers.map((u) => u.id)));
        }
    };

    const toggleSelectOne = (id: number) => {
        if (id === currentUserId) return;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allSelected =
        selectableUsers.length > 0 &&
        selectableUsers.every((u) => selectedIds.has(u.id));
    const someSelected = selectedIds.size > 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto px-2 py-4 sm:px-4 sm:py-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Users className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Quản lý người dùng
                        </h1>
                        <p className="text-sm text-slate-500">
                            {users.length} người dùng
                        </p>
                    </div>
                </div>
            </div>

            {/* FilterBar — chiều cao đồng nhất h-10 (40px) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 order-first">
                        <button
                            type="button"
                            onClick={saveCurrentFilter}
                            className="h-10 flex items-center gap-1.5 px-3 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200"
                        >
                            <Save className="w-4 h-4 shrink-0" />
                            Lưu bộ lọc
                        </button>
                        <input
                            type="text"
                            value={newFilterName}
                            onChange={(e) => setNewFilterName(e.target.value)}
                            placeholder="Tên bộ lọc"
                            className="h-10 w-36 px-3 border border-slate-300 rounded-lg text-sm focus:border-emerald-500 outline-none"
                        />
                    </div>
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Tìm theo tên, email, username..."
                            className="h-10 w-full pl-10 pr-4 border border-slate-300 rounded-lg focus:border-emerald-500 outline-none transition-colors text-sm"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            setPage(1);
                        }}
                        className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 min-w-[120px] cursor-pointer focus:border-emerald-500 outline-none"
                        aria-label="Lọc theo vai trò"
                    >
                        <option value="all">Tất cả vai trò</option>
                        {uniqueRoles.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 min-w-[130px] cursor-pointer focus:border-emerald-500 outline-none"
                        aria-label="Lọc theo trạng thái"
                    >
                        <option value="all">Tất cả</option>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Vô hiệu</option>
                    </select>
                    <Dropdown
                        trigger={
                            <button
                                type="button"
                                className="h-10 flex items-center gap-2 px-4 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 border border-violet-700 shadow-sm transition-colors"
                            >
                                <Filter className="w-4 h-4 shrink-0" />
                                Bộ lọc đã lưu
                            </button>
                        }
                    >
                        {savedFilters.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-slate-500">
                                Chưa có bộ lọc nào
                            </div>
                        ) : (
                            savedFilters.map((f) => (
                                <Dropdown.Item
                                    key={f.id}
                                    onClick={() => loadFilter(f)}
                                    className="flex items-center justify-between gap-2 group"
                                >
                                    <span className="min-w-0 truncate">{f.name}</span>
                                    <button
                                        type="button"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            removeSavedFilter(f.id);
                                        }}
                                        className="p-1 shrink-0 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={`Xóa bộ lọc ${f.name}`}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </Dropdown.Item>
                            ))
                        )}
                    </Dropdown>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm người dùng
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Xuất CSV
                    </button>
                    <button
                        onClick={() => toast.info('Chức năng nhập file đang phát triển')}
                        className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
                    >
                        <Upload className="w-4 h-4" />
                        Nhập file
                    </button>
                    <button
                        type="button"
                        onClick={() => toast.info('Nhật ký kiểm toán đang phát triển')}
                        className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
                    >
                        <History className="w-4 h-4" />
                        Audit log
                    </button>
                    <Dropdown
                        trigger={
                            <button
                                type="button"
                                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
                            >
                                <Columns3 className="w-4 h-4" />
                                Cột hiển thị
                            </button>
                        }
                        contentClassName="p-2 min-w-[180px]"
                    >
                        {COLUMNS.filter((c) => c.id !== 'actions').map((c) => (
                            <label
                                key={c.id}
                                className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.has(c.id)}
                                    onChange={() => toggleColumn(c.id)}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                                />
                                <span className="text-sm text-slate-700">{c.label}</span>
                            </label>
                        ))}
                    </Dropdown>
                </div>
            </div>

            {/* Bulk actions bar — chỉ hiện khi có ít nhất 1 row được chọn */}
            {someSelected && (
                <div
                    className="flex flex-wrap items-center gap-3 mb-4 py-4 px-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm"
                    role="region"
                    aria-label="Thao tác hàng loạt"
                >
                    <span className="text-sm font-semibold text-emerald-800">
                        Đã chọn {selectedIds.size} người dùng
                    </span>
                    <span className="text-slate-400">|</span>
                    <button
                        type="button"
                        onClick={() => selectedIds.size > 0 && !formSubmitting && handleBulkUpdateStatus(true)}
                        disabled={formSubmitting}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={formSubmitting ? 'Đang xử lý...' : `Kích hoạt ${selectedIds.size} người dùng`}
                    >
                        <UserCheck className="w-4 h-4 shrink-0" />
                        Kích hoạt
                    </button>
                    <button
                        type="button"
                        onClick={() => selectedIds.size > 0 && !formSubmitting && handleBulkUpdateStatus(false)}
                        disabled={formSubmitting}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={formSubmitting ? 'Đang xử lý...' : `Vô hiệu ${selectedIds.size} người dùng`}
                    >
                        <UserX className="w-4 h-4 shrink-0" />
                        Vô hiệu
                    </button>
                    <button
                        type="button"
                        onClick={() => selectedIds.size > 0 && !formSubmitting && handleBulkDelete()}
                        disabled={formSubmitting}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={formSubmitting ? 'Đang xử lý...' : `Xóa ${selectedIds.size} người dùng đã chọn`}
                    >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        Xóa đã chọn
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        disabled={formSubmitting}
                        className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border-2 border-slate-400 rounded-lg hover:bg-slate-100 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        title="Bỏ chọn tất cả"
                        aria-label="Bỏ chọn tất cả"
                    >
                        <X className="w-4 h-4 shrink-0" />
                        Bỏ chọn
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                {visibleColumns.has('user') && (
                                    <th className="w-12 px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = someSelected && !allSelected;
                                            }}
                                            onChange={toggleSelectAll}
                                            disabled={selectableUsers.length === 0}
                                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </th>
                                )}
                                {visibleColumns.has('user') && (
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                                        Người dùng
                                    </th>
                                )}
                                {visibleColumns.has('email') && (
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                                        Email
                                    </th>
                                )}
                                {visibleColumns.has('roles') && (
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                                        Vai trò
                                    </th>
                                )}
                                {visibleColumns.has('status') && (
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                                        Trạng thái
                                    </th>
                                )}
                                {visibleColumns.has('createdAt') && (
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                                        Ngày tạo
                                    </th>
                                )}
                                {visibleColumns.has('actions') && (
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                                        Thao tác
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginatedUsers.map((user) => {
                                const isSelf = user.id === currentUserId;
                                return (
                                <tr
                                    key={user.id}
                                    className={cn(
                                        'hover:bg-slate-50 transition-colors',
                                        isSelf && 'bg-slate-50/70'
                                    )}
                                >
                                    {visibleColumns.has('user') && (
                                        <td className="w-12 px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(user.id)}
                                                onChange={() => toggleSelectOne(user.id)}
                                                disabled={isSelf}
                                                title={isSelf ? 'Không thể chọn chính mình' : undefined}
                                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                        </td>
                                    )}
                                    {visibleColumns.has('user') && (
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-slate-900">
                                                    {user.fullName || user.username}
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    @{user.username}
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.has('email') && (
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {user.email || '-'}
                                        </td>
                                    )}
                                    {visibleColumns.has('roles') && (
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles.map((role) => (
                                                    <span
                                                        key={role}
                                                        className={cn(
                                                            'px-2 py-0.5 text-xs font-medium rounded-full',
                                                            role.includes('ADMIN')
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : 'bg-emerald-100 text-emerald-700'
                                                        )}
                                                    >
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.has('status') && (
                                        <td className="px-6 py-4">
                                            {user.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                                    <UserCheck className="w-3 h-3" />
                                                    Hoạt động
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                                    <UserX className="w-3 h-3" />
                                                    Vô hiệu
                                                </span>
                                            )}
                                        </td>
                                    )}
                                    {visibleColumns.has('createdAt') && (
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {formatDate(user.createdAt)}
                                        </td>
                                    )}
                                    {visibleColumns.has('actions') && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="hidden sm:flex items-center gap-1">
                                                    <button
                                                        onClick={() => openViewDetail(user)}
                                                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (!isSelf) {
                                                                setSelectedUser(user);
                                                                setIsEditModalOpen(true);
                                                            }
                                                        }}
                                                        disabled={isSelf}
                                                        className={cn(
                                                            'p-2 rounded-lg transition-colors',
                                                            isSelf
                                                                ? 'text-slate-300 cursor-not-allowed'
                                                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                                        )}
                                                        title={isSelf ? 'Không thể chỉnh sửa chính mình' : 'Chỉnh sửa'}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (!isSelf) {
                                                                setSelectedUser(user);
                                                                setIsDeleteModalOpen(true);
                                                            }
                                                        }}
                                                        disabled={isSelf}
                                                        className={cn(
                                                            'p-2 rounded-lg transition-colors',
                                                            isSelf
                                                                ? 'text-slate-300 cursor-not-allowed'
                                                                : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                                        )}
                                                        title={isSelf ? 'Không thể xóa chính mình' : 'Xóa'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </span>
                                                <span className="sm:hidden">
                                                    <Dropdown
                                                        trigger={
                                                            <button
                                                                type="button"
                                                                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                                title="Thêm"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>
                                                        }
                                                        align="end"
                                                    >
                                                        <Dropdown.Item
                                                            icon={<Eye className="w-4 h-4" />}
                                                            onClick={() => openViewDetail(user)}
                                                        >
                                                            Xem chi tiết
                                                        </Dropdown.Item>
                                                        {!isSelf && (
                                                            <>
                                                                <Dropdown.Item
                                                                    icon={<Pencil className="w-4 h-4" />}
                                                                    onClick={() => {
                                                                        setSelectedUser(user);
                                                                        setIsEditModalOpen(true);
                                                                    }}
                                                                >
                                                                    Chỉnh sửa
                                                                </Dropdown.Item>
                                                                <Dropdown.Item
                                                                    icon={<Trash2 className="w-4 h-4" />}
                                                                    variant="danger"
                                                                    onClick={() => {
                                                                        setSelectedUser(user);
                                                                        setIsDeleteModalOpen(true);
                                                                    }}
                                                                >
                                                                    Xóa
                                                                </Dropdown.Item>
                                                            </>
                                                        )}
                                                        {isSelf && (
                                                            <div className="px-2 py-2 text-xs text-slate-500 italic">
                                                                Không thể chỉnh sửa/xóa chính mình
                                                            </div>
                                                        )}
                                                    </Dropdown>
                                                </span>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-slate-600 font-medium">Không có dữ liệu</p>
                        <p className="text-sm text-slate-500 mt-1">
                            Thử thay đổi bộ lọc hoặc thêm người dùng mới
                        </p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 mt-4 py-3 px-4 bg-white rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">
                        Hiển thị <span className="font-medium">{startItem}</span>–
                        <span className="font-medium">{endItem}</span> trong{' '}
                        <span className="font-medium">{totalCount}</span> người dùng
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">Số dòng:</span>
                            <select
                                value={String(pageSize)}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="w-[70px] inline-flex items-center justify-between gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm cursor-pointer focus:border-emerald-500 outline-none"
                                aria-label="Số dòng mỗi trang"
                            >
                                {PAGE_SIZES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter((p) => {
                                    if (totalPages <= 7) return true;
                                    if (p === 1 || p === totalPages) return true;
                                    if (Math.abs(p - currentPage) <= 1) return true;
                                    return false;
                                })
                                .reduce<number[]>((acc, p, i, arr) => {
                                    if (i > 0 && p - arr[i - 1] > 1) acc.push(-1);
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p) =>
                                    p === -1 ? (
                                        <span
                                            key={`ellipsis-${p}`}
                                            className="px-2 text-slate-400"
                                        >
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPage(p)}
                                            className={cn(
                                                'min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-colors',
                                                p === currentPage
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                                            )}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateUser}
                isSubmitting={formSubmitting}
            />

            <EditUserModal
                isOpen={isEditModalOpen}
                user={selectedUser}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
                }}
                onSubmit={handleUpdateUser}
                isSubmitting={formSubmitting}
            />

            <ViewUserModal
                isOpen={isViewModalOpen}
                user={viewDetailUser}
                onClose={() => {
                    setIsViewModalOpen(false);
                    setViewDetailUser(null);
                }}
            />

            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                user={selectedUser}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedUser(null);
                }}
                onConfirm={handleDeleteUser}
                isSubmitting={formSubmitting}
            />
        </div>
    );
};

// ================== MODALS ==================

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AdminCreateUserRequest) => void;
    isSubmitting: boolean;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
}) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<string>('USER');
    const [roles, setRoles] = useState<RoleListItem[]>([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && roles.length === 0) {
            setRolesLoading(true);
            roleApi
                .getAllRoles()
                .then(setRoles)
                .catch(() => toast.error('Không tải được danh sách vai trò'))
                .finally(() => setRolesLoading(false));
        }
    }, [isOpen, roles.length]);

    const validate = () => {
        const e: Record<string, string> = {};
        
        // Validate username
        if (!username.trim()) {
            e.username = 'Tên đăng nhập là bắt buộc';
        } else if (username.trim().length < 3) {
            e.username = 'Tên đăng nhập phải có ít nhất 3 ký tự';
        } else if (username.trim().length > 50) {
            e.username = 'Tên đăng nhập không được vượt quá 50 ký tự';
        } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
            e.username = 'Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới';
        }
        
        // Validate password
        if (!password) {
            e.password = 'Mật khẩu là bắt buộc';
        } else if (password.length < 8) {
            e.password = 'Mật khẩu phải có ít nhất 8 ký tự';
        } else if (password.length > 100) {
            e.password = 'Mật khẩu không được vượt quá 100 ký tự';
        }
        
        // Validate email (optional but validate format if provided)
        if (email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                e.email = 'Email không hợp lệ';
            } else if (email.trim().length > 255) {
                e.email = 'Email không được vượt quá 255 ký tự';
            }
        }
        
        // Validate fullName (optional but check length if provided)
        if (fullName.trim() && fullName.trim().length > 100) {
            e.fullName = 'Họ và tên không được vượt quá 100 ký tự';
        }
        
        setErrors(e);
        return Object.keys(e).length === 0;
    };
    
    const validateField = (field: string, value: string): string => {
        switch (field) {
            case 'username':
                if (!value.trim()) return 'Tên đăng nhập là bắt buộc';
                if (value.trim().length < 3) return 'Tên đăng nhập phải có ít nhất 3 ký tự';
                if (value.trim().length > 50) return 'Tên đăng nhập không được vượt quá 50 ký tự';
                if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) return 'Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới';
                return '';
            case 'password':
                if (!value) return 'Mật khẩu là bắt buộc';
                if (value.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
                if (value.length > 100) return 'Mật khẩu không được vượt quá 100 ký tự';
                return '';
            case 'email':
                if (value.trim()) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value.trim())) return 'Email không hợp lệ';
                    if (value.trim().length > 255) return 'Email không được vượt quá 255 ký tự';
                }
                return '';
            case 'fullName':
                if (value.trim() && value.trim().length > 100) return 'Họ và tên không được vượt quá 100 ký tự';
                return '';
            default:
                return '';
        }
    };
    
    const handleFieldBlur = (field: string, value: string) => {
        const error = validateField(field, value);
        if (error) {
            setErrors({ ...errors, [field]: error });
        } else {
            const newErrors = { ...errors };
            delete newErrors[field];
            setErrors(newErrors);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        onSubmit({
            username: username.trim(),
            password,
            email: email.trim() || undefined,
            fullName: fullName.trim() || undefined,
            role: role || 'USER',
        });
    };

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setEmail('');
        setFullName('');
        setRole('USER');
        setErrors({});
    };

    useEffect(() => {
        if (!isOpen) resetForm();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Thêm người dùng mới
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Tên đăng nhập"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            if (errors.username) {
                                const error = validateField('username', e.target.value);
                                if (error) {
                                    setErrors({ ...errors, username: error });
                                } else {
                                    const newErrors = { ...errors };
                                    delete newErrors.username;
                                    setErrors(newErrors);
                                }
                            }
                        }}
                        onBlur={(e) => handleFieldBlur('username', e.target.value)}
                        error={errors.username}
                        required
                        placeholder="username"
                    />
                    <Input
                        label="Mật khẩu"
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) {
                                const error = validateField('password', e.target.value);
                                if (error) {
                                    setErrors({ ...errors, password: error });
                                } else {
                                    const newErrors = { ...errors };
                                    delete newErrors.password;
                                    setErrors(newErrors);
                                }
                            }
                        }}
                        onBlur={(e) => handleFieldBlur('password', e.target.value)}
                        error={errors.password}
                        required
                        minLength={8}
                        placeholder="••••••••"
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) {
                                const error = validateField('email', e.target.value);
                                if (error) {
                                    setErrors({ ...errors, email: error });
                                } else {
                                    const newErrors = { ...errors };
                                    delete newErrors.email;
                                    setErrors(newErrors);
                                }
                            }
                        }}
                        onBlur={(e) => handleFieldBlur('email', e.target.value)}
                        error={errors.email}
                        placeholder="email@example.com"
                    />
                    <Input
                        label="Họ và tên"
                        value={fullName}
                        onChange={(e) => {
                            setFullName(e.target.value);
                            if (errors.fullName) {
                                const error = validateField('fullName', e.target.value);
                                if (error) {
                                    setErrors({ ...errors, fullName: error });
                                } else {
                                    const newErrors = { ...errors };
                                    delete newErrors.fullName;
                                    setErrors(newErrors);
                                }
                            }
                        }}
                        onBlur={(e) => handleFieldBlur('fullName', e.target.value)}
                        error={errors.fullName}
                        placeholder="Nguyễn Văn A"
                    />

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Vai trò
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            disabled={rolesLoading}
                            className="h-10 w-full px-4 border border-slate-300 rounded-2xl text-slate-800 bg-slate-50 focus:border-emerald-500 outline-none disabled:opacity-50"
                            aria-label="Chọn vai trò"
                        >
                            {rolesLoading ? (
                                <option value="USER">Đang tải...</option>
                            ) : roles.length === 0 ? (
                                <option value="USER">USER (mặc định)</option>
                            ) : (
                                roles.map((r) => (
                                    <option key={r.id} value={r.name}>
                                        {r.name}
                                        {r.description ? ` — ${r.description}` : ''}
                                    </option>
                                ))
                            )}
                        </select>
                        {!rolesLoading && roles.length === 0 && !errors.role && (
                            <p className="mt-1.5 text-sm text-amber-600 font-medium">
                                Không có vai trò nào (mặc định USER)
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || Object.keys(errors).length > 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Tạo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface EditUserModalProps {
    isOpen: boolean;
    user: AdminUserListItem | null;
    onClose: () => void;
    onSubmit: (data: AdminUpdateUserRequest) => void;
    isSubmitting: boolean;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
    isOpen,
    user,
    onClose,
    onSubmit,
    isSubmitting,
}) => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<string>('USER');
    const [isActive, setIsActive] = useState(true);
    const [roles, setRoles] = useState<RoleListItem[]>([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (user) {
            setEmail(user.email || '');
            setFullName(user.fullName || '');
            setRole(user.roles?.[0] ?? 'USER');
            setIsActive(user.isActive);
        }
    }, [user]);

    useEffect(() => {
        if (isOpen && roles.length === 0) {
            setRolesLoading(true);
            roleApi
                .getAllRoles()
                .then(setRoles)
                .catch(() => toast.error('Không tải được danh sách vai trò'))
                .finally(() => setRolesLoading(false));
        }
    }, [isOpen, roles.length]);

    const validate = () => {
        const e: Record<string, string> = {};
        
        // Validate email (optional but validate format if provided)
        if (email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                e.email = 'Email không hợp lệ';
            } else if (email.trim().length > 255) {
                e.email = 'Email không được vượt quá 255 ký tự';
            }
        }
        
        // Validate fullName (optional but check length if provided)
        if (fullName.trim() && fullName.trim().length > 100) {
            e.fullName = 'Họ và tên không được vượt quá 100 ký tự';
        }
        
        setErrors(e);
        return Object.keys(e).length === 0;
    };
    
    const validateField = (field: string, value: string): string => {
        switch (field) {
            case 'email':
                if (value.trim()) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value.trim())) return 'Email không hợp lệ';
                    if (value.trim().length > 255) return 'Email không được vượt quá 255 ký tự';
                }
                return '';
            case 'fullName':
                if (value.trim() && value.trim().length > 100) return 'Họ và tên không được vượt quá 100 ký tự';
                return '';
            default:
                return '';
        }
    };
    
    const handleFieldBlur = (field: string, value: string) => {
        const error = validateField(field, value);
        if (error) {
            setErrors({ ...errors, [field]: error });
        } else {
            const newErrors = { ...errors };
            delete newErrors[field];
            setErrors(newErrors);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        onSubmit({
            email: email.trim() || undefined,
            fullName: fullName.trim() || undefined,
            role: role || undefined,
            isActive,
        });
    };
    
    useEffect(() => {
        if (!isOpen) {
            setErrors({});
        }
    }, [isOpen]);

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Chỉnh sửa người dùng
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-500">Tên đăng nhập</div>
                    <div className="font-medium text-slate-900">{user.username}</div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) {
                                const error = validateField('email', e.target.value);
                                if (error) {
                                    setErrors({ ...errors, email: error });
                                } else {
                                    const newErrors = { ...errors };
                                    delete newErrors.email;
                                    setErrors(newErrors);
                                }
                            }
                        }}
                        onBlur={(e) => handleFieldBlur('email', e.target.value)}
                        error={errors.email}
                        placeholder="email@example.com"
                    />
                    <Input
                        label="Họ và tên"
                        value={fullName}
                        onChange={(e) => {
                            setFullName(e.target.value);
                            if (errors.fullName) {
                                const error = validateField('fullName', e.target.value);
                                if (error) {
                                    setErrors({ ...errors, fullName: error });
                                } else {
                                    const newErrors = { ...errors };
                                    delete newErrors.fullName;
                                    setErrors(newErrors);
                                }
                            }
                        }}
                        onBlur={(e) => handleFieldBlur('fullName', e.target.value)}
                        error={errors.fullName}
                        placeholder="Nguyễn Văn A"
                    />

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Vai trò
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            disabled={rolesLoading}
                            className="h-10 w-full px-4 border border-slate-300 rounded-2xl text-slate-800 bg-slate-50 focus:border-emerald-500 outline-none disabled:opacity-50"
                            aria-label="Chọn vai trò"
                        >
                            {rolesLoading ? (
                                <option value={role}>Đang tải...</option>
                            ) : roles.length === 0 ? (
                                <option value="USER">USER</option>
                            ) : (
                                roles.map((r) => (
                                    <option key={r.id} value={r.name}>
                                        {r.name}
                                        {r.description ? ` — ${r.description}` : ''}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <div>
                            <p className="text-sm font-medium text-slate-700">
                                Tài khoản hoạt động
                            </p>
                            <p className="text-xs text-slate-500">
                                Tắt sẽ vô hiệu hóa đăng nhập
                            </p>
                        </div>
                        <Switch.Root
                            checked={isActive}
                            onCheckedChange={setIsActive}
                            className="w-11 h-6 bg-slate-200 rounded-full relative data-[state=checked]:bg-emerald-500 transition-colors outline-none focus:outline-none flex-shrink-0"
                        >
                            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transition-transform translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                        </Switch.Root>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || Object.keys(errors).length > 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface ViewUserModalProps {
    isOpen: boolean;
    user: AdminUserDetail | null;
    onClose: () => void;
}

const ViewUserModal: React.FC<ViewUserModalProps> = ({
    isOpen,
    user,
    onClose,
}) => {
    if (!isOpen) return null;

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleString('vi-VN', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Chi tiết người dùng
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {!user ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                Tên đăng nhập
                            </div>
                            <div className="font-medium text-slate-900">{user.username}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                Email
                            </div>
                            <div className="text-slate-700">{user.email || '-'}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                Họ và tên
                            </div>
                            <div className="text-slate-700">{user.fullName || '-'}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                Vai trò
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {user.roles.map((r) => (
                                    <span
                                        key={r}
                                        className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700"
                                    >
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                Trạng thái
                            </div>
                            <div>
                                {user.isActive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                        <UserCheck className="w-3 h-3" />
                                        Hoạt động
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                        <UserX className="w-3 h-3" />
                                        Vô hiệu
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                    Ngày tạo
                                </div>
                                <div className="text-sm text-slate-700">
                                    {formatDate(user.createdAt)}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                    Cập nhật
                                </div>
                                <div className="text-sm text-slate-700">
                                    {formatDate(user.updatedAt)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

interface DeleteConfirmModalProps {
    isOpen: boolean;
    user: AdminUserListItem | null;
    onClose: () => void;
    onConfirm: () => void;
    isSubmitting: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    isOpen,
    user,
    onClose,
    onConfirm,
    isSubmitting,
}) => {
    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Xác nhận xóa
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-slate-600 mb-6">
                    Bạn có chắc chắn muốn xóa người dùng{' '}
                    <span className="font-semibold text-slate-900">{user.username}</span>?
                    Hành động này không thể hoàn tác.
                </p>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Xóa
                    </button>
                </div>
            </div>
        </div>
    );
};
