const nodemailer = require('nodemailer');

// Email service for sending notifications
class EmailService {
  constructor() {
    // Configure email (using environment variables)
    const emailUser = process.env.EMAIL_USER || '';
    const emailPass = process.env.EMAIL_PASS || '';
    const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const emailPort = process.env.EMAIL_PORT || 587;

    this.enabled = emailUser && emailPass;
    this.emailUser = emailUser;

    if (this.enabled) {
      const portNum = Number(emailPort || 587);
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: portNum,
        secure: portNum === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: { rejectUnauthorized: true },
      });

      // verify transporter early so misconfig is visible at startup
      this.transporter.verify()
        .then(() => console.log('Email transporter verified'))
        .catch(err => console.error('Email transporter verify failed:', err));
    } else {
      console.warn('Email service disabled: EMAIL_USER or EMAIL_PASS not set');
    }
  }

  /**
   * Send alert notification email
   */
  async sendAlertEmail(toEmail, deviceName, alertMessage, alertType) {
    let useDynamic = false;
    let transporter = null;
    let fromEmail = '';

    try {
      const SystemConfig = require('../models/SystemConfig');
      const { decrypt } = require('../utils/crypto');
      const config = await SystemConfig.findOne({ key: 'smtp_settings' });

      if (config && config.value && config.value.enabled) {
        const value = config.value;
        const decryptedPass = decrypt(value.pass);
        if (value.user && decryptedPass) {
          const portNum = Number(value.port || 587);
          transporter = nodemailer.createTransport({
            host: value.host || 'smtp.gmail.com',
            port: portNum,
            secure: portNum === 465,
            auth: {
              user: value.user,
              pass: decryptedPass,
            },
            tls: { rejectUnauthorized: true },
          });
          fromEmail = value.user;
          useDynamic = true;
          console.log('[EmailService] Using dynamic SMTP settings from Database');
        }
      }
    } catch (dbErr) {
      console.error('[EmailService] Failed to load dynamic SMTP config, falling back to env:', dbErr);
    }

    if (!useDynamic) {
      if (!this.enabled) {
        console.warn('[EmailService] Email sending skipped: no dynamic configuration and env SMTP not set');
        return false;
      }
      transporter = this.transporter;
      fromEmail = this.emailUser;
      console.log('[EmailService] Using static SMTP settings from .env');
    }

    try {
      const subject = `[${alertType.toUpperCase()}] Alert: ${deviceName}`;
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: ${alertType === 'error' ? '#e74c3c' : '#f39c12'}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
              .content { background-color: #ecf0f1; padding: 20px; border-radius: 0 0 5px 5px; }
              .timestamp { color: #7f8c8d; font-size: 12px; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>${alertType === 'error' ? '🚨' : '⚠️'} Alert Notification</h2>
              </div>
              <div class="content">
                <p><strong>Device:</strong> ${deviceName}</p>
                <p><strong>Message:</strong> ${alertMessage}</p>
                <p><strong>Type:</strong> ${alertType}</p>
                <p class="timestamp">Sent at: ${new Date().toLocaleString()}</p>
                <p style="color: #7f8c8d; font-size: 12px;">
                  This is an automated message from Smart Farm System.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      await transporter.sendMail({
        from: fromEmail ? `"Smart Farm" <${fromEmail}>` : process.env.EMAIL_USER,
        to: toEmail,
        subject,
        html: htmlContent,
      });

      console.log(`Alert email sent to ${toEmail}`);

      // Log success to Database
      try {
        const EmailLog = require('../models/EmailLog');
        await EmailLog.create({
          to: toEmail,
          subject,
          type: 'alert',
          status: 'success',
        });
      } catch (logErr) {
        console.error('Failed to log alert email success:', logErr);
      }

      return true;
    } catch (err) {
      console.error('Error sending alert email:', err);
      // Log failure to Database
      try {
        const EmailLog = require('../models/EmailLog');
        await EmailLog.create({
          to: toEmail,
          subject: `[${alertType.toUpperCase()}] Alert: ${deviceName}`,
          type: 'alert',
          status: 'failed',
          error: err.message || String(err),
        });
      } catch (logErr) {
        console.error('Failed to log alert email failure:', logErr);
      }
      return false;
    }
  }

  /**
   * Send OTP verification email
   */
  async sendOTPEmail(toEmail, otpCode) {
    let useDynamic = false;
    let transporter = null;
    let fromEmail = '';

    try {
      const SystemConfig = require('../models/SystemConfig');
      const { decrypt } = require('../utils/crypto');
      const config = await SystemConfig.findOne({ key: 'smtp_settings' });

      if (config && config.value && config.value.enabled) {
        const value = config.value;
        const decryptedPass = decrypt(value.pass);
        if (value.user && decryptedPass) {
          const portNum = Number(value.port || 587);
          transporter = nodemailer.createTransport({
            host: value.host || 'smtp.gmail.com',
            port: portNum,
            secure: portNum === 465,
            auth: {
              user: value.user,
              pass: decryptedPass,
            },
            tls: { rejectUnauthorized: true },
          });
          fromEmail = value.user;
          useDynamic = true;
          console.log('[EmailService] Using dynamic SMTP settings from Database for OTP');
        }
      }
    } catch (dbErr) {
      console.error('[EmailService] Failed to load dynamic SMTP config for OTP, falling back to env:', dbErr);
    }

    if (!useDynamic) {
      if (!this.enabled) {
        console.warn('[EmailService] OTP email sending skipped: no dynamic configuration and env SMTP not set. OTP is:', otpCode);
        return false;
      }
      transporter = this.transporter;
      fromEmail = this.emailUser;
      console.log('[EmailService] Using static SMTP settings from .env for OTP');
    }

    try {
      const subject = `[Smart Farm] Mã xác thực OTP đăng ký tài khoản`;
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10b981; color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; border: 1px solid #e5e7eb; }
              .otp-code { display: block; font-size: 32px; font-weight: bold; color: #10b981; text-align: center; letter-spacing: 5px; margin: 20px 0; background: #ecfdf5; padding: 15px; border-radius: 8px; border: 1px dashed #34d399; }
              .timestamp { color: #7f8c8d; font-size: 12px; margin-top: 20px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Xác thực tài khoản Smart Farm</h2>
              </div>
              <div class="content">
                <p>Xin chào,</p>
                <p>Bạn đã yêu cầu đăng ký tài khoản tại <strong>Smart Farm System</strong>. Dưới đây là mã OTP để xác thực email của bạn:</p>
                <span class="otp-code">${otpCode}</span>
                <p>Mã OTP này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
                <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p class="timestamp">Gửi lúc: ${new Date().toLocaleString()}</p>
                <p style="color: #7f8c8d; font-size: 11px; text-align: center;">
                  Đây là email tự động từ Hệ thống Smart Farm.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      await transporter.sendMail({
        from: fromEmail ? `"Smart Farm" <${fromEmail}>` : process.env.EMAIL_USER,
        to: toEmail,
        subject,
        html: htmlContent,
      });

      console.log(`OTP email sent to ${toEmail}`);

      // Log success to Database
      try {
        const EmailLog = require('../models/EmailLog');
        await EmailLog.create({
          to: toEmail,
          subject,
          type: 'otp',
          status: 'success',
        });
      } catch (logErr) {
        console.error('Failed to log OTP email success:', logErr);
      }

      return true;
    } catch (err) {
      console.error('Error sending OTP email:', err);
      // Log failure to Database
      try {
        const EmailLog = require('../models/EmailLog');
        await EmailLog.create({
          to: toEmail,
          subject: `[Smart Farm] Mã xác thực OTP đăng ký tài khoản`,
          type: 'otp',
          status: 'failed',
          error: err.message || String(err),
        });
      } catch (logErr) {
        console.error('Failed to log OTP email failure:', logErr);
      }
      return false;
    }
  }
}

module.exports = new EmailService();
