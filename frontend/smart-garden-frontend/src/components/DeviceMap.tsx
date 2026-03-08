import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Wifi, WifiOff, AlertCircle, LocateFixed, Loader2 } from 'lucide-react';
import type { UserDeviceListItem } from '../api/device';

// Fix for default marker icons in Leaflet with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconRetinaUrl: iconRetina,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker icons based on device status
const createStatusIcon = (status: 'ONLINE' | 'OFFLINE' | 'ERROR') => {
    const colors = {
        ONLINE: '#10b981', // green
        OFFLINE: '#6b7280', // gray
        ERROR: '#ef4444', // red
    };

    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                background-color: ${colors[status]};
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    transform: rotate(45deg);
                    color: white;
                    font-size: 16px;
                    font-weight: bold;
                ">📍</div>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });
};

// Custom marker icon for "Vị trí của bạn"
const myLocationIcon = L.divIcon({
    className: 'custom-marker my-location-marker',
    html: `
        <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
        ">
            <div style="
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                width: 36px;
                height: 36px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(59, 130, 246, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="transform: rotate(45deg); color: white; font-size: 18px;">📍</div>
            </div>
            <span style="
                margin-top: 2px;
                background: #1e40af;
                color: white;
                font-size: 10px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 4px;
                white-space: nowrap;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            ">Vị trí của bạn</span>
        </div>
    `,
    iconSize: [120, 50],
    iconAnchor: [18, 50],
    popupAnchor: [0, -50],
});

// Component to fit map bounds to show all markers (only on initial load)
const MapBoundsFitter: React.FC<{
    devices: UserDeviceListItem[];
    skipIfSelected?: boolean;
}> = ({ devices, skipIfSelected = false }) => {
    const map = useMap();
    const [hasInitialized, setHasInitialized] = useState(false);

    useEffect(() => {
        // Skip if a device is selected (let GardenAreaZoomer handle it)
        if (skipIfSelected || hasInitialized) {
            return;
        }

        const devicesWithCoords = devices.filter(
            (d) => d.latitude != null && d.longitude != null
        );

        if (devicesWithCoords.length === 0) {
            // Default to Vietnam center if no devices
            map.setView([16.0544, 108.2022], 6);
            setHasInitialized(true);
            return;
        }

        if (devicesWithCoords.length === 1) {
            // Single device: center on it with zoom level 13
            const device = devicesWithCoords[0];
            map.setView([device.latitude!, device.longitude!], 13);
            setHasInitialized(true);
            return;
        }

        // Multiple devices: fit bounds
        const bounds = L.latLngBounds(
            devicesWithCoords.map((d) => [d.latitude!, d.longitude!])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
        setHasInitialized(true);
    }, [devices, map, skipIfSelected, hasInitialized]);

    return null;
};

// Component to fly map to user's location when "Vị trí của bạn" is enabled
const FlyToMyLocation: React.FC<{ myLocation: { lat: number; lng: number } | null; active: boolean }> = ({ myLocation, active }) => {
    const map = useMap();

    useEffect(() => {
        if (!active || !myLocation) return;
        map.flyTo([myLocation.lat, myLocation.lng], 16, { duration: 0.8 });
    }, [active, myLocation, map]);

    return null;
};

// Component to zoom to selected garden area
const GardenAreaZoomer: React.FC<{
    deviceId: number | null;
    devices: UserDeviceListItem[];
}> = ({ deviceId, devices }) => {
    const map = useMap();

    useEffect(() => {
        if (!deviceId) {
            return;
        }

        const device = devices.find(d => d.id === deviceId);
        if (!device || device.latitude == null || device.longitude == null) {
            return;
        }

        const bounds = device.gardenBounds ||
            calculateGardenBounds(device.latitude, device.longitude);

        const rectangleBounds = L.latLngBounds(
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
        );

        // Zoom to fit the garden area with padding
        map.fitBounds(rectangleBounds, { padding: [100, 100] });
    }, [deviceId, devices, map]);

    return null;
};

export interface DeviceMapProps {
    devices: UserDeviceListItem[];
    /** Khi truyền từ parent (vd. trang Giám sát), bản đồ sẽ zoom/highlight thiết bị này và click marker cập nhật lại parent */
    selectedDeviceId?: number | null;
    onDeviceClick?: (device: UserDeviceListItem) => void;
    className?: string;
    height?: string;
}

// Helper function to calculate garden bounds from device location
// Creates a rectangular area around the device (default: 100m x 100m)
const calculateGardenBounds = (
    lat: number,
    lon: number,
    sizeMeters: number = 100
): { north: number; south: number; east: number; west: number } => {
    // Approximate: 1 degree latitude ≈ 111,000 meters
    // Longitude varies by latitude: 1 degree ≈ 111,000 * cos(latitude) meters
    const latOffset = sizeMeters / 111000;
    const lonOffset = sizeMeters / (111000 * Math.cos((lat * Math.PI) / 180));

    return {
        north: lat + latOffset / 2,
        south: lat - latOffset / 2,
        east: lon + lonOffset / 2,
        west: lon - lonOffset / 2,
    };
};

export const DeviceMap: React.FC<DeviceMapProps> = ({
    devices,
    selectedDeviceId: selectedDeviceIdProp,
    onDeviceClick,
    className = '',
    height = '500px',
}) => {
    const [internalSelectedId, setInternalSelectedId] = useState<number | null>(null);
    const isControlled = selectedDeviceIdProp !== undefined;
    const selectedDeviceId = isControlled ? (selectedDeviceIdProp ?? null) : internalSelectedId;
    const [showMyLocationPin, setShowMyLocationPin] = useState(false);
    const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const devicesWithCoords = devices.filter(
        (d) => d.latitude != null && d.longitude != null
    );

    const handleToggleMyLocation = () => {
        if (showMyLocationPin) {
            setShowMyLocationPin(false);
            setMyLocation(null);
            setLocationError(null);
            return;
        }
        setLocationError(null);
        setLocationLoading(true);
        if (!navigator.geolocation) {
            setLocationError('Trình duyệt không hỗ trợ định vị');
            setLocationLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setShowMyLocationPin(true);
                setLocationLoading(false);
                setLocationError(null);
            },
            () => {
                setLocationError('Không lấy được vị trí. Kiểm tra quyền truy cập vị trí.');
                setLocationLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    // Default center: Vietnam
    const defaultCenter: [number, number] = [16.0544, 108.2022];
    const defaultZoom = 6;

    if (devicesWithCoords.length === 0) {
        return (
            <div
                className={`bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center ${className}`}
                style={{ height }}
            >
                <div className="text-center p-8">
                    <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Chưa có thiết bị nào có tọa độ</p>
                    <p className="text-sm text-slate-400 mt-1">
                        Vui lòng thêm latitude và longitude cho thiết bị để hiển thị trên bản đồ
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative ${className}`}>
            {/* Toggle button: Vị trí của bạn */}
            <button
                type="button"
                onClick={handleToggleMyLocation}
                disabled={locationLoading}
                className={`absolute top-3 right-3 z-[1000] flex items-center gap-2 px-3 py-2 rounded-xl border shadow-md text-sm font-medium transition-all ${showMyLocationPin
                        ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                title={showMyLocationPin ? 'Ẩn vị trí của bạn' : 'Hiện vị trí của bạn'}
            >
                {locationLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <LocateFixed className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Vị trí của bạn</span>
            </button>
            {locationError && (
                <div className="absolute top-14 right-3 z-[1000] px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs max-w-[200px] shadow">
                    {locationError}
                </div>
            )}
            <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                style={{ height, width: '100%' }}
                scrollWheelZoom={true}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBoundsFitter devices={devices} skipIfSelected={selectedDeviceId !== null} />
                <FlyToMyLocation myLocation={myLocation} active={showMyLocationPin} />
                <GardenAreaZoomer
                    deviceId={selectedDeviceId}
                    devices={devicesWithCoords}
                />

                {/* Render garden area polygons for selected device */}
                {devicesWithCoords.map((device) => {
                    if (selectedDeviceId !== device.id) return null;

                    const bounds = device.gardenBounds ||
                        calculateGardenBounds(device.latitude!, device.longitude!);

                    const rectangleBounds: [[number, number], [number, number]] = [
                        [bounds.south, bounds.west],
                        [bounds.north, bounds.east],
                    ];

                    return (
                        <Rectangle
                            key={`garden-${device.id}`}
                            bounds={rectangleBounds}
                            pathOptions={{
                                color: device.status === 'ONLINE' ? '#10b981' : device.status === 'OFFLINE' ? '#6b7280' : '#ef4444',
                                fillColor: device.status === 'ONLINE' ? '#10b981' : device.status === 'OFFLINE' ? '#6b7280' : '#ef4444',
                                fillOpacity: 0.2,
                                weight: 3,
                                dashArray: '5, 5',
                            }}
                        />
                    );
                })}

                {/* Pin "Vị trí của bạn" */}
                {showMyLocationPin && myLocation && (
                    <Marker
                        position={[myLocation.lat, myLocation.lng]}
                        icon={myLocationIcon}
                        zIndexOffset={1000}
                    >
                        <Popup>
                            <div className="p-2 min-w-[180px]">
                                <p className="font-semibold text-blue-700 text-sm">Vị trí của bạn</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {myLocation.lat.toFixed(6)}, {myLocation.lng.toFixed(6)}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {devicesWithCoords.map((device) => (
                    <Marker
                        key={device.id}
                        position={[device.latitude!, device.longitude!]}
                        icon={createStatusIcon(device.status)}
                        eventHandlers={{
                            click: () => {
                                if (isControlled) {
                                    if (onDeviceClick) onDeviceClick(device);
                                } else {
                                    setInternalSelectedId(selectedDeviceId === device.id ? null : device.id);
                                    if (onDeviceClick) onDeviceClick(device);
                                }
                            },
                        }}
                    >
                        <Popup>
                            <div className="p-2 min-w-[200px]">
                                <div className="flex items-start gap-2 mb-2">
                                    {device.status === 'ONLINE' ? (
                                        <Wifi className="w-4 h-4 text-emerald-600 mt-0.5" />
                                    ) : device.status === 'OFFLINE' ? (
                                        <WifiOff className="w-4 h-4 text-slate-400 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-800 text-sm">
                                            {device.deviceName}
                                        </h3>
                                        <p className="text-xs text-slate-500">{device.deviceCode}</p>
                                    </div>
                                </div>
                                {device.location && (
                                    <div className="mt-2 pt-2 border-t border-slate-200">
                                        <p className="text-xs text-slate-600">
                                            <span className="font-medium">Vị trí:</span> {device.location}
                                        </p>
                                    </div>
                                )}
                                <div className="mt-1">
                                    <p className="text-xs text-slate-500">
                                        <span className="font-medium">Tọa độ:</span>{' '}
                                        {device.latitude?.toFixed(6)}, {device.longitude?.toFixed(6)}
                                    </p>
                                </div>
                                {device.altitude != null && (
                                    <div className="mt-1">
                                        <p className="text-xs text-slate-500">
                                            <span className="font-medium">Độ cao:</span> {device.altitude.toFixed(1)}m
                                        </p>
                                    </div>
                                )}
                                {device.gardenArea != null && (
                                    <div className="mt-1">
                                        <p className="text-xs text-slate-500">
                                            <span className="font-medium">Diện tích:</span> {device.gardenArea.toFixed(0)} m²
                                        </p>
                                    </div>
                                )}
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${device.status === 'ONLINE'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : device.status === 'OFFLINE'
                                                    ? 'bg-slate-100 text-slate-600'
                                                    : 'bg-red-100 text-red-700'
                                            }`}
                                    >
                                        {device.status === 'ONLINE'
                                            ? 'Trực tuyến'
                                            : device.status === 'OFFLINE'
                                                ? 'Ngoại tuyến'
                                                : 'Lỗi'}
                                    </span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                    <p className="text-xs text-slate-500 italic">
                                        💡 Click để highlight diện tích vườn
                                    </p>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};
