import React, { useEffect, useState } from 'react';
import api from '../api/client';

function RangeField({ label, min, max, step = 1, value, onChange, unit, disabled }) {
  const display = value === '' || value === undefined || value === null ? '—' : value;
  const pct = max > min ? ((Number(value) || 0) - min) / (max - min) * 100 : 0;

  return (
    <div style={{ display: 'grid', gap: 8, opacity: disabled ? 0.4 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{label}</span>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 14,
          fontWeight: 600,
          color: disabled ? 'var(--text-muted)' : 'var(--accent)',
          background: disabled ? 'transparent' : 'rgba(105,240,174,0.1)',
          padding: '2px 8px',
          borderRadius: 6,
        }}>
          {display}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value === '' || value === undefined || value === null ? 0 : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{min}{unit ? ` ${unit}` : ''}</span>
        <span>{max}{unit ? ` ${unit}` : ''}</span>
      </div>
    </div>
  );
}

function AutoSection({ title, icon, enabledKey, form, setForm, markDirty, children }) {
  const enabled = form[enabledKey]
  return (
    <div style={{
      background: enabled ? 'rgba(16, 185, 129,0.06)' : 'rgba(0,0,0,0.15)',
      border: `1px solid ${enabled ? 'rgba(16, 185, 129,0.25)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: 16,
      transition: 'all 0.25s ease',
    }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', marginBottom: enabled ? 16 : 0,
        userSelect: 'none',
      }}>
        <div style={{
          width: 40, height: 22, borderRadius: 11,
          background: enabled ? 'var(--primary)' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
          boxShadow: enabled ? '0 0 10px rgba(16, 185, 129,0.4)' : 'none',
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            background: 'rgba(0,0,0,0.25)',
            position: 'absolute', top: 3,
            left: enabled ? 21 : 3,
            transition: 'left 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }} />
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => { setForm(f => ({ ...f, [enabledKey]: e.target.checked })); markDirty() }}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
        </div>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
        {!enabled && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Tắt</span>}
      </label>
      {enabled && <div style={{ display: 'grid', gap: 14 }}>{children}</div>}
    </div>
  )
}

export default function AutomationPanel({ device, onSaved }) {
  const [form, setForm] = useState({
    autoFanEnabled: false, autoFanTempAbove: '', autoFanHysteresis: '',
    autoPumpEnabled: false, autoPumpSoilBelow: '', autoPumpHysteresis: '',
    autoLightEnabled: false, autoLightLuxBelow: '', autoLightHysteresis: '',
    minToggleIntervalSec: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [lastDeviceId, setLastDeviceId] = useState(null);

  useEffect(() => {
    if (!device) return;
    const devId = device._id || device.id;
    const isDeviceChanged = devId && devId !== lastDeviceId;
    if (isDeviceChanged || !dirty) {
      setForm({
        autoFanEnabled: !!device.autoFanEnabled,
        autoFanTempAbove: device.autoFanTempAbove ?? '',
        autoFanHysteresis: device.autoFanHysteresis ?? '',
        autoPumpEnabled: !!device.autoPumpEnabled,
        autoPumpSoilBelow: device.autoPumpSoilBelow ?? '',
        autoPumpHysteresis: device.autoPumpHysteresis ?? '',
        autoLightEnabled: !!device.autoLightEnabled,
        autoLightLuxBelow: device.autoLightLuxBelow ?? '',
        autoLightHysteresis: device.autoLightHysteresis ?? '',
        minToggleIntervalSec: device.minToggleIntervalSec ?? '',
      });
      setLastDeviceId(devId || null);
      setDirty(false);
    }
  }, [device, dirty, lastDeviceId]);

  function markDirty() { if (!dirty) setDirty(true); }
  function num(v) { if (v === '' || v == null) return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const payload = {
        autoFanEnabled: form.autoFanEnabled, autoFanTempAbove: num(form.autoFanTempAbove), autoFanHysteresis: num(form.autoFanHysteresis),
        autoPumpEnabled: form.autoPumpEnabled, autoPumpSoilBelow: num(form.autoPumpSoilBelow), autoPumpHysteresis: num(form.autoPumpHysteresis),
        autoLightEnabled: form.autoLightEnabled, autoLightLuxBelow: num(form.autoLightLuxBelow), autoLightHysteresis: num(form.autoLightHysteresis),
        minToggleIntervalSec: num(form.minToggleIntervalSec),
      };
      const res = await api.put(`/api/devices/${device._id}`, payload);
      setMsg('ok'); onSaved && onSaved(res.data); setDirty(false);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('err');
    } finally { setSaving(false); }
  }

  function reset() {
    if (!device) return;
    setForm({
      autoFanEnabled: !!device.autoFanEnabled, autoFanTempAbove: device.autoFanTempAbove ?? '', autoFanHysteresis: device.autoFanHysteresis ?? '',
      autoPumpEnabled: !!device.autoPumpEnabled, autoPumpSoilBelow: device.autoPumpSoilBelow ?? '', autoPumpHysteresis: device.autoPumpHysteresis ?? '',
      autoLightEnabled: !!device.autoLightEnabled, autoLightLuxBelow: device.autoLightLuxBelow ?? '', autoLightHysteresis: device.autoLightHysteresis ?? '',
      minToggleIntervalSec: device.minToggleIntervalSec ?? '',
    });
    setDirty(false);
  }

  return (
    <form onSubmit={save} className="card">
      <div className="card-header">
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🤖 Tự động hoá</h4>
          <div className="small muted" style={{ marginTop: 2 }}>Hysteresis giúp tránh bật/tắt liên tục</div>
        </div>
        {dirty && (
          <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6,
            background: 'rgba(255,167,38,0.15)', border: '1px solid rgba(255,167,38,0.3)', color: '#ffcc80',
          }}>
            Chưa lưu
          </span>
        )}
      </div>

      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        <div className="grid grid-3">
          <AutoSection title="Quạt" icon="🌀" enabledKey="autoFanEnabled" form={form} setForm={setForm} markDirty={markDirty}>
            <RangeField label="Ngưỡng nhiệt độ" min={0} max={60} step={0.5}
              value={form.autoFanTempAbove === '' ? '' : Number(form.autoFanTempAbove)}
              onChange={v => { setForm(f => ({ ...f, autoFanTempAbove: v })); markDirty(); }}
              unit="°C" disabled={!form.autoFanEnabled} />
            <RangeField label="Hysteresis" min={0} max={10} step={0.5}
              value={form.autoFanHysteresis === '' ? '' : Number(form.autoFanHysteresis)}
              onChange={v => { setForm(f => ({ ...f, autoFanHysteresis: v })); markDirty(); }}
              unit="°C" disabled={!form.autoFanEnabled} />
          </AutoSection>

          <AutoSection title="Bơm nước" icon="💦" enabledKey="autoPumpEnabled" form={form} setForm={setForm} markDirty={markDirty}>
            <RangeField label="Ngưỡng độ ẩm đất" min={0} max={100} step={1}
              value={form.autoPumpSoilBelow === '' ? '' : Number(form.autoPumpSoilBelow)}
              onChange={v => { setForm(f => ({ ...f, autoPumpSoilBelow: v })); markDirty(); }}
              unit="%" disabled={!form.autoPumpEnabled} />
            <RangeField label="Hysteresis" min={0} max={30} step={1}
              value={form.autoPumpHysteresis === '' ? '' : Number(form.autoPumpHysteresis)}
              onChange={v => { setForm(f => ({ ...f, autoPumpHysteresis: v })); markDirty(); }}
              unit="%" disabled={!form.autoPumpEnabled} />
          </AutoSection>

          <AutoSection title="Đèn chiếu" icon="💡" enabledKey="autoLightEnabled" form={form} setForm={setForm} markDirty={markDirty}>
            <RangeField label="Ngưỡng ánh sáng" min={0} max={1000} step={5}
              value={form.autoLightLuxBelow === '' ? '' : Number(form.autoLightLuxBelow)}
              onChange={v => { setForm(f => ({ ...f, autoLightLuxBelow: v })); markDirty(); }}
              unit="lux" disabled={!form.autoLightEnabled} />
            <RangeField label="Hysteresis" min={0} max={300} step={5}
              value={form.autoLightHysteresis === '' ? '' : Number(form.autoLightHysteresis)}
              onChange={v => { setForm(f => ({ ...f, autoLightHysteresis: v })); markDirty(); }}
              unit="lux" disabled={!form.autoLightEnabled} />
          </AutoSection>
        </div>

        <div style={{
          background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 10 }}>
            ⚙ Cài đặt chung
          </div>
          <RangeField label="Thời gian tối thiểu giữa các lần bật/tắt" min={0} max={300} step={5}
            value={form.minToggleIntervalSec === '' ? '' : Number(form.minToggleIntervalSec)}
            onChange={v => { setForm(f => ({ ...f, minToggleIntervalSec: v })); markDirty(); }}
            unit="giây" />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                Đang lưu...
              </span>
            ) : '💾 Lưu cấu hình'}
          </button>
          <button type="button" className="btn btn-outline" onClick={reset} disabled={saving || !dirty}>
            Khôi phục
          </button>
          {msg === 'ok' && <span style={{ fontSize: 13, color: '#81c784' }}>✓ Đã lưu thành công</span>}
          {msg === 'err' && <span style={{ fontSize: 13, color: '#ef9a9a' }}>⚠ Lưu thất bại</span>}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}
