package com.example.smart_garden.util;

import java.util.regex.Pattern;

/**
 * Chuẩn hóa địa chỉ MAC để dùng làm device_code (MQTT ClientID, topic).
 * ESP32: WiFi.macAddress() trả về "AA:BB:CC:DD:EE:FF". Chuẩn: 12 ký tự hex viết hoa, không dấu.
 */
public final class MacAddressUtils {

    private static final Pattern HEX_ONLY = Pattern.compile("^[0-9A-Fa-f]{12}$");
    private static final int MAC_HEX_LENGTH = 12;

    private MacAddressUtils() {
    }

    /**
     * Chuẩn hóa MAC thành 12 ký tự hex viết hoa (vd AABBCCDDEEFF).
     * Chấp nhận: "AA:BB:CC:DD:EE:FF", "AA-BB-CC-DD-EE-FF", "AABBCCDDEEFF".
     *
     * @param macAddress chuỗi MAC từ user hoặc ESP32
     * @return 12 ký tự hex viết hoa, hoặc null nếu không hợp lệ
     */
    public static String normalize(String macAddress) {
        if (macAddress == null) return null;
        String hex = macAddress.replaceAll("[^0-9A-Fa-f]", "");
        if (hex.length() != MAC_HEX_LENGTH) return null;
        return hex.toUpperCase();
    }

    /**
     * Kiểm tra chuỗi có phải MAC hợp lệ sau khi chuẩn hóa không.
     */
    public static boolean isValid(String normalizedMac) {
        return normalizedMac != null && HEX_ONLY.matcher(normalizedMac).matches();
    }
}
