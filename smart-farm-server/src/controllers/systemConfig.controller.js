const SystemConfig = require('../models/SystemConfig');
const EmailLog = require('../models/EmailLog');
const { encrypt, decrypt } = require('../utils/crypto');
const nodemailer = require('nodemailer');

async function getSmtpSettings(req, res) {
  try {
    const config = await SystemConfig.findOne({ key: 'smtp_settings' });
    if (!config) {
      return res.json({
        host: 'smtp.gmail.com',
        port: 587,
        user: '',
        pass: '',
        enabled: false,
      });
    }

    const value = config.value || {};
    return res.json({
      host: value.host || 'smtp.gmail.com',
      port: value.port || 587,
      user: value.user || '',
      pass: value.pass ? '********' : '',
      enabled: !!value.enabled,
    });
  } catch (err) {
    console.error('Error getting SMTP settings:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateSmtpSettings(req, res) {
  try {
    const { host, port, user, pass, enabled } = req.body;
    let config = await SystemConfig.findOne({ key: 'smtp_settings' });

    let finalPass = '';
    if (config && config.value && pass === '********') {
      finalPass = config.value.pass || '';
    } else {
      finalPass = pass ? encrypt(pass) : '';
    }

    const value = {
      host: host || 'smtp.gmail.com',
      port: Number(port) || 587,
      user: user || '',
      pass: finalPass,
      enabled: !!enabled,
    };

    if (!config) {
      config = new SystemConfig({
        key: 'smtp_settings',
        value,
        updatedBy: req.user.id,
      });
    } else {
      config.value = value;
      config.updatedBy = req.user.id;
    }

    await config.save();
    return res.json({ message: 'SMTP settings updated successfully' });
  } catch (err) {
    console.error('Error updating SMTP settings:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function testSmtpSettings(req, res) {
  try {
    const { host, port, user, pass } = req.body;
    let plainPass = pass;

    if (pass === '********') {
      const config = await SystemConfig.findOne({ key: 'smtp_settings' });
      if (config && config.value && config.value.pass) {
        plainPass = decrypt(config.value.pass);
      } else {
        return res.status(400).json({ message: 'No password configured' });
      }
    }

    if (!user || !plainPass) {
      return res.status(400).json({ message: 'User and password are required for test' });
    }

    const portNum = Number(port) || 587;
    const transporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: portNum,
      secure: portNum === 465,
      auth: {
        user,
        pass: plainPass,
      },
      tls: { rejectUnauthorized: true },
    });

    await transporter.verify();

    const adminEmail = req.user.email;
    const subject = 'Smart Farm System - Test SMTP Connection';
    await transporter.sendMail({
      from: `"Smart Farm Test" <${user}>`,
      to: adminEmail,
      subject,
      html: `
        <h3>SMTP Connection Test</h3>
        <p>Congratulations! Your SMTP settings are configured correctly.</p>
        <p>Sent to Admin: <strong>${adminEmail}</strong></p>
        <p>Timestamp: ${new Date().toLocaleString()}</p>
      `,
    });

    try {
      await EmailLog.create({
        to: adminEmail,
        subject,
        type: 'test',
        status: 'success',
      });
    } catch (logErr) {
      console.error('Failed to log test email success:', logErr);
    }

    return res.json({ message: `Test email sent successfully to ${adminEmail}` });
  } catch (err) {
    console.error('SMTP verification/send failed:', err);
    try {
      const adminEmail = req.user?.email || 'unknown';
      await EmailLog.create({
        to: adminEmail,
        subject: 'Smart Farm System - Test SMTP Connection',
        type: 'test',
        status: 'failed',
        error: err.message || String(err),
      });
    } catch (logErr) {
      console.error('Failed to log test email failure:', logErr);
    }
    return res.status(500).json({ message: `SMTP test failed: ${err.message}` });
  }
}

async function getSystemOverview(req, res) {
  try {
    const User = require('../models/User');
    const Device = require('../models/Device');
    const SensorData = require('../models/SensorData');

    const farmers = await User.find({ role: 'Farmer' }).lean();
    const overview = [];

    for (const farmer of farmers) {
      const devices = await Device.find({ ownerId: farmer._id }).lean();
      const deviceDetails = [];

      for (const device of devices) {
        const latestData = await SensorData.findOne({ deviceId: device._id })
          .sort({ timestamp: -1 })
          .lean();
        
        deviceDetails.push({
          _id: device._id,
          name: device.name,
          externalId: device.externalId,
          status: device.status || 'offline',
          location: device.location || '',
          opMode: device.opMode || 'auto',
          lastFanState: device.lastFanState || 'OFF',
          lastPumpState: device.lastPumpState || 'OFF',
          lastLightState: device.lastLightState || 'OFF',
          latestData: latestData ? {
            temperature: latestData.temperature,
            humidity: latestData.humidity,
            soilMoisture: latestData.soilMoisture,
            lux: latestData.lux,
            pH: latestData.pH,
            timestamp: latestData.timestamp,
          } : null,
        });
      }

      overview.push({
        farmer: {
          id: farmer._id,
          name: farmer.name,
          email: farmer.email,
        },
        devices: deviceDetails,
      });
    }

    return res.json(overview);
  } catch (err) {
    console.error('Error getting system overview:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getEmailLogs(req, res) {
  try {
    const logs = await EmailLog.find().sort({ timestamp: -1 }).limit(100).lean();
    return res.json(logs);
  } catch (err) {
    console.error('Error getting email logs:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getSmtpSettings, updateSmtpSettings, testSmtpSettings, getSystemOverview, getEmailLogs };
