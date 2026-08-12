import React, { useState } from 'react';

// ==========================================
// 1. AREA CHART (Raw SVG with Gradient Fill)
// ==========================================
export function AreaChart({ data = [], dataKey = 'equity', strokeColor = '#00F0FF', fillColor = 'url(#area-grad)', height = 220 }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        No chart data available
      </div>
    );
  }

  // Find Min / Max values to scale coordinates
  const values = data.map(d => Number(d[dataKey] || 0));
  const maxVal = Math.max(...values, 10) * 1.05; // 5% padding
  const minVal = Math.min(...values, 0) * 0.95; // 5% padding
  const valRange = maxVal - minVal;

  const width = 500;
  const padding = { top: 15, right: 15, bottom: 25, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Map values to coordinates
  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - ((d[dataKey] - minVal) / valRange) * graphHeight;
    return { x, y, data: d, val: d[dataKey] };
  });

  // Construct path string
  let pathD = '';
  let areaD = '';

  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`;
  }

  // Draw grid lines
  const gridLinesCount = 4;
  const gridLines = Array.from({ length: gridLinesCount }).map((_, i) => {
    const yVal = minVal + (i / (gridLinesCount - 1)) * valRange;
    const y = padding.top + graphHeight - (i / (gridLinesCount - 1)) * graphHeight;
    return { y, label: yVal.toFixed(0) };
  });

  return (
    <div className="chart-wrapper" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line 
              x1={padding.left} 
              y1={line.y} 
              x2={width - padding.right} 
              y2={line.y} 
              stroke="var(--border-subtle)" 
              strokeDasharray="4 4" 
            />
            <text 
              x={padding.left - 8} 
              y={line.y + 4} 
              fill="var(--text-muted)" 
              fontSize="9" 
              textAnchor="end"
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* Vertical Ticks on dates */}
        {points.length > 1 && [0, Math.floor(points.length / 2), points.length - 1].map((idx) => {
          const p = points[idx];
          if (!p) return null;
          return (
            <text 
              key={idx} 
              x={p.x} 
              y={height - 6} 
              fill="var(--text-muted)" 
              fontSize="9" 
              textAnchor="middle"
            >
              {p.data.date || p.data.timestamp?.split('T')[0] || ''}
            </text>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={fillColor} />

        {/* Path outline */}
        <path 
          d={pathD} 
          fill="none" 
          stroke={strokeColor} 
          strokeWidth="2" 
          strokeLinecap="round" 
        />

        {/* Hover Hotspots */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={hoveredPoint?.idx === idx ? "5" : "3"}
            fill={hoveredPoint?.idx === idx ? strokeColor : "transparent"}
            stroke={strokeColor}
            strokeWidth="1.5"
            onMouseEnter={() => setHoveredPoint({ ...p, idx })}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ cursor: 'pointer', transition: 'all 0.1s' }}
          />
        ))}

        {/* Highlight line on hover */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={padding.top}
            x2={hoveredPoint.x}
            y2={padding.top + graphHeight}
            stroke="var(--border-subtle)"
            strokeDasharray="2 2"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint && (
        <div 
          className="chart-tooltip" 
          style={{ 
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100 - 30}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div style={{ fontWeight: 600 }}>{hoveredPoint.val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{hoveredPoint.data.date || hoveredPoint.data.timestamp}</div>
        </div>
      )}
    </div>
  );
}


// ==========================================
// 2. BAR CHART (Raw SVG Grouped Bars)
// ==========================================
export function BarChart({ data = [], dataKeys = ['techVolume', 'retailVolume'], colors = ['#00F0FF', '#A020F0'], height = 180 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        No chart data available
      </div>
    );
  }

  // Take the last 12 days to avoid overcrowding
  const chartData = data.slice(-12);

  // Find max value
  let maxVal = 0;
  chartData.forEach(d => {
    dataKeys.forEach(k => {
      if (d[k] > maxVal) maxVal = d[k];
    });
  });
  maxVal = Math.max(maxVal, 5) * 1.1;

  const width = 500;
  const padding = { top: 15, right: 10, bottom: 25, left: 35 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const barGroupWidth = graphWidth / chartData.length;
  const gapRatio = 0.3; // 30% gap between groups
  const innerGapRatio = 0.1; // 10% gap between bars within group
  
  const actualGroupWidth = barGroupWidth * (1 - gapRatio);
  const barWidth = (actualGroupWidth / dataKeys.length) * (1 - innerGapRatio);

  return (
    <div className="chart-wrapper">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = padding.top + graphHeight - ratio * graphHeight;
          const label = (ratio * maxVal).toFixed(0);
          return (
            <g key={idx}>
              <line 
                x1={padding.left} 
                y1={y} 
                x2={width - padding.right} 
                y2={y} 
                stroke="var(--border-subtle)" 
                strokeDasharray="4 4" 
              />
              <text 
                x={padding.left - 8} 
                y={y + 3} 
                fill="var(--text-muted)" 
                fontSize="9" 
                textAnchor="end"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Draw bars */}
        {chartData.map((d, index) => {
          const groupX = padding.left + index * barGroupWidth + (barGroupWidth * gapRatio) / 2;
          
          return (
            <g key={index}>
              {/* Draw bars for each key */}
              {dataKeys.map((key, kIdx) => {
                const value = Number(d[key] || 0);
                const barHeight = (value / maxVal) * graphHeight;
                const x = groupX + kIdx * (barWidth + innerGapRatio * barWidth);
                const y = padding.top + graphHeight - barHeight;

                return (
                  <rect
                    key={key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 1)}
                    fill={colors[kIdx]}
                    rx="2"
                    style={{ transition: 'all 0.3s' }}
                  />
                );
              })}

              {/* Day labels (every 2nd day to save space) */}
              {index % 2 === 0 && (
                <text
                  x={groupX + actualGroupWidth / 2}
                  y={height - 6}
                  fill="var(--text-muted)"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {d.date ? d.date.split('-')[2] : ''}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}


// ==========================================
// 3. DONUT CHART (Raw Circle Stroke Calculations)
// ==========================================
export function DonutChart({ techValue = 50, retailValue = 50, height = 180 }) {
  const total = techValue + retailValue;
  const techPercent = total > 0 ? (techValue / total) * 100 : 50;
  const retailPercent = total > 0 ? (retailValue / total) * 100 : 50;

  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~314.16

  // Stroke Dash calculations
  const techStrokeDash = `${(techPercent / 100) * circumference} ${circumference}`;
  const retailStrokeDash = `${(retailPercent / 100) * circumference} ${circumference}`;

  // Start rotation offsets
  const techRotation = -90; // Start at 12 o'clock
  const retailRotation = -90 + (techPercent / 100) * 360;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        {/* Background track circle */}
        <circle
          cx="65"
          cy="65"
          r={radius}
          fill="transparent"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />

        {/* Tech Sector */}
        {techPercent > 0 && (
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="transparent"
            stroke="#00F0FF"
            strokeWidth={strokeWidth}
            strokeDasharray={techStrokeDash}
            transform={`rotate(${techRotation} 65 65)`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        )}

        {/* Retail Sector */}
        {retailPercent > 0 && (
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="transparent"
            stroke="#A020F0"
            strokeWidth={strokeWidth}
            strokeDasharray={retailStrokeDash}
            transform={`rotate(${retailRotation} 65 65)`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        )}

        {/* Center label */}
        <text x="65" y="62" fill="var(--text-primary)" fontSize="18" fontWeight="800" textAnchor="middle" fontFamily="var(--font-family-display)">
          {total > 1000 ? `$${(total/1000).toFixed(0)}k` : `$${total.toFixed(0)}`}
        </text>
        <text x="65" y="78" fill="var(--text-secondary)" fontSize="8" fontWeight="600" textAnchor="middle" letterSpacing="0.05em">
          SALES VOLUME
        </text>
      </svg>

      <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '0.8rem', fontWeight: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00F0FF' }}></span>
          <span>Tech ({techPercent.toFixed(0)}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#A020F0' }}></span>
          <span>Retail ({retailPercent.toFixed(0)}%)</span>
        </div>
      </div>
    </div>
  );
}
