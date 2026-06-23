// Light-weight responsive SVG chart drawing engine.
// Avoids heavy library dependencies while rendering clean modern charts.

export function renderPlatformBreakdown(containerId, platformCounts) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const total = Object.values(platformCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <p>No listening history found for selected platforms and criteria.</p>
      </div>
    `;
    return;
  }

  const spotifyPct = Math.round((platformCounts.spotify / total) * 100) || 0;
  const tidalTotal = (platformCounts.tidal || 0) + (platformCounts.lastfm || 0);
  const tidalPct = Math.round((tidalTotal / total) * 100) || 0;
  const ytmPct = Math.round((platformCounts.youtube_music / total) * 100) || 0;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap: 1.5rem; justify-content:center; height:100%; padding-top: 1rem;">
      <!-- Main Progress Track -->
      <div style="height: 24px; border-radius: 12px; display:flex; overflow:hidden; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05);">
        ${platformCounts.spotify > 0 ? `<div style="width: ${spotifyPct}%; background: var(--color-spotify); height: 100%; transition: width 0.5s ease; cursor: pointer;" title="Spotify: ${spotifyPct}%" onclick="window.exploreData({platform: 'spotify'})"></div>` : ''}
        ${tidalTotal > 0 ? `<div style="width: ${tidalPct}%; background: var(--color-tidal); height: 100%; transition: width 0.5s ease; cursor: pointer;" title="Tidal: ${tidalPct}%" onclick="window.exploreData({platform: 'tidal'})"></div>` : ''}
        ${platformCounts.youtube_music > 0 ? `<div style="width: ${ytmPct}%; background: var(--color-youtube-music); height: 100%; transition: width 0.5s ease; cursor: pointer;" title="YouTube Music: ${ytmPct}%" onclick="window.exploreData({platform: 'youtube_music'})"></div>` : ''}
      </div>
      
      <!-- Detailed Stats list -->
      <div style="display:flex; flex-direction:column; gap: 0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="display:flex; align-items:center; gap: 0.5rem; font-size:0.9rem;">
            <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-spotify);"></span>
            Spotify
          </span>
          <span style="font-weight:700; font-family:'Outfit';">${platformCounts.spotify} plays <span style="color:var(--text-muted); font-weight:normal; font-size:0.8rem;">(${spotifyPct}%)</span></span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="display:flex; align-items:center; gap: 0.5rem; font-size:0.9rem;">
            <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-tidal);"></span>
            Tidal
          </span>
          <span style="font-weight:700; font-family:'Outfit';">${tidalTotal} plays <span style="color:var(--text-muted); font-weight:normal; font-size:0.8rem;">(${tidalPct}%)</span></span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="display:flex; align-items:center; gap: 0.5rem; font-size:0.9rem;">
            <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-youtube-music);"></span>
            YouTube Music
          </span>
          <span style="font-weight:700; font-family:'Outfit';">${platformCounts.youtube_music} plays <span style="color:var(--text-muted); font-weight:normal; font-size:0.8rem;">(${ytmPct}%)</span></span>
        </div>
      </div>
    </div>
  `;
}

export function renderTimelineChart(containerId, history, filterType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="height: 100%;">
        <i class="ri-bar-chart-2-line"></i>
        <h3>No activity record</h3>
        <p>There is no listening history inside this time range.</p>
      </div>
    `;
    return;
  }

  // Aggregate plays by Date
  const dateCounts = {};
  const dateNames = [];
  const now = new Date();

  let daysToAggregate = 30;
  if (filterType === '7days') daysToAggregate = 7;
  else if (filterType === '30days') daysToAggregate = 30;
  else if (filterType === '60days') daysToAggregate = 60;
  else daysToAggregate = 60; // default view window for timeline spacing

  // Prepare key entries
  for (let i = daysToAggregate - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    dateCounts[dateStr] = { total: 0, spotify: 0, tidal: 0, youtube_music: 0, lastfm: 0 };
    dateNames.push(dateStr);
  }

  // Fill data
  history.forEach(play => {
    // Safely handle both ISO strings from mock data and numeric timestamps from Firebase
    const d = new Date(play.timestamp);
    if (!isNaN(d.getTime())) {
      const dateStr = d.toISOString().split('T')[0];
      if (dateStr in dateCounts) {
        dateCounts[dateStr].total++;
        dateCounts[dateStr][play.platform]++;
      }
    }
  });

  const maxVal = Math.max(...Object.values(dateCounts).map(d => d.total), 5); // Avoid divide by zero, min 5 height

  // SVG parameters
  const padding = 35;
  const bottomPadding = 25;
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 250;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding - bottomPadding;

  const barCount = dateNames.length;
  const gap = 6;
  const barWidth = Math.max((chartWidth - (gap * (barCount - 1))) / barCount, 2);

  let svgContent = `
    <svg class="svg-chart" width="${width}" height="${height}">
      <defs>
        <linearGradient id="spotify-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1db954" />
          <stop offset="100%" stop-color="#15803d" />
        </linearGradient>
        <linearGradient id="tidal-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00ffff" />
          <stop offset="100%" stop-color="#0e7490" />
        </linearGradient>
        <linearGradient id="ytm-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff0000" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#b91c1c" stop-opacity="0.8" />
        </linearGradient>
      </defs>
  `;

  // Draw Y-axis gridlines
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const val = Math.round((maxVal / ticks) * i);
    const y = padding + chartHeight - (chartHeight / ticks) * i;
    svgContent += `
      <line class="chart-grid-line" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />
      <text x="${padding - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="10" font-family="Outfit" text-anchor="end">${val}</text>
    `;
  }

  // Draw Bars
  dateNames.forEach((dateStr, index) => {
    const dayData = dateCounts[dateStr];
    const x = padding + index * (barWidth + gap);

    // Dynamic label for bottom (every 2nd or 5th label to fit)
    const showLabel = 
      barCount <= 7 || 
      (barCount <= 30 && index % 5 === 0) || 
      (index % 10 === 0);

    const d = new Date(dateStr);
    const labelText = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (showLabel) {
      svgContent += `
        <text x="${x + barWidth / 2}" y="${height - 8}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${labelText}</text>
      `;
    }

    // Stacked Bar heights
    if (dayData.total > 0) {
      let currentY = padding + chartHeight;

      // Platform items stack up
      ['spotify', 'tidal', 'youtube_music'].forEach(plat => {
        const count = plat === 'tidal' ? (dayData.tidal + dayData.lastfm) : dayData[plat];
        if (count > 0) {
          const barH = (chartHeight * count) / maxVal;
          const y = currentY - barH;
          const fill = plat === 'spotify' ? 'url(#spotify-grad)' : (plat === 'tidal' ? 'url(#tidal-grad)' : 'url(#ytm-grad)');
          
          svgContent += `
            <rect 
              x="${x}" 
              y="${y}" 
              width="${barWidth}" 
              height="${barH}" 
              fill="${fill}" 
              class="chart-bar"
              style="cursor: pointer;"
              onclick="window.exploreData({platform: '${plat}', date: '${dateStr}'})"
              data-info="${plat.replace('_', ' ')}: ${count} plays on ${labelText}"
            />
          `;
          currentY = y;
        }
      });
    }
  });

  svgContent += `</svg>`;
  container.innerHTML = svgContent;

  // Add subtle tooltips on hover
  const bars = container.querySelectorAll('.chart-bar');
  bars.forEach(bar => {
    bar.addEventListener('mouseenter', (e) => {
      const tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.innerText = bar.getAttribute('data-info');
      tooltip.style.position = 'absolute';
      tooltip.style.background = 'var(--bg-surface-elevated)';
      tooltip.style.border = '1px solid var(--accent-primary)';
      tooltip.style.padding = '0.5rem 0.75rem';
      tooltip.style.borderRadius = '8px';
      tooltip.style.fontSize = '0.8rem';
      tooltip.style.zIndex = '1000';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.top = `${e.pageY - container.getBoundingClientRect().top - 45}px`;
      tooltip.style.left = `${e.pageX - container.getBoundingClientRect().left - 50}px`;
      tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
      tooltip.id = 'active-chart-tooltip';
      container.appendChild(tooltip);
    });

    bar.addEventListener('mouseleave', () => {
      const tooltip = document.getElementById('active-chart-tooltip');
      if (tooltip) tooltip.remove();
    });
  });
}
