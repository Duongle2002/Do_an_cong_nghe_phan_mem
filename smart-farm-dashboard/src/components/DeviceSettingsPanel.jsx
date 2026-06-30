import React, { useState, useEffect } from 'react';
import api from '../api/client';

export default function DeviceSettingsPanel({ devices, setDevices, activeDevice, setActiveDevice }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  
  // Create form state
  const [createForm, setCreateForm] = useState({ name: '', location: '', externalId: '' });
  const [createError, setCreateError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({ name: '', location: '', externalId: '' });
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // Pairing state
  const [pairingSelected, setPairingSelected] = useState({}); // { [deviceId]: pairedSensorId }
  const [pairingBusy, setPairingBusy] = useState({});

  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('ok');

  function showMsg(text, type = 'ok') {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(''), 4000);
  }

  // Reload devices list
  const refreshDevices = async () => {
    try {
      const res = await api.get('/api/devices');
      setDevices(res.data || []);
    } catch (err) {
      console.error('Failed to refresh devices:', err);
    }
  };

  // Check if device is S3 Controller
  const isController = (dev) => dev.externalId && dev.externalId.startsWith('esp32s3-');

  // Filter sensor nodes (non-controllers with an externalId)
  const sensorNodes = devices.filter(
    (d) => d.externalId && !d.externalId.startsWith('esp32s3-')
  );

  // Handle Add Device Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.name.trim()) return setCreateError('Tên thiết bị không được trống');
    setCreateBusy(true);
    try {
      const body = {
        name: createForm.name.trim(),
        location: createForm.location.trim(),
        externalId: createForm.externalId.trim() || undefined
      };
      await api.post('/api/devices', body);
      setCreateForm({ name: '', location: '', externalId: '' });
      setShowCreateModal(false);
      showMsg('Thêm thiết bị mới thành công!');
      refreshDevices();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Không thể tạo thiết bị mới');
    } finally {
      setCreateBusy(false);
    }
  };

  // Open Edit Modal
  const openEdit = (dev) => {
    setEditingDevice(dev);
    setEditForm({
      name: dev.name || '',
      location: dev.location || '',
      externalId: dev.externalId || ''
    });
    setEditError('');
    setShowEditModal(true);
  };

  // Handle Edit Device Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    if (!editForm.name.trim()) return setEditError('Tên thiết bị không được trống');
    setEditBusy(true);
    try {
      const body = {
        name: editForm.name.trim(),
        location: editForm.location.trim(),
        externalId: editForm.externalId.trim() || undefined
      };
      await api.put(`/api/devices/${editingDevice._id}`, body);
      setShowEditModal(false);
      showMsg('Cập nhật thiết bị thành công!');
      refreshDevices();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Không thể cập nhật thiết bị');
    } finally {
      setEditBusy(false);
    }
  };

  // Handle Delete Device
  const handleDelete = async (dev) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thiết bị "${dev.name}"?\nHành động này sẽ xóa các dữ liệu liên quan.`)) return;
    try {
      await api.delete(`/api/devices/${dev._id}`);
      showMsg('Xóa thiết bị thành công!');
      
      // If we deleted the active device, select another one if available
      if (activeDevice?._id === dev._id) {
        const remaining = devices.filter(d => d._id !== dev._id);
        if (remaining.length > 0) {
          setActiveDevice(remaining[0]);
        } else {
          setActiveDevice(null);
        }
      }
      
      refreshDevices();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Không thể xóa thiết bị', 'err');
    }
  };

  // Initial local pairing state from devices
  useEffect(() => {
    const initialPairing = {};
    devices.forEach(d => {
      if (isController(d)) {
        initialPairing[d._id] = d.pairedSensorId || '';
      }
    });
    setPairingSelected(initialPairing);
  }, [devices]);

  // Handle Pairing Update
  const handlePair = async (devId, sensorId) => {
    setPairingBusy(prev => ({ ...prev, [devId]: true }));
    try {
      await api.put(`/api/devices/${devId}`, {
        pairedSensorId: sensorId
      });
      showMsg('Ghép cặp thiết bị thành công! Cấu hình sẽ được gửi tới Controller qua MQTT.');
      refreshDevices();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Ghép cặp thất bại', 'err');
    } finally {
      setPairingBusy(prev => ({ ...prev, [devId]: false }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Quản lý & Ghép cặp Thiết bị</h2>
          <div className="small muted" style={{ marginTop: 2 }}>Thêm, sửa, xóa thiết bị và kết nối các cảm biến với bộ điều khiển.</div>
        </div>
        <button 
          onClick={() => { setCreateForm({ name: '', location: '', externalId: '' }); setCreateError(''); setShowCreateModal(true); }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10 }}
        >
          ➕ Thêm thiết bị mới
        </button>
      </div>

      {/* Feedback Messages */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: msgType === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 83, 80, 0.15)',
          border: `1px solid ${msgType === 'ok' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 83, 80, 0.3)'}`,
          color: msgType === 'ok' ? '#81c784' : '#ef9a9a',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 0.3s ease'
        }}>
          {msgType === 'ok' ? '✓' : '⚠️'} {message}
        </div>
      )}

      {/* Grid List of Devices */}
      <div className="grid grid-2" style={{ gap: 20 }}>
        {devices.map(dev => {
          const isCtrl = isController(dev);
          const pairingVal = pairingSelected[dev._id] ?? '';
          const isBusy = pairingBusy[dev._id] || false;

          return (
            <div key={dev._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ height: 3, background: isCtrl ? 'linear-gradient(90deg, #10b981, #3b82f6)' : 'linear-gradient(90deg, #ffb300, #ffa726)' }} />
              
              <div className="card-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                {/* Top: Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{isCtrl ? '🎛️' : '📡'}</span>
                      {dev.name}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      📍 {dev.location || 'Chưa thiết lập vị trí'}
                    </div>
                  </div>
                  <span className={`badge ${dev.status === 'online' ? 'ok' : 'err'}`}>
                    {dev.status}
                  </span>
                </div>

                {/* Mid: External ID and Type */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Loại: {isCtrl ? 'Bộ Điều Khiển S3' : 'Node Cảm Biến WROOM'}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    ID: {dev.externalId || 'Chưa thiết lập'}
                  </span>
                </div>

                {/* Pairing options (only for S3 Controller) */}
                {isCtrl ? (
                  <div style={{
                    marginTop: 10,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
                      🔗 Ghép cặp với Node cảm biến (WROOM):
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <select
                        value={pairingVal}
                        onChange={(e) => setPairingSelected(prev => ({ ...prev, [dev._id]: e.target.value }))}
                        disabled={isBusy}
                        style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 8, background: 'var(--bg-sidebar)' }}
                      >
                        <option value="">-- Chọn Node (Chưa ghép đôi) --</option>
                        {sensorNodes.map(s => (
                          <option key={s._id} value={s.externalId}>
                            {s.name} ({s.externalId})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handlePair(dev._id, pairingVal)}
                        disabled={isBusy || pairingVal === (dev.pairedSensorId || '')}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
                      >
                        {isBusy ? 'Lưu...' : 'Lưu'}
                      </button>
                    </div>
                    {dev.pairedSensorId && (
                      <div style={{ fontSize: 11, color: '#81c784', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        ✓ Đang ghép với: <strong>{dev.pairedSensorId}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    marginTop: 'auto',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.2)',
                    fontSize: 11,
                    color: 'var(--text-muted)'
                  }}>
                    📡 Sensor Node tự động gửi dữ liệu nhiệt độ, độ ẩm, đất, ánh sáng về Broker.
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <button
                  onClick={() => openEdit(dev)}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  ✏️ Chỉnh sửa
                </button>
                <button
                  onClick={() => handleDelete(dev)}
                  className="btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(239,83,80,0.15)',
                    borderColor: 'rgba(239,83,80,0.3)',
                    color: '#ef9a9a'
                  }}
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>
          );
        })}

        {devices.length === 0 && (
          <div className="card" style={{ gridColumn: 'span 2', padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-dim)', marginBottom: 8 }}>Chưa có thiết bị nào</div>
            <div className="small muted">Bấm nút ở góc phải để thêm thiết bị ESP32 của bạn.</div>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
        }} onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" style={{
            background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 16,
            width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: 'var(--shadow)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>➕ Thêm thiết bị mới</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            
            <form onSubmit={handleCreateSubmit} style={{ padding: 24, display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Tên thiết bị</label>
                <input 
                  type="text" 
                  value={createForm.name} 
                  onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ví dụ: Controller Khu A, Cảm biến Cà chua"
                  required 
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>External ID (Khớp với ID trên ESP32)</label>
                <input 
                  type="text" 
                  value={createForm.externalId} 
                  onChange={e => setCreateForm(prev => ({ ...prev, externalId: e.target.value }))}
                  placeholder="Ví dụ: esp32s3-xxxx hoặc esp32-xxxx"
                />
                <span className="small muted">ℹ️ Bộ điều khiển bắt đầu bằng <code>esp32s3-</code>. Cảm biến bắt đầu bằng <code>esp32-</code>.</span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Vị trí / Khu vực</label>
                <input 
                  type="text" 
                  value={createForm.location} 
                  onChange={e => setCreateForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Ví dụ: Khu vườn 1, Nhà kính A"
                />
              </div>
              
              {createError && (
                <div style={{ color: '#ef5350', fontSize: 12, fontWeight: 500 }}>
                  ⚠️ {createError}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={createBusy}>
                  {createBusy ? 'Đang tạo...' : 'Tạo thiết bị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
        }} onClick={() => setShowEditModal(false)}>
          <div className="modal-content" style={{
            background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 16,
            width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: 'var(--shadow)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #ffb300, #ffa726)' }} />
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✏️ Chỉnh sửa thiết bị</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            
            <form onSubmit={handleEditSubmit} style={{ padding: 24, display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Tên thiết bị</label>
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required 
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>External ID (Khớp với ID trên ESP32)</label>
                <input 
                  type="text" 
                  value={editForm.externalId} 
                  onChange={e => setEditForm(prev => ({ ...prev, externalId: e.target.value }))}
                  placeholder="esp32-XXXX"
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Vị trí / Khu vực</label>
                <input 
                  type="text" 
                  value={editForm.location} 
                  onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              
              {editError && (
                <div style={{ color: '#ef5350', fontSize: 12, fontWeight: 500 }}>
                  ⚠️ {editError}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                  {editBusy ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
