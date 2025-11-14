import React, { useState } from 'react'

export function Tabs({ tabs, initial=0 }){
  const [idx, setIdx] = useState(initial)
  return (
    <div className="card">
      <div className="card-header" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {tabs.map((t,i)=>(
          <button
            key={t.label}
            className={`btn ${i===idx ? 'btn-primary' : ''}`}
            style={{ padding:'6px 12px' }}
            onClick={()=>setIdx(i)}
            type="button"
          >{t.label}</button>
        ))}
      </div>
      <div className="card-body">
        {tabs[idx]?.content}
      </div>
    </div>
  )
}

export default Tabs