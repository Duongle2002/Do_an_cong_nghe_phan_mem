import React, { useEffect, useState } from 'react';
import api from '../api/client';

export default function PairingPanel({ device, onSaved }) {
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(device.pairedSensorId || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('ok');

  // Kiểm tra xem thiết bị hiện tại có phải là S3 Controller không
  const isController = device.externalId && device.externalId.startsWith('esp32s3-');

  useEffect(() => {
    if (!isController) return;
    
    async function fetchDevices() {
      setLoading(true);
      try {
        const res = await api.get('/api/devices');
        // Lọc ra các thiết bị cảm biến (không phải là chính nó và không bắt đầu bằng esp32s3-)
        const list = (res.data || []).filter(
          (d) => (d._id !== device._id && d.id !== device._id) && d.externalId && !d.externalId.startsWith('esp32s3-')
        );
        setDevices(list);
      } catch (err) {
        console.error('Failed to fetch devices for pairing:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDevices();
  }, [device, isController]);

  // Đồng bộ trạng thái khi thiết bị thay đổi
  useEffect(() => {
    setSelectedId(device.pairedSensorId || '');
  }, [device]);

  if (!isController) return null;

  async function handlePair(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const devId = device._id || device.id;
      const res = await api.put(`/api/devices/${devId}`, {
        pairedSensorId: selectedId,
      });
      setMsgType('ok');
      setMessage('Ghép đôi thiết bị thành công! S3 sẽ nhận cấu hình qua MQTT.');
      if (onSaved) onSaved(res.data);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setMsgType('err');
      setMessage(err.response?.data?.message || 'Không thể lưu ghép đôi thiết bị');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden', marginTop: 16 }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #10b981, #3b82f6)' }} />
      <div className="card-header">
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🔗 Ghép cặp Node cảm biến</h4>
          <div className="small muted" style={{ marginTop: 2 }}>Chọn node ESP32 WROOM cảm biến để điều khiển bộ rơ-le này</div>
        </div>
      </div>
      
      <div className="card-body" style={{ padding: 20 }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Đang tải danh sách thiết bị...</div>
        ) : (
          <form onSubmit={handlePair} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500 }}>
                Chọn Node cảm biến (WROOM):
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                <option value="">-- Chưa ghép đôi --</option>
                {devices.map((d) => (
                  <option key={d._id || d.id} value={d.externalId}>
                    {d.name} ({d.externalId})
                  </option>
                ))}
              </select>
            </div>

            {device.pairedSensorId && (
              <div style={{
                fontSize: 12,
                color: '#81c784',
                background: 'rgba(129,199,132,0.1)',
                padding: '6px 12px',
                borderRadius: 8,
                display: 'inline-block',
                width: 'fit-content'
              }}>
                ✓ Đang liên kết với ID: <strong>{device.pairedSensorId}</strong>
              </div>
            )}

            {message && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                background: msgType === 'ok' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 83, 80, 0.12)',
                border: `1px solid ${msgType === 'ok' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 83, 80, 0.25)'}`,
                color: msgType === 'ok' ? '#81c784' : '#ef9a9a',
              }}>
                {message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={saving || (selectedId === (device.pairedSensorId || ''))}
                style={{ padding: '8px 16px', borderRadius: 10 }}
              >
                {saving ? 'Đang ghép đôi...' : '💾 Lưu kết nối'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
