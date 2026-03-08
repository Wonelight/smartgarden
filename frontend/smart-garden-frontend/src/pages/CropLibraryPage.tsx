import React, { useState } from 'react';
import {
    Sprout, Search, Plus, Pencil, Trash2, X, Loader2, BookOpen, ExternalLink, Info
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cropApi } from '../api/crop';
import type { CropLibraryListItem, AdminCreateCropLibraryRequest, AdminUpdateCropLibraryRequest } from '../api/crop';
import { useAuth } from '../hooks/useAuth';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';
import { ProgressIllusion } from '../components/ui/ProgressBar';
import { SkeletonTable } from '../components/ui/Skeleton';

// ============================================
// CROP LIBRARY TABLE COMPONENT
// ============================================

const CropLibraryTable: React.FC<{
    crops: CropLibraryListItem[];
    onEdit: (c: CropLibraryListItem) => void;
    onDelete: (id: number) => void;
}> = ({ crops, onEdit, onDelete }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Tên cây trồng</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Kc Initial</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Kc Mid</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Kc End</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Độ sâu rễ (m)</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Tỷ lệ cạn</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {crops.map((crop) => (
                        <tr key={crop.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{crop.name}</td>
                            <td className="px-4 py-3 text-slate-600">{crop.kcIni.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-600">{crop.kcMid.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-600">{crop.kcEnd.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-600">{crop.maxRootDepth.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-600">{crop.depletionFraction.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => onEdit(crop)}
                                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                        title="Chỉnh sửa"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(crop.id)}
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
        {crops.length === 0 && (
            <div className="p-12 text-center">
                <Sprout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Chưa có cây trồng nào</p>
            </div>
        )}
    </div>
);

// ============================================
// CROP DOCUMENTATION COMPONENT
// ============================================

const CropDocumentationPanel: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">Tài liệu về hệ số cây trồng</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    {/* Introduction */}
                    <div>
                        <h4 className="text-base font-semibold text-slate-800 mb-2">Giới thiệu</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Hệ số cây trồng (Crop Coefficient - Kc) là một tham số quan trọng trong tính toán nhu cầu nước tưới cho cây trồng.
                            Các giá trị này được xác định dựa trên nghiên cứu của Tổ chức Nông lương Liên Hợp Quốc (FAO) và các tổ chức nghiên cứu uy tín khác.
                        </p>
                    </div>

                    {/* Kc Coefficients */}
                    <div>
                        <h4 className="text-base font-semibold text-slate-800 mb-3">Hệ số cây trồng (Kc)</h4>
                        <div className="space-y-3">
                            <div className="bg-teal-50/50 border border-teal-100 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 rounded bg-teal-100 text-teal-700 mt-0.5">
                                        <Info className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <h5 className="font-medium text-slate-800 mb-1">Kc Initial (Kc ini)</h5>
                                        <p className="text-sm text-slate-600">
                                            Hệ số cây trồng ở giai đoạn đầu (initial stage) - từ khi gieo trồng đến khi cây trồng phủ khoảng 10% diện tích đất.
                                            Giá trị thường từ 0.3 đến 0.5, phụ thuộc vào độ ẩm đất và tần suất tưới.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 rounded bg-emerald-100 text-emerald-700 mt-0.5">
                                        <Info className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <h5 className="font-medium text-slate-800 mb-1">Kc Mid (Kc mid)</h5>
                                        <p className="text-sm text-slate-600">
                                            Hệ số cây trồng ở giai đoạn giữa (mid-season stage) - khi cây trồng đạt độ che phủ tối đa và phát triển mạnh nhất.
                                            Giá trị thường từ 0.9 đến 1.3, đây là giai đoạn cây trồng cần nước nhiều nhất.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 rounded bg-amber-100 text-amber-700 mt-0.5">
                                        <Info className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <h5 className="font-medium text-slate-800 mb-1">Kc End (Kc end)</h5>
                                        <p className="text-sm text-slate-600">
                                            Hệ số cây trồng ở giai đoạn cuối (late season stage) - từ khi cây trồng bắt đầu chín đến thu hoạch.
                                            Giá trị thường từ 0.5 đến 0.9, giảm dần khi cây trồng già và chuẩn bị thu hoạch.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Growth Stages */}
                    <div>
                        <h4 className="text-base font-semibold text-slate-800 mb-3">Các giai đoạn phát triển</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="border border-slate-200 rounded-lg p-4">
                                <h5 className="font-medium text-slate-800 mb-2">Initial Stage</h5>
                                <p className="text-sm text-slate-600">
                                    Giai đoạn đầu: Từ khi gieo trồng đến khi cây trồng phủ khoảng 10% diện tích đất.
                                    Thời gian thường từ 10-30 ngày tùy loại cây trồng.
                                </p>
                            </div>
                            <div className="border border-slate-200 rounded-lg p-4">
                                <h5 className="font-medium text-slate-800 mb-2">Development Stage</h5>
                                <p className="text-sm text-slate-600">
                                    Giai đoạn phát triển: Cây trồng phát triển nhanh, độ che phủ tăng từ 10% đến gần 100%.
                                    Thời gian thường từ 20-40 ngày.
                                </p>
                            </div>
                            <div className="border border-slate-200 rounded-lg p-4">
                                <h5 className="font-medium text-slate-800 mb-2">Mid-Season Stage</h5>
                                <p className="text-sm text-slate-600">
                                    Giai đoạn giữa: Cây trồng đạt độ che phủ tối đa và phát triển mạnh nhất.
                                    Đây là giai đoạn cần nước nhiều nhất. Thời gian thường từ 30-60 ngày.
                                </p>
                            </div>
                            <div className="border border-slate-200 rounded-lg p-4">
                                <h5 className="font-medium text-slate-800 mb-2">Late Season Stage</h5>
                                <p className="text-sm text-slate-600">
                                    Giai đoạn cuối: Cây trồng bắt đầu chín và chuẩn bị thu hoạch.
                                    Nhu cầu nước giảm dần. Thời gian thường từ 10-30 ngày.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Root Depth */}
                    <div>
                        <h4 className="text-base font-semibold text-slate-800 mb-3">Độ sâu rễ tối đa (Maximum Root Depth)</h4>
                        <p className="text-sm text-slate-600 mb-3">
                            Độ sâu rễ tối đa là độ sâu mà hệ thống rễ của cây trồng có thể phát triển đến.
                            Giá trị này quan trọng trong việc tính toán lượng nước có sẵn trong đất và nhu cầu tưới.
                        </p>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <ul className="text-sm text-slate-600 space-y-2">
                                <li>• <strong>Cây ngắn ngày:</strong> 0.3 - 0.6 m (rau, đậu)</li>
                                <li>• <strong>Cây trung bình:</strong> 0.6 - 1.2 m (lúa, ngô)</li>
                                <li>• <strong>Cây dài ngày:</strong> 1.2 - 2.0 m (cây ăn quả, cây công nghiệp)</li>
                            </ul>
                        </div>
                    </div>

                    {/* Depletion Fraction */}
                    <div>
                        <h4 className="text-base font-semibold text-slate-800 mb-3">Tỷ lệ cạn kiệt (Depletion Fraction - p)</h4>
                        <p className="text-sm text-slate-600 mb-3">
                            Tỷ lệ cạn kiệt là phần trăm độ ẩm đất có thể sử dụng được mà cây trồng có thể sử dụng trước khi bắt đầu bị stress do thiếu nước.
                            Giá trị này phụ thuộc vào loại cây trồng và điều kiện môi trường.
                        </p>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <ul className="text-sm text-slate-600 space-y-2">
                                <li>• <strong>Cây nhạy cảm với nước:</strong> 0.3 - 0.4 (rau xanh, cây trồng trong nhà kính)</li>
                                <li>• <strong>Cây trung bình:</strong> 0.4 - 0.5 (lúa, ngô, đậu)</li>
                                <li>• <strong>Cây chịu hạn:</strong> 0.5 - 0.7 (cây ăn quả, cây công nghiệp)</li>
                            </ul>
                        </div>
                    </div>

                    {/* Example Values */}
                    <div>
                        <h4 className="text-base font-semibold text-slate-800 mb-3">Ví dụ giá trị Kc cho một số cây trồng phổ biến</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Cây trồng</th>
                                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">Kc ini</th>
                                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">Kc mid</th>
                                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">Kc end</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-slate-200 px-3 py-2 text-slate-700">Lúa nước</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">1.05</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">1.20</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.90</td>
                                    </tr>
                                    <tr className="bg-slate-50/50">
                                        <td className="border border-slate-200 px-3 py-2 text-slate-700">Ngô</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.30</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">1.20</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.60</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-200 px-3 py-2 text-slate-700">Lúa mì</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.70</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">1.15</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.40</td>
                                    </tr>
                                    <tr className="bg-slate-50/50">
                                        <td className="border border-slate-200 px-3 py-2 text-slate-700">Đậu tương</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.40</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">1.15</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.50</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-200 px-3 py-2 text-slate-700">Cà chua</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.60</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">1.15</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.80</td>
                                    </tr>
                                    <tr className="bg-slate-50/50">
                                        <td className="border border-slate-200 px-3 py-2 text-slate-700">Khoai tây</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.50</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">1.15</td>
                                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">0.75</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 italic">
                            * Giá trị có thể thay đổi tùy theo điều kiện khí hậu, loại đất và phương pháp canh tác
                        </p>
                    </div>

                    {/* References */}
                    <div>
                        <h4 className="text-base font-semibold text-slate-800 mb-3">Tài liệu tham khảo</h4>
                        <div className="space-y-2">
                            <a
                                href="https://www.fao.org/3/X0490E/x0490e00.htm"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>FAO Irrigation and Drainage Paper 56 - Crop Evapotranspiration</span>
                            </a>
                            <a
                                href="https://www.fao.org/land-water/databases-and-software/crop-information/en/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>FAO Crop Information Database</span>
                            </a>
                            <a
                                href="https://www.fao.org/aquastat/en/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>FAO AQUASTAT - Global Water Information System</span>
                            </a>
                            <a
                                href="https://www.icid.org/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>International Commission on Irrigation and Drainage (ICID)</span>
                            </a>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <h5 className="font-medium text-amber-800 mb-1">Lưu ý quan trọng</h5>
                                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                                    <li>Các giá trị Kc được cung cấp là giá trị tham khảo và có thể cần điều chỉnh dựa trên điều kiện địa phương</li>
                                    <li>Điều kiện khí hậu, loại đất, và phương pháp canh tác ảnh hưởng đáng kể đến nhu cầu nước của cây trồng</li>
                                    <li>Nên theo dõi và điều chỉnh các giá trị dựa trên quan sát thực tế và dữ liệu cảm biến</li>
                                    <li>Tham khảo các chuyên gia nông nghiệp địa phương để có giá trị chính xác nhất</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CROP LIBRARY PAGE
// ============================================

export const CropLibraryPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = checkIsAdmin(user);
    const queryClient = useQueryClient();

    // UI State
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<AdminCreateCropLibraryRequest & AdminUpdateCropLibraryRequest & { id?: number }>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Queries
    const { data: crops = [], isLoading: loadingCrops } = useQuery({
        queryKey: ['cropLibraries'],
        queryFn: cropApi.adminGetAllCropLibraries,
        enabled: isAdmin,
        staleTime: 30000
    });

    // Optimistic Mutations
    const createCropMutation = useOptimisticMutation({
        mutationFn: cropApi.adminCreateCropLibrary,
        queryKey: ['cropLibraries'],
        optimisticUpdate: (variables) => {
            const now = new Date().toISOString();
            const newCrop: CropLibraryListItem = {
                id: Date.now(),
                name: variables.name,
                kcIni: variables.kcIni,
                kcMid: variables.kcMid,
                kcEnd: variables.kcEnd,
                stageIniDays: variables.stageIniDays,
                stageDevDays: variables.stageDevDays,
                stageMidDays: variables.stageMidDays,
                stageEndDays: variables.stageEndDays,
                maxRootDepth: variables.maxRootDepth,
                depletionFraction: variables.depletionFraction,
                createdAt: now,
                updatedAt: now,
            };
            return [...crops, newCrop];
        },
        successMessage: 'Tạo cây trồng thành công',
        errorMessage: 'Lỗi khi tạo cây trồng',
        onSuccess: () => {
            setShowCreateModal(false);
            setFormData({});
        },
    });

    const updateCropMutation = useOptimisticMutation({
        mutationFn: ({ id, data }: { id: number; data: AdminUpdateCropLibraryRequest }) =>
            cropApi.adminUpdateCropLibrary(id, data),
        queryKey: ['cropLibraries'],
        optimisticUpdate: ({ id, data }) => {
            return crops.map((c) =>
                c.id === id ? { ...c, ...data } : c
            );
        },
        successMessage: 'Cập nhật cây trồng thành công',
        errorMessage: 'Lỗi khi cập nhật cây trồng',
        onSuccess: () => {
            setShowEditModal(false);
            setFormData({});
        },
    });

    const deleteCropMutation = useOptimisticMutation({
        mutationFn: cropApi.adminDeleteCropLibrary,
        queryKey: ['cropLibraries'],
        optimisticUpdate: (cropId) => {
            return crops.filter((c) => c.id !== cropId);
        },
        successMessage: 'Xóa cây trồng thành công',
        errorMessage: 'Lỗi khi xóa cây trồng',
    });

    // Filtering
    const filteredCrops = crops.filter((c) => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    // Validation
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        // Validate name
        if (!formData.name || formData.name.trim() === '') {
            errors.name = 'Tên cây trồng là bắt buộc';
        } else if (formData.name.length > 100) {
            errors.name = 'Tên cây trồng không được vượt quá 100 ký tự';
        }

        // Validate Kc values
        if (formData.kcIni === undefined || formData.kcIni === null) {
            errors.kcIni = 'Kc Initial là bắt buộc';
        } else if (formData.kcIni <= 0) {
            errors.kcIni = 'Kc Initial phải lớn hơn 0';
        }

        if (formData.kcMid === undefined || formData.kcMid === null) {
            errors.kcMid = 'Kc Mid là bắt buộc';
        } else if (formData.kcMid <= 0) {
            errors.kcMid = 'Kc Mid phải lớn hơn 0';
        }

        if (formData.kcEnd === undefined || formData.kcEnd === null) {
            errors.kcEnd = 'Kc End là bắt buộc';
        } else if (formData.kcEnd <= 0) {
            errors.kcEnd = 'Kc End phải lớn hơn 0';
        }

        // Validate stage days
        if (formData.stageIniDays === undefined || formData.stageIniDays === null) {
            errors.stageIniDays = 'Giai đoạn Initial là bắt buộc';
        } else if (formData.stageIniDays <= 0 || !Number.isInteger(formData.stageIniDays)) {
            errors.stageIniDays = 'Giai đoạn Initial phải là số nguyên dương';
        }

        if (formData.stageDevDays === undefined || formData.stageDevDays === null) {
            errors.stageDevDays = 'Giai đoạn Dev là bắt buộc';
        } else if (formData.stageDevDays <= 0 || !Number.isInteger(formData.stageDevDays)) {
            errors.stageDevDays = 'Giai đoạn Dev phải là số nguyên dương';
        }

        if (formData.stageMidDays === undefined || formData.stageMidDays === null) {
            errors.stageMidDays = 'Giai đoạn Mid là bắt buộc';
        } else if (formData.stageMidDays <= 0 || !Number.isInteger(formData.stageMidDays)) {
            errors.stageMidDays = 'Giai đoạn Mid phải là số nguyên dương';
        }

        if (formData.stageEndDays === undefined || formData.stageEndDays === null) {
            errors.stageEndDays = 'Giai đoạn End là bắt buộc';
        } else if (formData.stageEndDays <= 0 || !Number.isInteger(formData.stageEndDays)) {
            errors.stageEndDays = 'Giai đoạn End phải là số nguyên dương';
        }

        // Validate max root depth
        if (formData.maxRootDepth === undefined || formData.maxRootDepth === null) {
            errors.maxRootDepth = 'Độ sâu rễ tối đa là bắt buộc';
        } else if (formData.maxRootDepth <= 0) {
            errors.maxRootDepth = 'Độ sâu rễ tối đa phải lớn hơn 0';
        }

        // Validate depletion fraction
        if (formData.depletionFraction === undefined || formData.depletionFraction === null) {
            errors.depletionFraction = 'Tỷ lệ cạn kiệt là bắt buộc';
        } else if (formData.depletionFraction <= 0 || formData.depletionFraction > 1) {
            errors.depletionFraction = 'Tỷ lệ cạn kiệt phải trong khoảng 0 đến 1';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateField = (field: string, value: any): string => {
        switch (field) {
            case 'name':
                if (!value || value.trim() === '') return 'Tên cây trồng là bắt buộc';
                if (value.length > 100) return 'Tên cây trồng không được vượt quá 100 ký tự';
                return '';
            case 'kcIni':
            case 'kcMid':
            case 'kcEnd':
                if (value === undefined || value === null || value === '') return `${field === 'kcIni' ? 'Kc Initial' : field === 'kcMid' ? 'Kc Mid' : 'Kc End'} là bắt buộc`;
                if (value <= 0) return `${field === 'kcIni' ? 'Kc Initial' : field === 'kcMid' ? 'Kc Mid' : 'Kc End'} phải lớn hơn 0`;
                return '';
            case 'stageIniDays':
            case 'stageDevDays':
            case 'stageMidDays':
            case 'stageEndDays':
                if (value === undefined || value === null || value === '') return 'Giai đoạn là bắt buộc';
                if (value <= 0 || !Number.isInteger(value)) return 'Giai đoạn phải là số nguyên dương';
                return '';
            case 'maxRootDepth':
                if (value === undefined || value === null || value === '') return 'Độ sâu rễ tối đa là bắt buộc';
                if (value <= 0) return 'Độ sâu rễ tối đa phải lớn hơn 0';
                return '';
            case 'depletionFraction':
                if (value === undefined || value === null || value === '') return 'Tỷ lệ cạn kiệt là bắt buộc';
                if (value <= 0 || value > 1) return 'Tỷ lệ cạn kiệt phải trong khoảng 0 đến 1';
                return '';
            default:
                return '';
        }
    };

    // Handlers
    const handleCreate = () => {
        if (!validateForm()) {
            toast.error('Vui lòng kiểm tra lại thông tin đã nhập');
            return;
        }
        createCropMutation.mutate(formData as AdminCreateCropLibraryRequest);
    };

    const handleUpdate = () => {
        if (!formData.id) return;
        if (!validateForm()) {
            toast.error('Vui lòng kiểm tra lại thông tin đã nhập');
            return;
        }
        const { id, ...payload } = formData;
        updateCropMutation.mutate({ id, data: payload as AdminUpdateCropLibraryRequest });
    };

    const handleFieldChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
        // Clear error when user starts typing
        if (formErrors[field]) {
            const error = validateField(field, value);
            if (error) {
                setFormErrors({ ...formErrors, [field]: error });
            } else {
                const newErrors = { ...formErrors };
                delete newErrors[field];
                setFormErrors(newErrors);
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
    };

    const openCreateModal = () => {
        setFormData({});
        setShowCreateModal(true);
    };

    const openEditModal = (crop: CropLibraryListItem) => {
        setFormData({
            id: crop.id,
            name: crop.name,
            kcIni: crop.kcIni,
            kcMid: crop.kcMid,
            kcEnd: crop.kcEnd,
            stageIniDays: crop.stageIniDays,
            stageDevDays: crop.stageDevDays,
            stageMidDays: crop.stageMidDays,
            stageEndDays: crop.stageEndDays,
            maxRootDepth: crop.maxRootDepth,
            depletionFraction: crop.depletionFraction
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Quản lý cây trồng</h1>
                    <p className="text-slate-500 mt-1">Nhập thông tin các loại cây trồng và các hệ số tương ứng</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowDocModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <BookOpen className="w-4 h-4" />
                        Tài liệu
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm cây trồng
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm cây trồng..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 transition-colors"
                    />
                </div>
                <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['cropLibraries'] })}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    title="Làm mới"
                >
                    <Loader2 className={`w-4 h-4 ${loadingCrops ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Sprout className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Tổng số cây trồng</p>
                            <p className="text-xl font-bold text-slate-800">{crops.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Crop Libraries Table */}
            <div>
                {loadingCrops ? (
                    <SkeletonTable rows={5} cols={7} />
                ) : (
                    <>
                        {(createCropMutation.isPending || updateCropMutation.isPending || deleteCropMutation.isPending) && (
                            <div className="mb-4">
                                <ProgressIllusion
                                    duration={1500}
                                    label={
                                        createCropMutation.isPending ? 'Đang tạo cây trồng...' :
                                            updateCropMutation.isPending ? 'Đang cập nhật cây trồng...' :
                                                'Đang xóa cây trồng...'
                                    }
                                />
                            </div>
                        )}
                        <CropLibraryTable
                            crops={filteredCrops}
                            onEdit={openEditModal}
                            onDelete={(id) => {
                                if (window.confirm('Bạn có chắc muốn xóa cây trồng này?')) {
                                    deleteCropMutation.mutate(id);
                                }
                            }}
                        />
                    </>
                )}
            </div>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="relative mb-6 pb-4 border-b border-slate-200">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setShowEditModal(false);
                                    setFormData({});
                                    setFormErrors({});
                                }}
                                className="absolute right-0 top-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="text-2xl font-bold text-center text-slate-800">
                                {showCreateModal ? 'Thêm cây trồng mới' : 'Cập nhật cây trồng'}
                            </h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên cây trồng *</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={e => handleFieldChange('name', e.target.value)}
                                    onBlur={e => handleFieldBlur('name', e.target.value)}
                                    placeholder="VD: Lúa nước"
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${formErrors.name
                                            ? 'border-red-300 focus:border-red-400'
                                            : 'border-slate-200 focus:border-teal-400'
                                        }`}
                                />
                                {formErrors.name && (
                                    <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                                )}
                            </div>

                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                <label className="block text-sm font-medium text-slate-700 mb-3">Kc *</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Initial *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.kcIni || ''}
                                            onChange={e => handleFieldChange('kcIni', e.target.value ? parseFloat(e.target.value) : '')}
                                            onBlur={e => handleFieldBlur('kcIni', e.target.value ? parseFloat(e.target.value) : '')}
                                            placeholder="0.4"
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none transition-colors ${formErrors.kcIni
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-slate-200 focus:border-teal-400'
                                                }`}
                                        />
                                        {formErrors.kcIni && (
                                            <p className="mt-1 text-xs text-red-600">{formErrors.kcIni}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Mid *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.kcMid || ''}
                                            onChange={e => handleFieldChange('kcMid', e.target.value ? parseFloat(e.target.value) : '')}
                                            onBlur={e => handleFieldBlur('kcMid', e.target.value ? parseFloat(e.target.value) : '')}
                                            placeholder="1.2"
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none transition-colors ${formErrors.kcMid
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-slate-200 focus:border-teal-400'
                                                }`}
                                        />
                                        {formErrors.kcMid && (
                                            <p className="mt-1 text-xs text-red-600">{formErrors.kcMid}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">End *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.kcEnd || ''}
                                            onChange={e => handleFieldChange('kcEnd', e.target.value ? parseFloat(e.target.value) : '')}
                                            onBlur={e => handleFieldBlur('kcEnd', e.target.value ? parseFloat(e.target.value) : '')}
                                            placeholder="0.6"
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none transition-colors ${formErrors.kcEnd
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-slate-200 focus:border-teal-400'
                                                }`}
                                        />
                                        {formErrors.kcEnd && (
                                            <p className="mt-1 text-xs text-red-600">{formErrors.kcEnd}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                <label className="block text-sm font-medium text-slate-700 mb-3">Giai đoạn *</label>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Initial (ngày) *</label>
                                        <input
                                            type="number"
                                            value={formData.stageIniDays || ''}
                                            onChange={e => handleFieldChange('stageIniDays', e.target.value ? parseInt(e.target.value) : '')}
                                            onBlur={e => handleFieldBlur('stageIniDays', e.target.value ? parseInt(e.target.value) : '')}
                                            placeholder="20"
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none transition-colors ${formErrors.stageIniDays
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-slate-200 focus:border-teal-400'
                                                }`}
                                        />
                                        {formErrors.stageIniDays && (
                                            <p className="mt-1 text-xs text-red-600">{formErrors.stageIniDays}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Dev (ngày) *</label>
                                        <input
                                            type="number"
                                            value={formData.stageDevDays || ''}
                                            onChange={e => handleFieldChange('stageDevDays', e.target.value ? parseInt(e.target.value) : '')}
                                            onBlur={e => handleFieldBlur('stageDevDays', e.target.value ? parseInt(e.target.value) : '')}
                                            placeholder="30"
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none transition-colors ${formErrors.stageDevDays
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-slate-200 focus:border-teal-400'
                                                }`}
                                        />
                                        {formErrors.stageDevDays && (
                                            <p className="mt-1 text-xs text-red-600">{formErrors.stageDevDays}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Mid (ngày) *</label>
                                        <input
                                            type="number"
                                            value={formData.stageMidDays || ''}
                                            onChange={e => handleFieldChange('stageMidDays', e.target.value ? parseInt(e.target.value) : '')}
                                            onBlur={e => handleFieldBlur('stageMidDays', e.target.value ? parseInt(e.target.value) : '')}
                                            placeholder="40"
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none transition-colors ${formErrors.stageMidDays
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-slate-200 focus:border-teal-400'
                                                }`}
                                        />
                                        {formErrors.stageMidDays && (
                                            <p className="mt-1 text-xs text-red-600">{formErrors.stageMidDays}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">End (ngày) *</label>
                                        <input
                                            type="number"
                                            value={formData.stageEndDays || ''}
                                            onChange={e => handleFieldChange('stageEndDays', e.target.value ? parseInt(e.target.value) : '')}
                                            onBlur={e => handleFieldBlur('stageEndDays', e.target.value ? parseInt(e.target.value) : '')}
                                            placeholder="20"
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none transition-colors ${formErrors.stageEndDays
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-slate-200 focus:border-teal-400'
                                                }`}
                                        />
                                        {formErrors.stageEndDays && (
                                            <p className="mt-1 text-xs text-red-600">{formErrors.stageEndDays}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Độ sâu rễ tối đa (m) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.maxRootDepth || ''}
                                        onChange={e => handleFieldChange('maxRootDepth', e.target.value ? parseFloat(e.target.value) : '')}
                                        onBlur={e => handleFieldBlur('maxRootDepth', e.target.value ? parseFloat(e.target.value) : '')}
                                        placeholder="0.5"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${formErrors.maxRootDepth
                                                ? 'border-red-300 focus:border-red-400'
                                                : 'border-slate-200 focus:border-teal-400'
                                            }`}
                                    />
                                    {formErrors.maxRootDepth && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.maxRootDepth}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Tỷ lệ cạn kiệt *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.depletionFraction || ''}
                                        onChange={e => handleFieldChange('depletionFraction', e.target.value ? parseFloat(e.target.value) : '')}
                                        onBlur={e => handleFieldBlur('depletionFraction', e.target.value ? parseFloat(e.target.value) : '')}
                                        placeholder="0.5"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${formErrors.depletionFraction
                                                ? 'border-red-300 focus:border-red-400'
                                                : 'border-slate-200 focus:border-teal-400'
                                            }`}
                                    />
                                    {formErrors.depletionFraction && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.depletionFraction}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        {(createCropMutation.isPending || updateCropMutation.isPending) && (
                            <div className="mt-4">
                                <ProgressIllusion
                                    duration={2000}
                                    label={showCreateModal ? 'Đang tạo cây trồng...' : 'Đang cập nhật cây trồng...'}
                                />
                            </div>
                        )}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                                disabled={createCropMutation.isPending || updateCropMutation.isPending}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={showCreateModal ? handleCreate : handleUpdate}
                                disabled={createCropMutation.isPending || updateCropMutation.isPending || Object.keys(formErrors).length > 0}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {(createCropMutation.isPending || updateCropMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                                {showCreateModal ? 'Tạo cây trồng' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Documentation Modal */}
            <CropDocumentationPanel
                isOpen={showDocModal}
                onClose={() => setShowDocModal(false)}
            />
        </div>
    );
};
