import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { isAdmin } from '../utils/roleUtils';
import { apiClient } from '../api/client';

export const DebugPage: React.FC = () => {
    const { user, token } = useAuth();
    const [backendAuthInfo, setBackendAuthInfo] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);

    // Decode JWT if available
    let jwtPayload: any = null;
    if (token) {
        try {
            const parts = token.split('.');
            jwtPayload = JSON.parse(atob(parts[1]));
        } catch (e) {
            console.error('Failed to decode JWT:', e);
        }
    }

    // Fetch backend auth info
    const fetchBackendAuthInfo = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/debug/auth');
            setBackendAuthInfo(response.data.data);
        } catch (error) {
            console.error('Failed to fetch backend auth info:', error);
            setBackendAuthInfo({ error: 'Failed to fetch' });
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (token) {
            fetchBackendAuthInfo();
        }
    }, [token]);

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-8">Debug Information</h1>

            <div className="space-y-6">
                {/* Backend Auth Info */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Backend Authentication</h2>
                        <button
                            onClick={fetchBackendAuthInfo}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                    <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-sm">
                        {backendAuthInfo ? JSON.stringify(backendAuthInfo, null, 2) : 'Loading...'}
                    </pre>
                    {backendAuthInfo?.authorities && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium text-blue-900">
                                Has ROLE_ADMIN: <span className="font-bold">
                                    {backendAuthInfo.authorities.includes('ROLE_ADMIN') ? 'YES ✓' : 'NO ✗'}
                                </span>
                            </p>
                        </div>
                    )}
                </div>

                {/* User State */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">User State (from Zustand)</h2>
                    <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-sm">
                        {JSON.stringify(user, null, 2)}
                    </pre>
                    <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
                        <p className="text-sm font-medium text-emerald-900">
                            Is Admin: <span className="font-bold">{isAdmin(user) ? 'YES ✓' : 'NO ✗'}</span>
                        </p>
                    </div>
                </div>

                {/* JWT Payload */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">JWT Payload</h2>
                    <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-sm">
                        {jwtPayload ? JSON.stringify(jwtPayload, null, 2) : 'No token available'}
                    </pre>
                </div>

                {/* LocalStorage */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">LocalStorage</h2>
                    <div className="space-y-2">
                        <div>
                            <p className="text-sm font-medium text-slate-700">smart_garden_user:</p>
                            <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-sm mt-1">
                                {localStorage.getItem('smart_garden_user') || 'null'}
                            </pre>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-700">smart_garden_token:</p>
                            <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-sm mt-1 break-all">
                                {localStorage.getItem('smart_garden_token')?.substring(0, 100) + '...' || 'null'}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Role Check Details */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Role Check Details</h2>
                    <div className="space-y-2 text-sm">
                        <p><strong>user?.role:</strong> {user?.role || 'undefined'}</p>
                        <p><strong>user?.roles:</strong> {user?.roles ? JSON.stringify(user.roles) : 'undefined'}</p>
                        <p><strong>user?.role?.toUpperCase():</strong> {user?.role?.toUpperCase() || 'undefined'}</p>
                        <p><strong>Includes 'ADMIN':</strong> {user?.role?.toUpperCase().includes('ADMIN') ? 'true' : 'false'}</p>
                        <p><strong>isAdmin() result:</strong> {isAdmin(user) ? 'true' : 'false'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
