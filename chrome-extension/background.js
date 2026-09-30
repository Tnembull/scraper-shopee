// Background service worker
console.log('Shopee Scraper Extension: Background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'downloadCSV') {
    // Handle CSV download
    const csvContent = request.csvContent;
    const filename = request.filename || 'shopee-comments.csv';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    
    return true; // Keep message channel open
  }
  
  if (request.action === 'saveComments') {
    // Save comments to storage
    chrome.storage.local.set({ comments: request.comments }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getComments') {
    // Retrieve comments from storage
    chrome.storage.local.get(['comments'], (result) => {
      sendResponse({ success: true, comments: result.comments || [] });
    });
    return true;
  }
});

// Log when tabs are updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('shopee.co.id')) {
    console.log('Shopee page loaded:', tab.url);
  }
});
