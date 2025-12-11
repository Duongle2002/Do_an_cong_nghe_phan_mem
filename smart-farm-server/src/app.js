const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFound } = require('./middleware/error');

// Routers
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const deviceRoutes = require('./routes/devices.routes');
const sensorRoutes = require('./routes/sensors.routes');
const commandRoutes = require('./routes/commands.routes');
const scheduleRoutes = require('./routes/schedules.routes');
const alertRoutes = require('./routes/alerts.routes');
const alertRulesRoutes = require('./routes/alertRules.routes');
const logRoutes = require('./routes/logs.routes');
const { authenticate } = require('./middleware/auth');
const { verifyAccessToken } = require('./utils/jwt');
const User = require('./models/User');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

// Simplified CORS: allow any localhost origin and those specified via CORS_ORIGIN.
// Since we use Authorization headers (not cookies), we can disable credentials and return '*' safely.
// Ultra-permissive CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api/', limiter);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/alert-rules', alertRulesRoutes);
app.use('/api/logs', logRoutes);

// --- Server-Sent Events: live telemetry/actuator stream ---
const sseClients = new Set();
app.get('/api/stream/devices/:externalId', async (req, res) => {
  try {
    // Allow auth via Authorization header or query ?token=
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).lean();
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // Basic validation
    const externalId = req.params.externalId;
    // Headers
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders && res.flushHeaders();
    const client = { res, externalId, userId: user._id.toString() };
    sseClients.add(client);
    res.write(`event: welcome\ndata: {"externalId":"${externalId}"}\n\n`);
    req.on('close', () => { sseClients.delete(client); });
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
});

// Export push helpers so integrations can broadcast
app.locals.pushTelemetry = (externalId, payload) => {
  if (!payload) return;
  const json = JSON.stringify(payload);
  for (const c of sseClients) {
    if (c.externalId === externalId) {
      c.res.write(`event: telemetry\ndata: ${json}\n\n`);
    }
  }
};

app.locals.pushDeviceStatus = (externalId, status) => {
  if (!externalId || !status) return;
  const json = JSON.stringify({ externalId, status, at: Date.now() });
  for (const c of sseClients) {
    if (c.externalId === externalId) {
      c.res.write(`event: status\ndata: ${json}\n\n`);
    }
  }
};

app.use(notFound);
app.use(errorHandler);

module.exports = app;
