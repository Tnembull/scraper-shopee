// Content script to scrape Shopee comments
console.log('Shopee Scraper Extension: Content script loaded');

// Configuration
const CHUNK_SIZE = 100; // Scrape 100 pages per chunk
const SAVE_INTERVAL = CHUNK_SIZE; // Auto-save every 100 pages

// Wait for page to load completely
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// Helper function to generate CSV and trigger download
function downloadCSVChunk(comments, chunkNumber, totalChunks) {
  console.log(`[Download] Generating CSV for chunk ${chunkNumber}/${totalChunks}...`);
  
  // CSV header
  let csv = 'Username,Rating,Date,Comment\n';
  
  // Add each comment
  comments.forEach(comment => {
    const username = escapeCSV(comment.username || '');
    const rating = comment.rating || 0;
    const date = escapeCSV(comment.date || '');
    const commentText = escapeCSV(comment.comment || '');
    
    csv += `${username},${rating},${date},${commentText}\n`;
  });
  
  // Generate filename with chunk number
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `shopee_comments_chunk_${chunkNumber}_of_${totalChunks}_${timestamp}.csv`;
  
  // Create blob and download
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  
  console.log(`[Download] ✅ Downloaded: ${filename}`);
}

// Helper function to escape CSV values
function escapeCSV(str) {
  if (str === null || str === undefined) return '';
  str = String(str);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Scroll to rating section
async function scrollToRatings() {
  console.log('[Scroll] Looking for ratings section...');
  
  // Quick check for ratings section or comment container
  let ratingSection = document.querySelector('.product-ratings') || 
                      document.querySelector('[data-sqe="rating"]') ||
                      document.querySelector('.ejmN1R') ||
                      document.querySelector('.shopee-product-rating') ||
                      document.querySelector('.shopee-product-comment-list') ||
                      document.querySelector('[data-cmtid]');

  // If not immediately visible, scroll down to trigger Shopee lazy load
  if (!ratingSection) {
    console.log('[Scroll] Section not immediately visible, scrolling down to trigger lazy load...');
    window.scrollBy({ top: 800, behavior: 'smooth' });
    await sleep(1500);
    window.scrollBy({ top: 800, behavior: 'smooth' });
    await sleep(1500);

    ratingSection = document.querySelector('.product-ratings') || 
                    document.querySelector('[data-sqe="rating"]') ||
                    document.querySelector('.ejmN1R') ||
                    document.querySelector('.shopee-product-rating') ||
                    document.querySelector('.shopee-product-comment-list') ||
                    document.querySelector('[data-cmtid]');
  }

  if (ratingSection) {
    console.log('[Scroll] Found ratings section, scrolling into view...');
    ratingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(2000);
    
    // Scroll a bit more to ensure pagination is visible
    window.scrollBy({ top: 300, behavior: 'smooth' });
    await sleep(1000);
    
    console.log('[Scroll] ✅ Scrolled to ratings section');
    return true;
  }

  console.log('[Scroll] ❌ Ratings section not found on page');
  return false;
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Find and click next pagination button
async function findAndClickNextButton(pageNumber) {
  console.log(`[Click] Looking for next button for page ${pageNumber}...`);
  
  let nextButton = null;
  
  // Strategy 1: Direct class selector
  nextButton = document.querySelector('.shopee-icon-button--right');
  
  // Strategy 2: Text-based fallback
  if (!nextButton || nextButton.disabled) {
    console.log('[Click] Strategy 1 failed, trying Strategy 2...');
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
      const buttonText = button.textContent.trim();
      const isDisabled = button.disabled || button.classList.contains('shopee-button-no-outline--disabled');
      
      if (buttonText === '›' && !isDisabled) {
        nextButton = button;
        break;
      }
    }
  }
  
  // Strategy 3: Container-based fallback
  if (!nextButton || nextButton.disabled) {
    console.log('[Click] Strategy 2 failed, trying Strategy 3...');
    const paginationContainer = document.querySelector('.shopee-mini-page-controller');
    if (paginationContainer) {
      const buttons = paginationContainer.querySelectorAll('button:not([disabled])');
      const lastButton = buttons[buttons.length - 1];
      if (lastButton) {
        nextButton = lastButton;
      }
    }
  }
  
  if (!nextButton || nextButton.disabled) {
    console.log(`[Click] ❌ No enabled next button found`);
    return null;
  }
  
  // Found button, now click it
  console.log(`[Click] ✅ Found next button: ${nextButton.className}`);
  console.log(`[Click] Button text: "${nextButton.textContent.trim()}"`);
  
  // Scroll button into view
  nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(500);
  
  // Multiple click methods for reliability
  console.log(`[Click] Clicking button...`);
  nextButton.focus();
  await sleep(100);
  
  nextButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  await sleep(50);
  nextButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  await sleep(50);
  
  nextButton.click();
  nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  
  console.log(`[Click] ✅ Button clicked for page ${pageNumber}`);
  
  // Scroll down to trigger lazy load
  await sleep(500);
  window.scrollBy({ top: 200, behavior: 'smooth' });
  
  return nextButton;
}

// Click "Lihat Semua" button to load more comments
async function clickLoadMore() {
  // Find the "Lihat Semua" or pagination buttons
  const loadMoreButtons = [
    ...document.querySelectorAll('button'),
    ...document.querySelectorAll('.shopee-button-solid--primary'),
    ...document.querySelectorAll('[class*="btn"]')
  ];
  
  for (const button of loadMoreButtons) {
    const text = button.textContent.trim().toLowerCase();
    if (text.includes('lihat semua') || text.includes('selanjutnya') || text.includes('next')) {
      button.click();
      await sleep(2000); // Wait for content to load
      return true;
    }
  }
  return false;
}

// Click pagination to load more comments
async function loadAllComments(maxPages = 10) {
  console.log(`[Pagination] Starting to load up to ${maxPages} pages...`);
  
  let currentPage = 1; // Start from page 1
  let previousCommentCount = 0;
  
  // Count initial comments
  const initialXPath = '//div[@data-cmtid]';
  let initialResult = document.evaluate(initialXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  previousCommentCount = initialResult.snapshotLength;
  console.log(`[Pagination] Initial comments on page 1: ${previousCommentCount}`);
  
  // Try to load more pages
  for (let i = 1; i < maxPages; i++) {
    console.log(`[Pagination] Attempting to load page ${i + 1}...`);
    
    // Find pagination button with class "shopee-icon-button--right"
    let nextButton = null;
    
    // Strategy 1: Find button with class "shopee-icon-button--right"
    nextButton = document.querySelector('.shopee-icon-button--right');
    
    // Strategy 2: Alternative - find button with "›" text
    if (!nextButton || nextButton.disabled) {
      console.log('[Pagination] Strategy 1 failed, trying Strategy 2...');
      const allButtons = document.querySelectorAll('button');
      for (const button of allButtons) {
        const buttonText = button.textContent.trim();
        const isDisabled = button.disabled || button.classList.contains('shopee-button-no-outline--disabled');
        
        // Check if it's a next button
        if (buttonText === '›' && !isDisabled) {
          nextButton = button;
          break;
        }
      }
    }
    
    // Strategy 3: Try pagination container
    if (!nextButton || nextButton.disabled) {
      console.log('[Pagination] Strategy 2 failed, trying Strategy 3...');
      const paginationContainer = document.querySelector('.shopee-mini-page-controller');
      if (paginationContainer) {
        const buttons = paginationContainer.querySelectorAll('button:not([disabled])');
        // Find the last enabled button
        const lastButton = buttons[buttons.length - 1];
        if (lastButton) {
          nextButton = lastButton;
        }
      }
    }
    
    if (!nextButton || nextButton.disabled) {
      console.log(`[Pagination] No enabled next button found. Stopping at page ${currentPage}`);
      break;
    }
    
    // Click the button
    console.log(`[Pagination] Found next button with class: ${nextButton.className}`);
    console.log(`[Pagination] Button disabled state: ${nextButton.disabled}`);
    console.log(`[Pagination] Button text: "${nextButton.textContent.trim()}"`);
    
    // Get current URL/state before click
    const urlBefore = window.location.href;
    console.log(`[Pagination] URL before click: ${urlBefore}`);
    
    // Scroll to pagination to ensure it's visible
    nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(800); // Wait for scroll to complete
    
    console.log(`[Pagination] Clicking next button for page ${i + 1}...`);
    
    // Method 1: Focus then click
    nextButton.focus();
    await sleep(100);
    
    // Method 2: MouseDown + MouseUp (more realistic)
    nextButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    await sleep(50);
    nextButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    await sleep(50);
    
    // Method 3: Standard click
    nextButton.click();
    await sleep(50);
    
    // Method 4: Dispatch click event
    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    
    console.log(`[Pagination] All click methods triggered`);
    
    // Check if URL changed
    await sleep(500);
    const urlAfter = window.location.href;
    console.log(`[Pagination] URL after click: ${urlAfter}`);
    console.log(`[Pagination] URL changed: ${urlBefore !== urlAfter}`);
    
    // Wait for new comments to load (4 seconds for slow networks)
    console.log(`[Pagination] Waiting 4 seconds for comments to load...`);
    await sleep(4000);
    
    // Scroll down a bit to trigger lazy loading
    console.log(`[Pagination] Scrolling down to trigger lazy load...`);
    window.scrollBy({ top: 200, behavior: 'smooth' });
    await sleep(1000);
    
    // Count comments after click
    const newResult = document.evaluate(initialXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const newCommentCount = newResult.snapshotLength;
    
    console.log(`[Pagination] Comments after page ${i + 1}: ${newCommentCount} (previous: ${previousCommentCount})`);
    
    // Check if comments actually increased
    if (newCommentCount > previousCommentCount) {
      console.log(`[Pagination] ✅ Successfully loaded ${newCommentCount - previousCommentCount} new comments`);
      previousCommentCount = newCommentCount;
      currentPage = i + 1;
    } else {
      console.log(`[Pagination] ⚠️ No new comments loaded after 4s. Trying aggressive retry...`);
      
      // Aggressive retry: scroll more and wait longer
      console.log(`[Pagination] Scrolling down more aggressively...`);
      window.scrollBy({ top: 500, behavior: 'smooth' });
      await sleep(1000);
      window.scrollBy({ top: -200, behavior: 'smooth' });
      await sleep(3000);
      
      const retryResult = document.evaluate(initialXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const retryCommentCount = retryResult.snapshotLength;
      
      console.log(`[Pagination] Comments after aggressive retry: ${retryCommentCount}`);
      
      if (retryCommentCount > previousCommentCount) {
        console.log(`[Pagination] ✅ Comments loaded after retry: ${retryCommentCount - previousCommentCount} new comments`);
        previousCommentCount = retryCommentCount;
        currentPage = i + 1;
      } else {
        console.log(`[Pagination] ❌ Still no new comments after all attempts`);
        console.log(`[Pagination] Possible reasons:`);
        console.log(`  - Button click not working (check if button is actually clickable)`);
        console.log(`  - No more pages available (only 1 page of comments)`);
        console.log(`  - Shopee changed their pagination system`);
        console.log(`  - Network issue preventing data load`);
        break;
      }
    }
    
    // Extra wait between pages
    await sleep(500);
  }
  
  console.log(`[Pagination] Finished. Total pages loaded: ${currentPage}, Total comments: ${previousCommentCount}`);
  return currentPage;
}

// Extract comment data with duplicate tracking
function extractCommentsWithTracking(extractedIds) {
  console.log('[Extract] Starting comment extraction with tracking...');
  const comments = [];
  
  // Use XPath to find ALL comment containers in DOM
  const xpath = '//div[@data-cmtid]';
  const xpathResult = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
  let commentElements = [];
  for (let i = 0; i < xpathResult.snapshotLength; i++) {
    commentElements.push(xpathResult.snapshotItem(i));
  }
  
  console.log(`[Extract] XPath found ${commentElements.length} comment containers in DOM`);
  console.log(`[Extract] Already extracted: ${extractedIds.size} comments`);
  
  // Fallback to CSS selector if XPath returns nothing
  if (commentElements.length === 0) {
    console.log('[Extract] XPath found no comments, trying CSS selector fallback...');
    commentElements = Array.from(document.querySelectorAll('[data-cmtid]'));
    console.log(`[Extract] CSS selector found ${commentElements.length} comment containers`);
  }
  
  if (commentElements.length === 0) {
    console.log('[Extract] ❌ No comments found in DOM');
    return comments;
  }
  
  console.log(`[Extract] Processing ${commentElements.length} comment elements...`);
  let successCount = 0;
  let failCount = 0;
  let duplicateCount = 0;
  
  commentElements.forEach((element, index) => {
    try {
      const cmtid = element.getAttribute('data-cmtid');
      
      // Skip if already extracted
      if (extractedIds.has(cmtid)) {
        duplicateCount++;
        console.log(`[Extract] ⏭️  #${index + 1}: Skipped (cmtid: ${cmtid}) - Already extracted`);
        return;
      }
      
      console.log(`[Extract] Processing comment ${index + 1}/${commentElements.length} (cmtid: ${cmtid})`);
      
      // Extract username using XPath
      let username = '';
      const usernameXPath = './/div[contains(text(), "|")]/parent::div/parent::div/*[1]';
      const usernameResult = document.evaluate(usernameXPath, element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (usernameResult.singleNodeValue) {
        username = usernameResult.singleNodeValue.textContent.trim();
      }
      
      // Extract date and variant using XPath
      let date = '';
      const dateXPath = './/div[contains(text(), "|")]';
      const dateResult = document.evaluate(dateXPath, element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (dateResult.singleNodeValue) {
        date = dateResult.singleNodeValue.textContent.trim();
      }
      
      // Extract comment body using XPath
      let commentText = '';
      const bodyXPath = './/div[contains(text(), "|")]/parent::div/parent::div/following-sibling::div[1]';
      const bodyResult = document.evaluate(bodyXPath, element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (bodyResult.singleNodeValue) {
        commentText = bodyResult.singleNodeValue.textContent.trim();
      }
      
      // Extract rating by counting SVG stars using XPath
      let rating = 0;
      const ratingXPath = './/svg[contains(@class, "icon-rating-solid")]';
      const ratingResult = document.evaluate(ratingXPath, element, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      rating = ratingResult.snapshotLength;
      
      // Only add if we have meaningful comment text
      if (commentText && commentText.length > 5) {
        const comment = {
          username: username,
          rating: rating,
          date: date,
          comment: commentText.replace(/[\r\n]+/g, ' ').trim()
        };
        
        comments.push(comment);
        extractedIds.add(cmtid); // Mark as extracted
        
        successCount++;
        console.log(`[Extract] ✅ #${index + 1}: ${username} (${rating}★) - ${commentText.substring(0, 40)}...`);
      } else {
        failCount++;
        console.log(`[Extract] ⚠️ #${index + 1}: Skipped - no comment text (username: ${username}, date: ${date})`);
      }
    } catch (error) {
      failCount++;
      console.error(`[Extract] ❌ Error extracting comment ${index + 1}:`, error);
    }
  });
  
  console.log(`[Extract] ===== Extraction Summary =====`);
  console.log(`[Extract] Total in DOM: ${commentElements.length}`);
  console.log(`[Extract] New comments: ${successCount}`);
  console.log(`[Extract] Duplicates: ${duplicateCount}`);
  console.log(`[Extract] Failed: ${failCount}`);
  console.log(`[Extract] Total extracted (cumulative): ${extractedIds.size}`);
  
  return comments;
}

// Extract comment data from the page using XPath approach (OLD - keep for fallback)
function extractComments() {
  console.log('[Extract] Starting comment extraction...');
  const comments = [];
  
  // Method 1: Try using XPath to find comment containers
  const xpath = '//div[@data-cmtid]';
  const xpathResult = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
  let commentElements = [];
  for (let i = 0; i < xpathResult.snapshotLength; i++) {
    commentElements.push(xpathResult.snapshotItem(i));
  }
  
  console.log(`[Extract] XPath found ${commentElements.length} comment containers`);
  
  // Method 2: Fallback to querySelectorAll if XPath returns nothing
  if (commentElements.length === 0) {
    console.log('[Extract] XPath found no comments, trying CSS selector fallback...');
    const commentList = document.querySelector('.shopee-product-comment-list');
    if (commentList) {
      commentElements = Array.from(commentList.children).filter(el => el.hasAttribute('data-cmtid'));
      console.log(`[Extract] CSS selector found ${commentElements.length} comment containers`);
    }
  }
  
  if (commentElements.length === 0) {
    console.log('[Extract] ❌ No comments found with data-cmtid attribute');
    return comments;
  }
  
  console.log(`[Extract] Processing ${commentElements.length} comment elements...`);
  let successCount = 0;
  let failCount = 0;
  
  commentElements.forEach((element, index) => {
    try {
      const cmtid = element.getAttribute('data-cmtid');
      console.log(`[Extract] Processing comment ${index + 1}/${commentElements.length} (cmtid: ${cmtid})`);
      
      // Extract username using XPath
      let username = 'Unknown';
      const usernameXPath = './/div[contains(text(), "|")]/parent::div/parent::div/*[1]';
      const usernameResult = document.evaluate(usernameXPath, element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (usernameResult.singleNodeValue) {
        username = usernameResult.singleNodeValue.textContent.trim();
      }
      
      // Extract date and variant using XPath
      let date = '';
      const dateXPath = './/div[contains(text(), "|")]';
      const dateResult = document.evaluate(dateXPath, element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (dateResult.singleNodeValue) {
        date = dateResult.singleNodeValue.textContent.trim();
      }
      
      // Extract comment body using XPath
      let commentText = '';
      const bodyXPath = './/div[contains(text(), "|")]/parent::div/parent::div/following-sibling::div[1]';
      const bodyResult = document.evaluate(bodyXPath, element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (bodyResult.singleNodeValue) {
        commentText = bodyResult.singleNodeValue.textContent.trim();
      }
      
      // Extract rating by counting SVG stars using XPath
      let rating = 0;
      const ratingXPath = './/svg[contains(@class, "icon-rating-solid")]';
      const ratingResult = document.evaluate(ratingXPath, element, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      rating = ratingResult.snapshotLength;
      
      // Only add if we have meaningful comment text
      if (commentText && commentText.length > 5) {
        comments.push({
          username: username,
          rating: rating,
          date: date,
          comment: commentText.replace(/[\r\n]+/g, ' ').trim()
        });
        
        successCount++;
        console.log(`[Extract] ✅ #${index + 1}: ${username} (${rating}★) - ${commentText.substring(0, 40)}...`);
      } else {
        failCount++;
        console.log(`[Extract] ⚠️ #${index + 1}: Skipped - no comment text (username: ${username}, date: ${date})`);
      }
    } catch (error) {
      failCount++;
      console.error(`[Extract] ❌ Error extracting comment ${index + 1}:`, error);
    }
  });
  
  console.log(`[Extract] ✅ Extraction complete: ${successCount} success, ${failCount} failed, ${comments.length} total valid comments`);
  return comments;
}

// Abort flag for cancellation
let isScrapingAborted = false;

// Extract Shopee Product Title for smart naming
function getShopeeProductTitle() {
  const h1 = document.querySelector('h1') || document.querySelector('.WB_tW') || document.querySelector('[data-sqe="name"]');
  if (h1 && h1.textContent) {
    return h1.textContent.trim().replace(/[^a-zA-Z0-9_ -]/g, '').substring(0, 40);
  }
  return 'Shopee_Product';
}

// Main scraping function with chunking support for large datasets
async function scrapeComments(maxPages = 10) {
  try {
    isScrapingAborted = false;
    console.log('[Scraper] Starting comment scraping with chunking support...');
    console.log(`[Scraper] Total pages requested: ${maxPages}`);
    
    const productTitle = getShopeeProductTitle();
    
    // Calculate chunks
    const totalChunks = Math.ceil(maxPages / CHUNK_SIZE);
    console.log(`[Scraper] Will be split into ${totalChunks} chunk(s) of ${CHUNK_SIZE} pages each`);
    
    // Scroll to ratings section & verify existence
    const hasRatingsSection = await scrollToRatings();
    if (!hasRatingsSection) {
      console.log('[Scraper] ❌ Ratings section not found. Aborting scraping.');
      chrome.storage.local.set({
        isScraping: false,
        statusMessage: '❌ Gagal: Section ulasan/komentar produk tidak ditemukan di halaman ini! Pastikan Anda berada di halaman produk Shopee yang Memiliki Ulasan.'
      });
      return {
        success: false,
        error: 'Section ulasan/komentar tidak ditemukan pada halaman ini! Pastikan Anda membuka halaman produk Shopee yang memiliki ulasan/penilaian.'
      };
    }

    await sleep(2000);
    
    // Global tracking
    let globalPage = 1;
    let totalCommentsCollected = 0;
    const allChunkResults = [];
    const accumulatedAllComments = [];
    
    // Initial storage state set
    chrome.storage.local.set({
      isScraping: true,
      currentPagesLoaded: 1,
      totalPagesRequested: maxPages,
      comments: accumulatedAllComments,
      productName: productTitle,
      statusMessage: `Memulai scraping ${maxPages} halaman...`
    });

    // Process each chunk
    for (let chunkNum = 1; chunkNum <= totalChunks; chunkNum++) {
      if (isScrapingAborted) {
        console.log('[Scraper] Scraping aborted by user.');
        break;
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[Scraper] 📦 CHUNK ${chunkNum}/${totalChunks} STARTING`);
      console.log(`${'='.repeat(60)}`);
      
      // Calculate pages for this chunk
      const startPage = (chunkNum - 1) * CHUNK_SIZE + 1;
      const endPage = Math.min(chunkNum * CHUNK_SIZE, maxPages);
      const pagesInChunk = endPage - startPage + 1;
      
      console.log(`[Scraper] Chunk ${chunkNum}: Pages ${startPage} to ${endPage} (${pagesInChunk} pages)`);
      
      // Fresh tracking for this chunk
      const extractedIds = new Set();
      const chunkComments = [];
      
      // First page of chunk (or page 1 if first chunk)
      if (chunkNum === 1) {
        console.log(`[Scraper] Extracting page ${globalPage} (first page)...`);
        let pageComments = extractCommentsWithTracking(extractedIds);
        console.log(`[Scraper] ✅ Page ${globalPage}: Found ${pageComments.length} NEW comments`);
        chunkComments.push(...pageComments);
        accumulatedAllComments.push(...pageComments);

        chrome.storage.local.set({
          isScraping: true,
          currentPagesLoaded: 1,
          totalPagesRequested: maxPages,
          comments: accumulatedAllComments,
          productName: productTitle,
          statusMessage: `Halaman 1/${maxPages} selesai (${accumulatedAllComments.length} ulasan)`
        });
      }
      
      // Load additional pages in this chunk
      const startLoop = (chunkNum === 1) ? 2 : 1;
      for (let localPage = startLoop; localPage <= pagesInChunk; localPage++) {
        if (isScrapingAborted) {
          console.log('[Scraper] Abort signal received mid-loop!');
          break;
        }

        globalPage++;
        console.log(`\n[Scraper] ========== Page ${globalPage} (Chunk ${chunkNum}, Local ${localPage}) ==========`);
        
        // Find and click next button
        const nextButton = await findAndClickNextButton(globalPage);
        if (!nextButton) {
          console.log(`[Scraper] No more pages available. Stopping at page ${globalPage - 1}`);
          globalPage--;
          break;
        }
        
        // Wait for new comments to load
        console.log(`[Scraper] Waiting 5 seconds for page ${globalPage} to load...`);
        await sleep(5000);
        
        if (isScrapingAborted) break;

        // Scroll to ensure render
        console.log(`[Scraper] Scrolling to ensure all comments are visible...`);
        window.scrollBy({ top: 300, behavior: 'smooth' });
        await sleep(1000);
        window.scrollBy({ top: -100, behavior: 'smooth' });
        await sleep(1000);
        
        // Extract NEW comments
        console.log(`[Scraper] Extracting NEW comments from page ${globalPage}...`);
        let pageComments = extractCommentsWithTracking(extractedIds);
        
        if (pageComments.length > 0) {
          console.log(`[Scraper] ✅ Page ${globalPage}: Found ${pageComments.length} NEW comments`);
          chunkComments.push(...pageComments);
          accumulatedAllComments.push(...pageComments);
        } else {
          console.log(`[Scraper] ⚠️ No new comments found on page ${globalPage}`);
          
          // Retry once
          await sleep(2000);
          pageComments = extractCommentsWithTracking(extractedIds);
          
          if (pageComments.length > 0) {
            console.log(`[Scraper] ✅ Retry successful! Found ${pageComments.length} NEW comments`);
            chunkComments.push(...pageComments);
            accumulatedAllComments.push(...pageComments);
          } else {
            console.log(`[Scraper] No more comments available. Ending chunk ${chunkNum}`);
            break;
          }
        }

        // Update real-time storage progress
        chrome.storage.local.set({
          isScraping: true,
          currentPagesLoaded: globalPage,
          totalPagesRequested: maxPages,
          comments: accumulatedAllComments,
          productName: productTitle,
          statusMessage: `Halaman ${globalPage}/${maxPages} selesai (${accumulatedAllComments.length} ulasan)`
        });
        
        console.log(`[Scraper] Chunk ${chunkNum} progress: ${chunkComments.length} comments, Page ${globalPage}`);
      }
      
      // Chunk complete - save CSV
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[Scraper] 📦 CHUNK ${chunkNum}/${totalChunks} COMPLETE`);
      console.log(`[Scraper] ✅ Collected ${chunkComments.length} comments in this chunk`);
      console.log(`[Scraper] ✅ Pages: ${startPage} to ${globalPage}`);
      console.log(`${'='.repeat(60)}`);
      
      if (chunkComments.length > 0) {
        downloadCSVChunk(chunkComments, chunkNum, totalChunks);
        totalCommentsCollected += chunkComments.length;
        
        allChunkResults.push({
          chunkNumber: chunkNum,
          comments: chunkComments.length,
          pages: `${startPage}-${globalPage}`
        });
      }
      
      // Clear chunk data to free memory
      chunkComments.length = 0;
      extractedIds.clear();
      
      if (globalPage >= maxPages || isScrapingAborted) {
        break;
      }
      
      if (chunkNum < totalChunks) {
        await sleep(3000);
      }
    }
    
    console.log(`[Scraper] Finished. Total collected: ${totalCommentsCollected || accumulatedAllComments.length}`);

    // Update storage upon finish
    chrome.storage.local.set({
      isScraping: false,
      currentPagesLoaded: globalPage,
      totalPagesRequested: maxPages,
      comments: accumulatedAllComments,
      productName: productTitle,
      statusMessage: isScrapingAborted 
        ? `Dihentikan. ${accumulatedAllComments.length} ulasan dari ${globalPage} halaman.`
        : `Selesai! ${accumulatedAllComments.length} ulasan dari ${globalPage} halaman.`
    });
    
    return {
      success: true,
      aborted: isScrapingAborted,
      comments: accumulatedAllComments,
      count: totalCommentsCollected || accumulatedAllComments.length,
      pagesLoaded: globalPage,
      productTitle: productTitle,
      chunks: allChunkResults.length,
      chunkDetails: allChunkResults,
      message: isScrapingAborted 
        ? `Dihentikan. Berhasil mengumpulkan ${accumulatedAllComments.length} komentar dari ${globalPage} halaman.`
        : `Berhasil mengumpulkan ${totalCommentsCollected || accumulatedAllComments.length} komentar dari ${globalPage} halaman.`
    };
  } catch (error) {
    console.error('[Scraper] Error during scraping:', error);
    return {
      success: false,
      error: error.message,
      comments: [],
      count: 0
    };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'scrapeComments') {
    isScrapingAborted = false;
    scrapeComments(request.maxPages || 10).then(result => {
      console.log('Scraping result:', result);
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'stopScraping') {
    isScrapingAborted = true;
    console.log('Content script: Received stopScraping signal');
    sendResponse({ success: true, message: 'Stop signal received' });
    return true;
  }
});
