package com.example.smart_garden.service.impl;

import com.example.smart_garden.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Implementation gửi email qua SMTP. Chỉ khởi tạo khi mail đã cấu hình.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "spring.mail.host")
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:smartgarden@localhost}")
    private String fromEmail;

    @Value("${app.name:Smart Garden}")
    private String appName;

    @Override
    public void sendPasswordResetCode(String toEmail, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(appName + " - Mã xác nhận đặt lại mật khẩu");

            String htmlBody = buildPasswordResetEmailHtml(code);
            helper.setText(htmlBody, true);

            mailSender.send(message);
            log.info("Password reset code email sent to {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send password reset email to {}", toEmail, e);
            throw new RuntimeException("Gửi email thất bại", e);
        }
    }

    private String buildPasswordResetEmailHtml(String code) {
        return """
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Đặt lại mật khẩu - %s</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <tr>
                        <td>
                            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); overflow: hidden;">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #10b981 0%%, #0d9488 100%%); padding: 32px 40px; text-align: center;">
                                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">%s</h1>
                                        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Mã xác nhận đặt lại mật khẩu</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px;">
                                        <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                                            Xin chào,
                                        </p>
                                        <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                                            Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình. Vui lòng sử dụng mã xác nhận sau trên trang đặt lại mật khẩu:
                                        </p>
                                        <div style="text-align: center; margin: 32px 0;">
                                            <span style="display: inline-block; background: linear-gradient(135deg, #10b981 0%%, #0d9488 100%%); color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px;">%s</span>
                                        </div>
                                        <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 14px;">
                                            Mã có hiệu lực trong <strong>1 giờ</strong>.
                                        </p>
                                        <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                                            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                                        <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                                            Email này được gửi tự động từ %s. Vui lòng không trả lời.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """.formatted(appName, appName, code, appName);
    }
}
