// Popup script to handle UI interactions and state management
let scrapedData = [];
let currentFilter = 'all'; // 'all', '5star', 'lowstar'
let productName = 'Shopee_Product';

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('shopeeUrl');
  const maxPagesInput = document.getElementById('maxPages');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const exportBtn = document.getElementById('exportBtn');
  const copyBtn = document.getElementById('copyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const progressBar = document.getElementById('progressBar');
  const estimatedTimeSpan = document.getElementById('estimatedTime');

  // GitHub Buttons
  const githubHeaderBtn = document.getElementById('githubHeaderBtn');
  const githubBtn = document.getElementById('githubBtn');

  const openGitHub = () => {
    chrome.tabs.create({ url: 'https://github.com/Tnembull/shopee-scraper-extension' });
  };

  if (githubHeaderBtn) githubHeaderBtn.addEventListener('click', openGitHub);
  if (githubBtn) githubBtn.addEventListener('click', openGitHub);

  // Filter Pills
  const filterAll = document.getElementById('filterAll');
  const filterPositif = document.getElementById('filterPositif');
  const filterNetral = document.getElementById('filterNetral');
  const filterNegatif = document.getElementById('filterNegatif');

  // Update estimated time when maxPages changes
  maxPagesInput.addEventListener('input', () => {
    const pages = parseInt(maxPagesInput.value) || 10;
    const seconds = pages * 7;
    
    if (seconds < 60) {
      estimatedTimeSpan.textContent = `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      estimatedTimeSpan.textContent = `${minutes}m ${remainingSeconds}s`;
    }
  });

  // Try to get current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('shopee.co.id')) {
      urlInput.value = tabs[0].url;
    }
  });

  // Filter Pill Listeners
  if (filterAll) filterAll.addEventListener('click', () => setFilter('all'));
  if (filterPositif) filterPositif.addEventListener('click', () => setFilter('positif'));
  if (filterNetral) filterNetral.addEventListener('click', () => setFilter('netral'));
  if (filterNegatif) filterNegatif.addEventListener('click', () => setFilter('negatif'));

  // Scrape Button Click Handler
  scrapeBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const maxPages = parseInt(maxPagesInput.value) || 10;

    if (!url) {
      showStatus('error', 'Silakan masukkan URL produk Shopee!');
      return;
    }

    if (!url.includes('shopee.co.id')) {
      showStatus('error', 'URL harus dari domain shopee.co.id!');
      return;
    }

    if (maxPages < 1 || maxPages > 500) {
      showStatus('error', 'Jumlah halaman harus 1 - 500!');
      return;
    }

    // Toggle Buttons UI
    scrapeBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    exportBtn.disabled = true;
    copyBtn.disabled = true;

    showStatus('info', `Mempersiapkan scraping ${maxPages} halaman...`);
    progressBar.style.display = 'block';
    updateProgress(15);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Navigate tab if URL is different
      if (tab.url !== url) {
        await chrome.tabs.update(tab.id, { url: url });
        await new Promise((resolve) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
        });
        await sleep(3000);
      }

      updateProgress(35);

      // Auto-inject content.js if missing
      await ensureContentScriptInjected(tab.id);

      // Trigger scraping in content script
      chrome.tabs.sendMessage(
        tab.id,
        { action: 'scrapeComments', maxPages: maxPages },
        (response) => {
          stopBtn.style.display = 'none';
          scrapeBtn.style.display = 'flex';

          if (chrome.runtime.lastError) {
            console.error('Messaging error:', chrome.runtime.lastError);
            showStatus('error', 'Gagal terhubung ke halaman. Silakan refresh halaman Shopee dan coba lagi.');
            progressBar.style.display = 'none';
            return;
          }

          updateProgress(100);

          if (response && response.success) {
            if (response.comments && response.comments.length > 0) {
              scrapedData = response.comments;
            }
            if (response.productTitle) {
              productName = response.productTitle;
            }

            updateDashboardStats();
            renderLivePreview();

            if (response.aborted) {
              showStatus('info', `Process dihentikan! ${scrapedData.length} komentar terkumpul.`);
            } else {
              showStatus('success', `Selesai! Berhasil mengambil ${response.count} komentar dari ${response.pagesLoaded} halaman.`);
            }

            if (scrapedData.length > 0) {
              exportBtn.disabled = false;
              copyBtn.disabled = false;
              chrome.storage.local.set({ comments: scrapedData, productName: productName });
            }
          } else {
            showStatus('error', `Scraping gagal: ${response?.error || 'Unknown error'}`);
          }

          setTimeout(() => {
            progressBar.style.display = 'none';
          }, 1500);
        }
      );

    } catch (error) {
      console.error('Error during scraping start:', error);
      showStatus('error', `Error: ${error.message}`);
      stopBtn.style.display = 'none';
      scrapeBtn.style.display = 'flex';
      progressBar.style.display = 'none';
    }
  });

  // Stop Button Click Handler
  stopBtn.addEventListener('click', async () => {
    showStatus('info', 'Menghentikan proses scraping...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'stopScraping' }, (res) => {
      console.log('Stop response:', res);
    });
  });

  // Export Button Click Handler
  exportBtn.addEventListener('click', () => {
    const dataToExport = getFilteredData();
    if (dataToExport.length === 0) {
      showStatus('error', 'Tidak ada data untuk diekspor!');
      return;
    }
    exportToCSV(dataToExport);
  });

  // Copy to Clipboard Button Handler
  copyBtn.addEventListener('click', () => {
    const dataToCopy = getFilteredData();
    if (dataToCopy.length === 0) {
      showStatus('error', 'Tidak ada data untuk disalin!');
      return;
    }
    copyCSVToClipboard(dataToCopy);
  });

  // Reset Button Click Handler
  resetBtn.addEventListener('click', () => {
    scrapedData = [];
    chrome.storage.local.remove(['comments', 'productName', 'isScraping', 'currentPagesLoaded', 'totalPagesRequested', 'statusMessage'], () => {
      updateDashboardStats();
      renderLivePreview();
      exportBtn.disabled = true;
      copyBtn.disabled = true;
      scrapeBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
      progressBar.style.display = 'none';
      showStatus('info', 'Data berhasil dibersihkan.');
      setTimeout(() => {
        document.getElementById('status').style.display = 'none';
      }, 1500);
    });
  });

  // Load Saved Storage & Live Scraping State on Startup
  syncStateFromStorage();

  // Listen for real-time storage updates from background content script
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      syncStateFromStorage();
    }
  });
});

function syncStateFromStorage() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const exportBtn = document.getElementById('exportBtn');
  const copyBtn = document.getElementById('copyBtn');
  const progressBar = document.getElementById('progressBar');

  chrome.storage.local.get(['comments', 'productName', 'isScraping', 'currentPagesLoaded', 'totalPagesRequested', 'statusMessage'], (result) => {
    if (result.comments) {
      scrapedData = result.comments;
    }
    if (result.productName) {
      productName = result.productName;
    }

    updateDashboardStats();
    renderLivePreview();

    if (scrapedData.length > 0) {
      exportBtn.disabled = false;
      copyBtn.disabled = false;
    } else {
      exportBtn.disabled = true;
      copyBtn.disabled = true;
    }

    if (result.isScraping) {
      scrapeBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
      progressBar.style.display = 'block';

      const current = result.currentPagesLoaded || 1;
      const total = result.totalPagesRequested || 10;
      const percent = Math.min(100, Math.round((current / total) * 100));
      updateProgress(percent);

      if (result.statusMessage) {
        showStatus('info', result.statusMessage);
      }
    } else {
      stopBtn.style.display = 'none';
      scrapeBtn.style.display = 'flex';

      if (result.statusMessage) {
        if (result.statusMessage.includes('Selesai')) {
          showStatus('success', result.statusMessage);
        } else if (result.statusMessage.includes('Dihentikan')) {
          showStatus('info', result.statusMessage);
        }
      }
    }
  });
}

// Auto-inject content script if not loaded
async function ensureContentScriptInjected(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script missing, injecting programmatically...');
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            files: ['content.js']
          },
          () => {
            setTimeout(resolve, 500);
          }
        );
      } else {
        resolve();
      }
    });
  });
}

// Filter Helper
function setFilter(filterType) {
  currentFilter = filterType;
  const fAll = document.getElementById('filterAll');
  const fPos = document.getElementById('filterPositif');
  const fNet = document.getElementById('filterNetral');
  const fNeg = document.getElementById('filterNegatif');

  if (fAll) fAll.classList.toggle('active', filterType === 'all');
  if (fPos) fPos.classList.toggle('active', filterType === 'positif');
  if (fNet) fNet.classList.toggle('active', filterType === 'netral');
  if (fNeg) fNeg.classList.toggle('active', filterType === 'negatif');

  renderLivePreview();
}

function getFilteredData() {
  if (currentFilter === 'positif') {
    return scrapedData.filter(item => item.rating >= 4);
  }
  if (currentFilter === 'netral') {
    return scrapedData.filter(item => item.rating === 3);
  }
  if (currentFilter === 'negatif') {
    return scrapedData.filter(item => item.rating >= 1 && item.rating <= 2);
  }
  return scrapedData;
}

function getSentimentCategory(rating) {
  if (rating >= 4) return 'Positif';
  if (rating === 3) return 'Netral';
  return 'Negatif';
}

// UI & Dashboard Updates
function updateDashboardStats() {
  const total = scrapedData.length;
  const positif = scrapedData.filter(item => item.rating >= 4).length;
  const netral = scrapedData.filter(item => item.rating === 3).length;
  const negatif = scrapedData.filter(item => item.rating >= 1 && item.rating <= 2).length;

  const elTotal = document.getElementById('totalCount');
  const elPos = document.getElementById('positifCount');
  const elNet = document.getElementById('netralCount');
  const elNeg = document.getElementById('negatifCount');

  if (elTotal) elTotal.textContent = total;
  if (elPos) elPos.textContent = positif;
  if (elNet) elNet.textContent = netral;
  if (elNeg) elNeg.textContent = negatif;
}

function renderLivePreview() {
  const previewContainer = document.getElementById('previewContainer');
  const previewList = document.getElementById('previewList');
  const filtered = getFilteredData();

  if (!filtered || filtered.length === 0) {
    previewContainer.style.display = 'none';
    return;
  }

  previewContainer.style.display = 'block';
  previewList.innerHTML = '';

  // Take recent 3 items
  const recent = filtered.slice(-3).reverse();

  recent.forEach(item => {
    const card = document.createElement('div');
    card.className = 'preview-card';
    const stars = '★'.repeat(item.rating || 5);
    const category = getSentimentCategory(item.rating);
    
    card.innerHTML = `
      <div class="preview-user">
        <span>${escapeHTML(item.username || 'User')} (${category})</span>
        <span class="preview-stars">${stars}</span>
      </div>
      <div class="preview-text">${escapeHTML(item.comment || '')}</div>
    `;
    previewList.appendChild(card);
  });
}

// Status & Progress Helpers
function showStatus(type, message) {
  const statusDiv = document.getElementById('status');
  statusDiv.className = `status ${type}`;
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
}

function updateProgress(percent) {
  const progressFill = document.getElementById('progressFill');
  progressFill.style.width = `${percent}%`;
  progressFill.textContent = `${percent}%`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CSV Export & Copy Helpers
function exportToCSV(data) {
  try {
    const csvContent = buildCSVString(data);
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const sanitizedTitle = (productName || 'Shopee_Product').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${sanitizedTitle}_${timestamp}.csv`;
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        showStatus('error', `Gagal unduh: ${chrome.runtime.lastError.message}`);
      } else {
        showStatus('success', `File berhasil diunduh: ${filename}`);
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    showStatus('error', `Gagal mengekspor: ${error.message}`);
  }
}

function copyCSVToClipboard(data) {
  try {
    const csvContent = buildCSVString(data);
    navigator.clipboard.writeText(csvContent).then(() => {
      showStatus('success', `✅ ${data.length} ulasan berhasil disalin ke clipboard!`);
    }).catch(err => {
      showStatus('error', `Gagal menyalin: ${err.message}`);
    });
  } catch (error) {
    showStatus('error', `Error copying: ${error.message}`);
  }
}

function buildCSVString(data) {
  const headers = ['Username', 'Rating', 'Kategori', 'Date', 'Comment'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const category = getSentimentCategory(row.rating);
    const values = [
      escapeCSV(row.username),
      row.rating,
      escapeCSV(category),
      escapeCSV(row.date),
      escapeCSV(row.comment)
    ];
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function escapeCSV(str) {
  if (str === null || str === undefined) return '';
  str = String(str);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
