import React, { useEffect, useState } from 'react';
import api from '../api/client';

function RangeField({ label, min, max, step = 1, value, onChange, unit, disabled }) {
  const display = value === '' || value === undefined || value === null ? '-' : value;
  return (
    <div style={{ display:'grid', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric:'tabular-nums', color:'#555' }}>{display}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value === '' || value === undefined || value === null ? 0 : value}
        onChange={(e)=>onChange(e.target.value)}
        disabled={disabled}
      />
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#888' }}>
        <span>{min}{unit ? ` ${unit}` : ''}</span>
        <span>{max}{unit ? ` ${unit}` : ''}</span>
      </div>
    </div>
  );
}

export default function AutomationPanel({ device, onSaved }) {
  const [form, setForm] = useState({
    autoFanEnabled: false,
    autoFanTempAbove: '',
    autoFanHysteresis: '',
    autoPumpEnabled: false,
    autoPumpSoilBelow: '',
    autoPumpHysteresis: '',
    autoLightEnabled: false,
    autoLightLuxBelow: '',
    autoLightHysteresis: '',
    minToggleIntervalSec: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [lastDeviceId, setLastDeviceId] = useState(null);

  useEffect(() => {
    if (!device) return;
    // Only apply incoming device values if we switched to a different device
    // or if the form is not currently being edited (not dirty)
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
      // Applying values from device is not a user edit, keep dirty=false
      setDirty(false);
    }
  }, [device, dirty, lastDeviceId]);

  function numberOrUndefined(v) {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const payload = {
        autoFanEnabled: form.autoFanEnabled,
        autoFanTempAbove: numberOrUndefined(form.autoFanTempAbove),
        autoFanHysteresis: numberOrUndefined(form.autoFanHysteresis),
        autoPumpEnabled: form.autoPumpEnabled,
        autoPumpSoilBelow: numberOrUndefined(form.autoPumpSoilBelow),
        autoPumpHysteresis: numberOrUndefined(form.autoPumpHysteresis),
        autoLightEnabled: form.autoLightEnabled,
        autoLightLuxBelow: numberOrUndefined(form.autoLightLuxBelow),
        autoLightHysteresis: numberOrUndefined(form.autoLightHysteresis),
        minToggleIntervalSec: numberOrUndefined(form.minToggleIntervalSec),
      };
      const res = await api.put(`/api/devices/${device._id}`, payload);
      setMsg('Saved');
      onSaved && onSaved(res.data);
      setDirty(false);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function markDirty(){ if (!dirty) setDirty(true); }

  function resetFromDevice(){
    if (!device) return;
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
    setDirty(false);
  }

  return (
    <form onSubmit={save} className="card" style={{ maxWidth: 1200 }}>
      <div className="card-header">
        <h4 style={{ margin:0 }}>Tự động nâng cao</h4>
        <span className="small muted">Hysteresis giúp tránh bật/tắt liên tục</span>
      </div>
      <div className="card-body" style={{ display:'grid', gap:16 }}>

        <div className="grid grid-3">
        <fieldset style={{ border:'1px solid #eee', padding:10 }}>
          <legend>Fan</legend>
          <label style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input type="checkbox" checked={form.autoFanEnabled} onChange={e=>{ setForm(f=>({...f, autoFanEnabled:e.target.checked})); markDirty(); }} /> Enable Fan Automation
          </label>
          <RangeField
            label="Temperature Threshold"
            min={0}
            max={60}
            step={0.5}
            value={form.autoFanTempAbove === '' ? '' : Number(form.autoFanTempAbove)}
            onChange={(v)=>{ setForm(f=>({...f, autoFanTempAbove:v})); markDirty(); }}
            unit="°C"
            disabled={!form.autoFanEnabled}
          />
          <RangeField
            label="Hysteresis"
            min={0}
            max={10}
            step={0.5}
            value={form.autoFanHysteresis === '' ? '' : Number(form.autoFanHysteresis)}
            onChange={(v)=>{ setForm(f=>({...f, autoFanHysteresis:v})); markDirty(); }}
            unit="°C"
            disabled={!form.autoFanEnabled}
          />
        </fieldset>

        <fieldset style={{ border:'1px solid #eee', padding:10 }}>
          <legend>Pump</legend>
          <label style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input type="checkbox" checked={form.autoPumpEnabled} onChange={e=>{ setForm(f=>({...f, autoPumpEnabled:e.target.checked})); markDirty(); }} /> Enable Pump Automation
          </label>
          <RangeField
            label="Soil Moisture Threshold"
            min={0}
            max={100}
            step={1}
            value={form.autoPumpSoilBelow === '' ? '' : Number(form.autoPumpSoilBelow)}
            onChange={(v)=>{ setForm(f=>({...f, autoPumpSoilBelow:v})); markDirty(); }}
            unit="%"
            disabled={!form.autoPumpEnabled}
          />
          <RangeField
            label="Hysteresis"
            min={0}
            max={30}
            step={1}
            value={form.autoPumpHysteresis === '' ? '' : Number(form.autoPumpHysteresis)}
            onChange={(v)=>{ setForm(f=>({...f, autoPumpHysteresis:v})); markDirty(); }}
            unit="%"
            disabled={!form.autoPumpEnabled}
          />
        </fieldset>

        <fieldset style={{ border:'1px solid #eee', padding:10 }}>
          <legend>Light</legend>
          <label style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input type="checkbox" checked={form.autoLightEnabled} onChange={e=>{ setForm(f=>({...f, autoLightEnabled:e.target.checked})); markDirty(); }} /> Enable Light Automation
          </label>
          <RangeField
            label="Lux Threshold"
            min={0}
            max={1000}
            step={5}
            value={form.autoLightLuxBelow === '' ? '' : Number(form.autoLightLuxBelow)}
            onChange={(v)=>{ setForm(f=>({...f, autoLightLuxBelow:v})); markDirty(); }}
            unit="lux"
            disabled={!form.autoLightEnabled}
          />
          <RangeField
            label="Hysteresis"
            min={0}
            max={300}
            step={5}
            value={form.autoLightHysteresis === '' ? '' : Number(form.autoLightHysteresis)}
            onChange={(v)=>{ setForm(f=>({...f, autoLightHysteresis:v})); markDirty(); }}
            unit="lux"
            disabled={!form.autoLightEnabled}
          />
        </fieldset>
        </div>

        <fieldset style={{ border:'1px solid #eee', padding:10 }}>
          <legend>General</legend>
          <RangeField
            label="Min Toggle Interval"
            min={0}
            max={300}
            step={5}
            value={form.minToggleIntervalSec === '' ? '' : Number(form.minToggleIntervalSec)}
            onChange={(v)=>{ setForm(f=>({...f, minToggleIntervalSec:v})); markDirty(); }}
            unit="sec"
          />
        </fieldset>

        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button>
          <button type="button" className="btn" onClick={resetFromDevice} disabled={saving || !dirty}>Khôi phục</button>
          {msg && <span className="small" style={{ color: msg==='Saved' ? '#7cffc5' : '#ff9b9b' }}>{msg}</span>}
        </div>
      </div>
    </form>
  );
}
