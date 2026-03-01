import React, { useState } from 'react';
import { toast } from 'sonner';
import {
    Layers, Search, Plus, Pencil, Trash2, X, Loader2
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { soilApi } from '../api/soil';
import type {
    SoilLibraryListItem,
    AdminCreateSoilLibraryRequest,
    AdminUpdateSoilLibraryRequest,
} from '../api/soil';
import { useAuth } from '../hooks/useAuth';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';
import { ProgressIllusion } from '../components/ui/ProgressBar';
import { SkeletonTable } from '../components/ui/Skeleton';

// ============================================
// SOIL LIBRARY TABLE
// ============================================

const SoilLibraryTable: React.FC<{
    soils: SoilLibraryListItem[];
    onEdit: (s: SoilLibraryListItem) => void;
    onDelete: (id: number) => void;
}> = ({ soils, onEdit, onDelete }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Tên loại đất</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">FC (%)</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">WP (%)</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Tỷ lệ thẩm thấu (shallow)</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {soils.map((soil) => (
                        <tr key={soil.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{soil.name}</td>
                            <td className="px-4 py-3 text-slate-600">{soil.fieldCapacity.toFixed(1)}</td>
                            <td className="px-4 py-3 text-slate-600">{soil.wiltingPoint.toFixed(1)}</td>
                            <td className="px-4 py-3 text-slate-600">
                                {soil.infiltrationShallowRatio != null
                                    ? (soil.infiltrationShallowRatio * 100).toFixed(0) + '%'
                                    : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => onEdit(soil)}
                                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                        title="Chỉnh sửa"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(soil.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Xóa"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {soils.length === 0 && (
            <div className="p-12 text-center">
                <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Chưa có loại đất nào</p>
            </div>
        )}
    </div>
);

// ============================================
// SOIL LIBRARY PAGE
// ============================================

export const SoilLibraryPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = checkIsAdmin(user);
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [formData, setFormData] = useState<
        Partial<AdminCreateSoilLibraryRequest & AdminUpdateSoilLibraryRequest & { id?: number }>
    >({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const { data: soils = [], isLoading: loadingSoils } = useQuery({
        queryKey: ['soilLibraries'],
        queryFn: soilApi.adminGetAllSoilLibraries,
        enabled: isAdmin,
        staleTime: 30000,
    });

    const createMutation = useOptimisticMutation({
        mutationFn: soilApi.adminCreateSoilLibrary,
        queryKey: ['soilLibraries'],
        optimisticUpdate: (variables) => {
            const newSoil: SoilLibraryListItem = {
                id: Date.now(),
                name: variables.name,
                fieldCapacity: variables.fieldCapacity,
                wiltingPoint: variables.wiltingPoint,
                infiltrationShallowRatio: variables.infiltrationShallowRatio || null,
                createdAt: new Date().toISOString(),
            };
            return [...soils, newSoil];
        },
        successMessage: 'Tạo loại đất thành công',
        errorMessage: 'Lỗi khi tạo loại đất',
        onSuccess: () => {
            setShowCreateModal(false);
            setFormData({});
        },
    });

    const updateMutation = useOptimisticMutation({
        mutationFn: ({ id, data }: { id: number; data: AdminUpdateSoilLibraryRequest }) =>
            soilApi.adminUpdateSoilLibrary(id, data),
        queryKey: ['soilLibraries'],
        optimisticUpdate: ({ id, data }) => {
            return soils.map((s) =>
                s.id === id ? { ...s, ...data } : s
            );
        },
        successMessage: 'Cập nhật loại đất thành công',
        errorMessage: 'Lỗi khi cập nhật loại đất',
        onSuccess: () => {
            setShowEditModal(false);
            setFormData({});
        },
    });

    const deleteMutation = useOptimisticMutation({
        mutationFn: soilApi.adminDeleteSoilLibrary,
        queryKey: ['soilLibraries'],
        optimisticUpdate: (soilId) => {
            return soils.filter((s) => s.id !== soilId);
        },
        successMessage: 'Xóa loại đất thành công',
        errorMessage: 'Lỗi khi xóa loại đất',
    });

    const filteredSoils = soils.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        
        // Validate name
        if (!formData.name || formData.name.trim() === '') {
            errors.name = 'Tên loại đất là bắt buộc';
        } else if (formData.name.length > 100) {
            errors.name = 'Tên không được vượt quá 100 ký tự';
        }
        
        // Validate fieldCapacity
        if (formData.fieldCapacity === undefined || formData.fieldCapacity === null || formData.fieldCapacity === '') {
            errors.fieldCapacity = 'FC là bắt buộc';
        } else if (formData.fieldCapacity < 0 || formData.fieldCapacity > 100) {
            errors.fieldCapacity = 'FC phải từ 0 đến 100';
        }
        
        // Validate wiltingPoint
        if (formData.wiltingPoint === undefined || formData.wiltingPoint === null || formData.wiltingPoint === '') {
            errors.wiltingPoint = 'WP là bắt buộc';
        } else if (formData.wiltingPoint < 0 || formData.wiltingPoint > 100) {
            errors.wiltingPoint = 'WP phải từ 0 đến 100';
        }
        
        // Cross-field validation: WP must be < FC
        if (
            formData.fieldCapacity != null &&
            formData.fieldCapacity !== '' &&
            formData.wiltingPoint != null &&
            formData.wiltingPoint !== '' &&
            formData.wiltingPoint >= formData.fieldCapacity
        ) {
            errors.wiltingPoint = 'WP phải nhỏ hơn FC';
        }
        
        // Validate infiltrationShallowRatio (optional)
        if (
            formData.infiltrationShallowRatio != null &&
            formData.infiltrationShallowRatio !== '' &&
            (formData.infiltrationShallowRatio < 0.2 || formData.infiltrationShallowRatio > 0.9)
        ) {
            errors.infiltrationShallowRatio = 'Tỷ lệ thẩm thấu phải từ 0.2 đến 0.9';
        }
        
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateField = (field: string, value: any): string => {
        switch (field) {
            case 'name':
                if (!value || (typeof value === 'string' && value.trim() === '')) return 'Tên loại đất là bắt buộc';
                if (typeof value === 'string' && value.length > 100) return 'Tên không được vượt quá 100 ký tự';
                return '';
            case 'fieldCapacity':
                if (value === undefined || value === null || value === '') return 'FC là bắt buộc';
                const fc = typeof value === 'number' ? value : parseFloat(value);
                if (isNaN(fc)) return 'FC phải là số hợp lệ';
                if (fc < 0 || fc > 100) return 'FC phải từ 0 đến 100';
                // Cross-field: check WP if exists
                if (formData.wiltingPoint != null && formData.wiltingPoint !== '' && formData.wiltingPoint >= fc) {
                    return 'FC phải lớn hơn WP';
                }
                return '';
            case 'wiltingPoint':
                if (value === undefined || value === null || value === '') return 'WP là bắt buộc';
                const wp = typeof value === 'number' ? value : parseFloat(value);
                if (isNaN(wp)) return 'WP phải là số hợp lệ';
                if (wp < 0 || wp > 100) return 'WP phải từ 0 đến 100';
                // Cross-field: check FC if exists
                if (formData.fieldCapacity != null && formData.fieldCapacity !== '' && wp >= formData.fieldCapacity) {
                    return 'WP phải nhỏ hơn FC';
                }
                return '';
            case 'infiltrationShallowRatio':
                if (value === undefined || value === null || value === '') return ''; // Optional field
                const ratio = typeof value === 'number' ? value : parseFloat(value);
                if (isNaN(ratio)) return 'Tỷ lệ thẩm thấu phải là số hợp lệ';
                if (ratio < 0.2 || ratio > 0.9) return 'Tỷ lệ thẩm thấu phải từ 0.2 đến 0.9';
                return '';
            default:
                return '';
        }
    };

    const handleCreate = () => {
        if (!validateForm()) {
            toast.error('Vui lòng kiểm tra lại thông tin đã nhập');
            return;
        }
        createMutation.mutate(formData as AdminCreateSoilLibraryRequest);
    };

    const handleUpdate = () => {
        if (!formData.id) return;
        if (!validateForm()) {
            toast.error('Vui lòng kiểm tra lại thông tin đã nhập');
            return;
        }
        const { id, ...payload } = formData;
        updateMutation.mutate({ id, data: payload as AdminUpdateSoilLibraryRequest });
    };

    const handleFieldChange = (field: string, value: any) => {
        const newFormData = { ...formData, [field]: value };
        setFormData(newFormData);
        
        // Realtime validation: validate current field
        const error = validateField(field, value);
        if (error) {
            setFormErrors({ ...formErrors, [field]: error });
        } else {
            const newErrors = { ...formErrors };
            delete newErrors[field];
            setFormErrors(newErrors);
        }
        
        // Cross-field validation: if FC changes, re-validate WP
        if (field === 'fieldCapacity' && formData.wiltingPoint != null && formData.wiltingPoint !== '') {
            const wpError = validateField('wiltingPoint', formData.wiltingPoint);
            if (wpError) {
                setFormErrors(prev => ({ ...prev, wiltingPoint: wpError }));
            } else {
                setFormErrors(prev => {
                    const next = { ...prev };
                    delete next.wiltingPoint;
                    return next;
                });
            }
        }
        
        // Cross-field validation: if WP changes, re-validate FC
        if (field === 'wiltingPoint' && formData.fieldCapacity != null && formData.fieldCapacity !== '') {
            const fcError = validateField('fieldCapacity', formData.fieldCapacity);
            if (fcError) {
                setFormErrors(prev => ({ ...prev, fieldCapacity: fcError }));
            } else {
                setFormErrors(prev => {
                    const next = { ...prev };
                    delete next.fieldCapacity;
                    return next;
                });
            }
        }
    };

    const handleFieldBlur = (field: string, value: any) => {
        const error = validateField(field, value);
        if (error) {
            setFormErrors({ ...formErrors, [field]: error });
        } else {
            const newErrors = { ...formErrors };
            delete newErrors[field];
            setFormErrors(newErrors);
        }
        
        // Cross-field validation on blur
        if (field === 'fieldCapacity' && formData.wiltingPoint != null && formData.wiltingPoint !== '') {
            const wpError = validateField('wiltingPoint', formData.wiltingPoint);
            if (wpError) {
                setFormErrors(prev => ({ ...prev, wiltingPoint: wpError }));
            }
        }
        if (field === 'wiltingPoint' && formData.fieldCapacity != null && formData.fieldCapacity !== '') {
            const fcError = validateField('fieldCapacity', formData.fieldCapacity);
            if (fcError) {
                setFormErrors(prev => ({ ...prev, fieldCapacity: fcError }));
            }
        }
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setShowEditModal(false);
        setFormData({});
        setFormErrors({});
    };

    const openCreateModal = () => {
        setFormData({});
        setFormErrors({});
        setShowCreateModal(true);
    };

    const openEditModal = (soil: SoilLibraryListItem) => {
        setFormData({
            id: soil.id,
            name: soil.name,
            fieldCapacity: soil.fieldCapacity,
            wiltingPoint: soil.wiltingPoint,
            infiltrationShallowRatio: soil.infiltrationShallowRatio ?? undefined,
        });
        setFormErrors({});
        setShowEditModal(true);
    };

    if (!isAdmin) {
        return (
            <div className="space-y-8">
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                    <p className="text-slate-500">Bạn không có quyền truy cập trang này</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Quản lý loại đất</h1>
                    <p className="text-slate-500 mt-1">FC, WP và tỷ lệ thẩm thấu cho từng loại đất (FAO-56)</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Thêm loại đất
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm loại đất..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 transition-colors"
                    />
                </div>
                <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['soilLibraries'] })}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    title="Làm mới"
                >
                    <Loader2 className={`w-4 h-4 ${loadingSoils ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Tổng số loại đất</p>
                            <p className="text-xl font-bold text-slate-800">{soils.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {loadingSoils ? (
                <SkeletonTable rows={5} cols={5} />
            ) : (
                <>
                    {(createMutation.isPending || updateMutation.isPending || deleteMutation.isPending) && (
                        <div className="mb-4">
                            <ProgressIllusion
                                duration={1500}
                                label={
                                    createMutation.isPending ? 'Đang tạo loại đất...' :
                                    updateMutation.isPending ? 'Đang cập nhật loại đất...' :
                                    'Đang xóa loại đất...'
                                }
                            />
                        </div>
                    )}
                    <SoilLibraryTable
                        soils={filteredSoils}
                        onEdit={openEditModal}
                        onDelete={(id) => {
                            if (window.confirm('Bạn có chắc muốn xóa loại đất này?')) {
                                deleteMutation.mutate(id);
                            }
                        }}
                    />
                </>
            )}

            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="relative mb-6 pb-4 border-b border-slate-200">
                            <button
                                onClick={closeModal}
                                className="absolute right-0 top-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="text-xl font-bold text-slate-800">
                                {showCreateModal ? 'Thêm loại đất mới' : 'Cập nhật loại đất'}
                            </h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên loại đất *</label>
                                <input
                                    type="text"
                                    value={formData.name ?? ''}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    onBlur={(e) => handleFieldBlur('name', e.target.value)}
                                    placeholder="VD: Đất thịt (Loam)"
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                        formErrors.name
                                            ? 'border-red-300 focus:border-red-400 bg-red-50/50'
                                            : 'border-slate-200 focus:border-teal-400'
                                    }`}
                                />
                                {formErrors.name && (
                                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                        <span className="text-red-500">•</span>
                                        {formErrors.name}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">FC (%) *</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={formData.fieldCapacity ?? ''}
                                        onChange={(e) =>
                                            handleFieldChange(
                                                'fieldCapacity',
                                                e.target.value ? parseFloat(e.target.value) : ''
                                            )
                                        }
                                        onBlur={(e) =>
                                            handleFieldBlur('fieldCapacity', e.target.value ? parseFloat(e.target.value) : '')
                                        }
                                        placeholder="30"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                            formErrors.fieldCapacity
                                                ? 'border-red-300 focus:border-red-400 bg-red-50/50'
                                                : 'border-slate-200 focus:border-teal-400'
                                        }`}
                                    />
                                    {formErrors.fieldCapacity && (
                                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                            <span className="text-red-500">•</span>
                                            {formErrors.fieldCapacity}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">WP (%) *</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={formData.wiltingPoint ?? ''}
                                        onChange={(e) =>
                                            handleFieldChange(
                                                'wiltingPoint',
                                                e.target.value ? parseFloat(e.target.value) : ''
                                            )
                                        }
                                        onBlur={(e) =>
                                            handleFieldBlur('wiltingPoint', e.target.value ? parseFloat(e.target.value) : '')
                                        }
                                        placeholder="15"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                            formErrors.wiltingPoint
                                                ? 'border-red-300 focus:border-red-400 bg-red-50/50'
                                                : 'border-slate-200 focus:border-teal-400'
                                        }`}
                                    />
                                    {formErrors.wiltingPoint && (
                                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                            <span className="text-red-500">•</span>
                                            {formErrors.wiltingPoint}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                                    Tỷ lệ thẩm thấu tầng nông (0.2–0.9, tùy chọn)
                                </label>
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0.2"
                                    max="0.9"
                                    value={formData.infiltrationShallowRatio ?? ''}
                                    onChange={(e) =>
                                        handleFieldChange(
                                            'infiltrationShallowRatio',
                                            e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                    }
                                    onBlur={(e) =>
                                        handleFieldBlur(
                                            'infiltrationShallowRatio',
                                            e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                    }
                                    placeholder="0.70"
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                        formErrors.infiltrationShallowRatio
                                            ? 'border-red-300 focus:border-red-400 bg-red-50/50'
                                            : 'border-slate-200 focus:border-teal-400'
                                    }`}
                                />
                                {formErrors.infiltrationShallowRatio && (
                                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                        <span className="text-red-500">•</span>
                                        {formErrors.infiltrationShallowRatio}
                                    </p>
                                )}
                                <p className="mt-1 text-xs text-slate-500">
                                    Để trống = dùng mặc định 0.70. Cát ≈ 0.55, sét ≈ 0.80.
                                </p>
                            </div>
                        </div>
                        {(createMutation.isPending || updateMutation.isPending) && (
                            <div className="mt-4">
                                <ProgressIllusion
                                    duration={2000}
                                    label={showCreateModal ? 'Đang tạo loại đất...' : 'Đang cập nhật loại đất...'}
                                />
                            </div>
                        )}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={closeModal}
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={showCreateModal ? handleCreate : handleUpdate}
                                disabled={
                                    createMutation.isPending ||
                                    updateMutation.isPending ||
                                    Object.keys(formErrors).length > 0 ||
                                    !formData.name?.trim() ||
                                    formData.fieldCapacity === undefined ||
                                    formData.fieldCapacity === null ||
                                    formData.fieldCapacity === '' ||
                                    formData.wiltingPoint === undefined ||
                                    formData.wiltingPoint === null ||
                                    formData.wiltingPoint === ''
                                }
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                            >
                                {(createMutation.isPending || updateMutation.isPending) && (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                {showCreateModal ? 'Tạo loại đất' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
