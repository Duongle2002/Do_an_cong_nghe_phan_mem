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

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    } else {
      console.warn('Email service disabled: EMAIL_USER or EMAIL_PASS not set');
    }
  }

  /**
   * Send alert notification email
   */
  async sendAlertEmail(toEmail, deviceName, alertMessage, alertType) {
    if (!this.enabled) return false;

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

      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject,
        html: htmlContent,
      });

      console.log(`Alert email sent to ${toEmail}`);
      return true;
    } catch (err) {
      console.error('Error sending alert email:', err);
      return false;
    }
  }
}

module.exports = new EmailService();
