const host = data.host;

function setup() {
  const microsoftViewerUrl = "https://view.officeapps.live.com/op/embed.aspx";
  const documentsParam = getQueryParameter("documents");
  const indexParam = parseInt(getQueryParameter("index")) || 0;
  // const adobeClientId = "d5c9b76969ff481fb343aabb22d609b0"; // for localhost
  const adobeClientId = "7ef4db68cd074a8391182c8cdbac68bf"; // for apiGW

  // Parse documents array or single document
  let documents = [];
  let currentIndex = 0;
  let isGalleryMode = false;

  if (documentsParam) {
    try {
      // Parse documents parameter as JSON array of objects
      const documentsArray = JSON.parse(decodeURIComponent(documentsParam));
      if (Array.isArray(documentsArray) && documentsArray.length > 0) {
        documents = documentsArray;
        isGalleryMode = documentsArray.length > 1;
      }
    } catch (e) {
      console.error("Failed to parse documents parameter:", e);
    }
  }

  // Ensure we have at least one document - show error if no documents provided
  if (documents.length === 0) {
    documents = [{
      url: "",
      name: "No Document Provided",
      format: "",
    },];
  }

  const iframe = document.getElementById("viewer");
  const plainTextWrapper = document.getElementById("plainTextWrapper");
  const plainTextContainer = document.getElementById("plainTextContainer");
  const adobeViewer = document.getElementById("adobeViewer");
  const loader = document.getElementById("loader");
  const galleryNavPrev = document.getElementById("galleryNavPrev");
  const galleryNavNext = document.getElementById("galleryNavNext");
  const unsupportedFormat = document.getElementById("unsupportedFormat");
  const descriptionDisplay = document.getElementById("descriptionDisplay");
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  let galleryNavPrevHandler = null;
  let galleryNavNextHandler = null;

  let hideNavTimeout;
  let hideFileNameTimeout;
  let currentViewer = null;

  const iframeCache = new Map(); // Key: documentUrl + format, Value: iframe element
  const MAX_CACHED_IFRAMES = 15; // Reasonable limit to prevent memory issues
  let currentCachedIframe = null;

  const hideOverlay = () => {
    const overlay = document.getElementById("iframeMouseOverlay");
    if (overlay) overlay.remove();
  };

  function isFullscreenAllowed() {
    // Check if fullscreen API is available
    const fullscreenEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;

    // For iframe context, we need to check if we can request fullscreen on the parent frame
    if (window.frameElement) {
      return fullscreenEnabled;
    }

    // For direct access (not in iframe), fullscreen should still work
    return fullscreenEnabled;
  }

  function shouldShowFullscreenButton() {
    if (!isFullscreenAllowed()) return false;

    // Don't show fullscreen button for video formats (they have their own)
    const currentFormat = getCurrentFormat().toLowerCase();
    if (currentFormat.startsWith("video/") || currentFormat === "video/youtube") {
      return false;
    }

    return true;
  }

  function updateFullscreenButtonPosition() {
    // Static positioning - always 10px from top-right corner
    document.documentElement.style.setProperty("--fullscreen-btn-right", "10px");
  }

  function toggleFullscreen() {
    const fullscreenEnabled = document.documentElement && (document.fullscreenEnabled || document.webkitFullscreenEnabled);

    if (!fullscreenEnabled) {
      console.log('Fullscreen is not allowed for this iframe');
      return;
    }

    const isCurrentlyFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (isCurrentlyFullscreen) {
      const exitFullscreenFn = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFullscreenFn) exitFullscreenFn.call(document);
    } else {
      const requestFullscreenFn = document.documentElement?.requestFullscreen || document.documentElement?.webkitRequestFullscreen;
      requestFullscreenFn.call(document.documentElement);
    }
  }

  const showOverlay = () => {
    const rect = iframe.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    if (document.getElementById("iframeMouseOverlay")) return;

    const container = iframe.parentElement;
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    const overlay = document.createElement("div");
    overlay.id = "iframeMouseOverlay";
    overlay.className = "iframe-mouse-overlay";
    container.appendChild(overlay);

    const pickTarget = (x, y) => {
      overlay.style.pointerEvents = "none";
      const el = document.elementFromPoint(x, y);
      overlay.style.pointerEvents = "auto";
      return el;
    };

    const forwardMouseEvent = (e, type) => {
      const target = pickTarget(e.clientX, e.clientY);
      if (!target) return;
      const init = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        button: e.button,
        buttons: e.buttons,
      };
      target.dispatchEvent(new MouseEvent(type, init));
    };

    const forwardWheelEvent = (e) => {
      const target = pickTarget(e.clientX, e.clientY);
      if (!target) return;
      const init = {
        bubbles: true,
        cancelable: true,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
      };
      target.dispatchEvent(new WheelEvent("wheel", init));
    };

    const forwardTouchEvent = (e) => {
      const t = e.changedTouches[0];
      const target = pickTarget(t.clientX, t.clientY);
      if (!target) return;
      const touchEvent = new TouchEvent(e.type, {
        bubbles: true,
        cancelable: true,
        touches: e.touches,
        targetTouches: e.targetTouches,
        changedTouches: e.changedTouches,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
      target.dispatchEvent(touchEvent);
    };

    const eventMap = {
      mousemove: (e) => {
        showNavButtons(e);
        forwardMouseEvent(e, "mousemove");
      },
      touchstart: (e) => {
        showNavButtons(e);
        forwardTouchEvent(e);
      },
      click: (e) => {
        showNavButtons(e);
        forwardMouseEvent(e, "click");
      },
      mousedown: (e) => {
        showNavButtons(e);
        forwardMouseEvent(e, "mousedown");
      },
      mouseup: (e) => {
        showNavButtons(e);
        forwardMouseEvent(e, "mouseup");
      },
      dblclick: (e) => {
        showNavButtons(e);
        forwardMouseEvent(e, "dblclick");
      },
      contextmenu: (e) => {
        showNavButtons(e);
        forwardMouseEvent(e, "contextmenu");
      },
      wheel: (e) => {
        showNavButtons(e);
        forwardWheelEvent(e);
      },
      touchmove: (e) => {
        showNavButtons(e);
        forwardTouchEvent(e);
      },
      touchend: (e) => {
        showNavButtons(e);
        forwardTouchEvent(e);
      },
    };

    Object.entries(eventMap).forEach(([type, handler]) => {
      overlay.addEventListener(type, handler, {
        passive: false
      });
    });
  };

  function validateUrl(url) {
    try {
      // Allow relative paths (don't start with protocol)
      if (!url.includes("://")) {
        return true;
      }

      // For absolute URLs, validate protocol
      const urlObj = new URL(url);
      const allowedProtocols = ["http:", "https:", "file:", "data:"];
      if (!urlObj.protocol || !allowedProtocols.includes(urlObj.protocol)) {
        throw new Error("Недопустимый протокол");
      }
      return true;
    } catch (e) {
      console.error("Невалидный URL:", e);
      return false;
    }
  }

  // Initialize fullscreen button and event listeners early so they work even with no initial documents
  document.addEventListener("DOMContentLoaded", () => {
    // Only setup fullscreen button if we have documents
    if (documents.length > 0) {
      setupFullscreenButton();
      updateFullscreenButtonPosition();
    }
  });

  // Update fullscreen button position on window resize
  window.addEventListener("resize", updateFullscreenButtonPosition);

  // Helper functions for empty state handling
  function hideAllViewers() {
    // Use cleanupCurrentViewer to properly cleanup all viewers including ViewerJS
    cleanupCurrentViewer();
  }

  function hideNavButtons() {
    const galleryNavPrev = document.getElementById("galleryNavPrev");
    const galleryNavNext = document.getElementById("galleryNavNext");
    if (galleryNavPrev) galleryNavPrev.classList.add("hidden");
    if (galleryNavNext) galleryNavNext.classList.add("hidden");
  }

  function hideFileName() {
    const descriptionDisplay = document.getElementById("descriptionDisplay");
    if (descriptionDisplay) descriptionDisplay.classList.add("hidden");
  }

  function hideFullscreenButton() {
    const fullscreenBtn = document.getElementById("fullscreenBtn");
    if (fullscreenBtn) fullscreenBtn.classList.add("hidden");
  }

  // PostMessage support for updating documents - initialize early so it works even with no initial documents
  window.addEventListener("message", function (event) {
    const value = event.data.id ? event.data.value : event.data;
    const { type, payload } = value;
    if (type === "updateDocuments") {
      const newDocuments = payload.documents;
      let newIndex = payload.index;

      if (Array.isArray(newDocuments) && newDocuments.length > 0) {
        // If no index provided, try to preserve current document if URL hasn't changed
        if (newIndex === undefined && documents.length > 0 && currentIndex >= 0 && currentIndex < documents.length) {
          const currentDocumentUrl = documents[currentIndex].url;
          const sameDocumentIndex = newDocuments.findIndex((doc) => doc.url === currentDocumentUrl);
          if (sameDocumentIndex >= 0) {
            newIndex = sameDocumentIndex;
            console.log("Preserving current document at new index:", newIndex, "URL:", currentDocumentUrl);
          } else {
            newIndex = 0;
          }
        } else if (newIndex === undefined) {
          newIndex = 0;
        }

        cleanupCachedIframes();

        documents.length = 0;
        documents.push(...newDocuments);
        isGalleryMode = newDocuments.length > 1;

        // Update current index
        currentIndex = Math.max(0, Math.min(newIndex, documents.length - 1));

        // Update URL with new documents and index
        const documentsParam = encodeURIComponent(JSON.stringify(documents));
        const newUrl = `${window.location.pathname}?documents=${documentsParam}&index=${currentIndex}`;
        window.history.replaceState({}, "", newUrl);

        // Hide loader and initialize document viewer with new data
        hideLoader();
        setupGalleryNavigation();
        loadDocument(currentIndex);
        showFileName();
        updateFullscreenButtonPosition();

        console.log("Documents updated via postMessage:", documents.length, "documents, index:", currentIndex);
        // console.log("Document array after update:", documents);
      } else if (Array.isArray(newDocuments) && newDocuments.length === 0) {
        // Handle empty array - clear everything
        cleanupCachedIframes();

        documents.length = 0;
        isGalleryMode = false;
        currentIndex = -1;

        // Clear URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);

        // Hide all UI elements
        hideAllViewers();
        hideNavButtons();
        hideFileName();
        hideFullscreenButton();

        console.log("Documents cleared via postMessage - showing empty state");
      }
    } else if (type === "selectDocument") {
      // Handle document selection by url or index
      const {
        url,
        index
      } = payload;
      let targetIndex = -1;

      if (typeof index === "number" && index >= 0 && index < documents.length) {
        // Select by index
        targetIndex = index;
        console.log("Selecting document by index:", index);
      } else if (url) {
        // Select by URL
        targetIndex = documents.findIndex((doc) => doc.url === url);
        console.log("Selecting document by URL:", url, "found at index:", targetIndex);
      }

      if (targetIndex >= 0 && targetIndex < documents.length) {
        currentIndex = targetIndex;

        // Update URL with new index
        const documentsParam = encodeURIComponent(JSON.stringify(documents));
        const newUrl = `${window.location.pathname}?documents=${documentsParam}&index=${currentIndex}`;
        window.history.replaceState({}, "", newUrl);

        // Load the selected document
        loadDocument(currentIndex);
        showFileName();
        updateNavButtonVisibility();

        console.log("Document selected successfully, new index:", currentIndex);
      } else {
        console.warn("Document not found for selection criteria:", {
          url,
          index
        });
      }
    }
  });

  if (!documents.length || !documents[0] || !documents[0].url) {
    console.log("No document URL provided.");
    hideLoader();
    return;
  }

  if (!validateUrl(documents[0].url)) {
    console.error("Недопустимый URL");
    hideLoader();
    return;
  }

  function showNavButtons() {
    hideOverlay();

    // Update fullscreen button position based on scrollbar presence
    updateFullscreenButtonPosition();

    // Show fullscreen button if allowed and not video format (always show, even for single files)
    if (shouldShowFullscreenButton()) {
      fullscreenBtn.classList.remove("fade-out");
    }

    // Show navigation buttons only in gallery mode
    if (isGalleryMode) {
      if (currentIndex === 0) {
        galleryNavPrev.classList.add("fade-out");
      } else {
        galleryNavPrev.classList.remove("fade-out");
      }

      if (currentIndex === documents.length - 1) {
        galleryNavNext.classList.add("fade-out");
      } else {
        galleryNavNext.classList.remove("fade-out");
      }
    }

    clearTimeout(hideNavTimeout);
    hideNavTimeout = setTimeout(() => {
      if (isGalleryMode) {
        galleryNavPrev.classList.add("fade-out");
        galleryNavNext.classList.add("fade-out");
      }
      if (shouldShowFullscreenButton()) {
        fullscreenBtn.classList.add("fade-out");
      }
      showOverlay();
    }, 2000);
  }

  function hideNavButtons() {
    clearTimeout(hideNavTimeout);
    if (isGalleryMode) {
      galleryNavPrev.classList.add("fade-out");
      galleryNavNext.classList.add("fade-out");
    }
    if (shouldShowFullscreenButton()) {
      fullscreenBtn.classList.add("fade-out");
    }
    showOverlay();
  }

  function updateUrlWithIndex(index) {
    try {
      const url = new URL(window.location);
      url.searchParams.set("index", index);
      const urlString = url.toString();

      history.replaceState(null, "", urlString);
    } catch (error) {
      console.log("Failed to update URL:", error.message);
      // Continue without updating URL - functionality still works
    }
  }

  function showFileName() {
    const currentDoc = documents[currentIndex];
    if (!currentDoc) return;

    let description = currentDoc.description;
    if (!description || description.trim() === "" || description === "Document") {
      description = `Документ №${currentIndex + 1}`;
    }

    descriptionDisplay.textContent = description;
    descriptionDisplay.classList.remove("hidden", "fade-out");

    clearTimeout(hideFileNameTimeout);
    hideFileNameTimeout = setTimeout(() => {
      descriptionDisplay.classList.add("fade-out");
      setTimeout(() => {
        descriptionDisplay.classList.add("hidden");
      }, 300);
    }, 5000);
  }

  function setupGalleryNavigation() {
    if (!isGalleryMode) {
      galleryNavPrev.classList.add("hidden");
      galleryNavNext.classList.add("hidden");

      if (galleryNavPrevHandler) {
        galleryNavPrev.removeEventListener("click", galleryNavPrevHandler);
        galleryNavPrevHandler = null;
      }
      if (galleryNavNextHandler) {
        galleryNavNext.removeEventListener("click", galleryNavNextHandler);
        galleryNavNextHandler = null;
      }
    } else {
      galleryNavPrev.classList.remove("hidden");
      galleryNavNext.classList.remove("hidden");

      if (galleryNavPrevHandler) {
        galleryNavPrev.removeEventListener("click", galleryNavPrevHandler);
      }
      if (galleryNavNextHandler) {
        galleryNavNext.removeEventListener("click", galleryNavNextHandler);
      }

      galleryNavPrevHandler = () => {
        if (currentIndex > 0) {
          currentIndex--;
          loadDocument(currentIndex);
          updateUrlWithIndex(currentIndex);
          showNavButtons();
          showFileName();
        }
      };

      galleryNavNextHandler = () => {
        if (currentIndex < documents.length - 1) {
          currentIndex++;
          loadDocument(currentIndex);
          updateUrlWithIndex(currentIndex);
          showNavButtons();
          showFileName();
        }
      };

      galleryNavPrev.addEventListener("click", galleryNavPrevHandler);
      galleryNavNext.addEventListener("click", galleryNavNextHandler);

      updateNavButtonVisibility();
    }

    document.body.addEventListener("mousemove", showNavButtons);
    document.body.addEventListener("touchstart", showNavButtons);
  }

  function setupFullscreenButton() {
    // Setup fullscreen button (called after document loads to check format)
    if (shouldShowFullscreenButton()) {
      fullscreenBtn.classList.remove("hidden");
      fullscreenBtn.addEventListener("click", toggleFullscreen);
    } else {
      fullscreenBtn.classList.add("hidden");
    }
  }

  function updateNavButtonVisibility() {
    if (!isGalleryMode) return;

    if (currentIndex === 0) {
      galleryNavPrev.classList.add("fade-out");
    } else {
      galleryNavPrev.classList.remove("fade-out");
    }

    if (currentIndex === documents.length - 1) {
      galleryNavNext.classList.add("fade-out");
    } else {
      galleryNavNext.classList.remove("fade-out");
    }
  }

  function getCurrentDocument() {
    return documents[currentIndex] ? documents[currentIndex].url : "";
  }

  function detectFormatFromUrl(url) {
    if (!url) return "";

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      if (hostname === "www.youtube.com" || hostname === "youtube.com" || hostname === "m.youtube.com") {
        if (pathname.includes("/watch") || pathname.includes("/shorts") || pathname.includes("/embed") || pathname.includes("/v/")) {
          return "video/youtube";
        }
      }

      if (hostname === "youtu.be") {
        return "video/youtube";
      }

      if (hostname === "docs.google.com") {
        if (pathname.includes("/document") || pathname.includes("/d/")) {
          return "application/google-docs";
        }
      }

      if (hostname === "sheets.google.com") {
        if (pathname.includes("/spreadsheets") || pathname.includes("/d/")) {
          return "application/google-sheets";
        }
      }

      if (hostname === "slides.google.com") {
        if (pathname.includes("/presentation") || pathname.includes("/d/")) {
          return "application/google-slides";
        }
      }

      if (hostname === "drive.google.com") {
        if (pathname.includes("/file/d/")) {
          return "application/google-drive";
        }
      }

      return "";
    } catch (error) {
      console.error("Error detecting format from URL:", error);
      return "";
    }
  }

  function getCurrentFormat() {
    if (!documents[currentIndex]) return "";

    const explicitFormat = documents[currentIndex].format;
    if (explicitFormat) {
      return explicitFormat;
    }

    const url = documents[currentIndex].url;
    const detectedFormat = detectFormatFromUrl(url);

    if (detectedFormat) {
      console.log(`Auto-detected format: ${detectedFormat} for URL: ${url}`);
      return detectedFormat;
    }

    return "";
  }

  function cleanupCurrentViewer() {
    iframe.classList.add("hidden");
    plainTextWrapper.classList.add("hidden");
    adobeViewer.classList.add("hidden");
    unsupportedFormat.classList.add("hidden");
    document.getElementById("imageViewer").classList.add("hidden");

    if (currentCachedIframe) {
      currentCachedIframe.classList.add("hidden");
      currentCachedIframe.style.display = 'none';
    }

    iframe.classList.remove("microsoft-viewer-fix");
    iframe.src = "";
    plainTextContainer.innerText = "";

    const existingVideo = document.getElementById("videoPlayer");
    if (existingVideo) {
      existingVideo.remove();
    }

    if (currentViewer && currentViewer.destroy) {
      currentViewer.destroy();
    }
    currentViewer = null;
  }

  function hideLoader() {
    loader.classList.toggle("hidden", true);
  }

  function getQueryParameter(param) {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
  }

  function showUnsupportedFormat() {
    unsupportedFormat.classList.remove("hidden");
    hideLoader();
  }

  function showAsLinkMode(documentUrl, description) {
    cleanupCurrentViewer();
    hideLoader();
    
    const descriptionDisplay = document.getElementById("descriptionDisplay");
    if (!descriptionDisplay) {
      return;
    }
    
    // Handle case where documentUrl might be empty
    if (!documentUrl) {
      descriptionDisplay.innerHTML = `
        <div class="description-text">${description}</div>
        <div style="color: red; font-size: 12px;">Ошибка: URL документа не найден</div>
      `;
    } else {
      descriptionDisplay.innerHTML = `
        <div class="description-text">${description}</div>
        <button class="open-link-btn" onclick="window.open(${JSON.stringify(documentUrl)}, '_blank')">
          Відкрити посилання
        </button>
      `;
    }
    descriptionDisplay.classList.remove("hidden", "fade-out");
  }

  function getCacheKey(documentUrl, format) {
    return `${format}:${documentUrl}`;
  }

  function getOrCreateCachedIframe(documentUrl, format) {
    const cacheKey = getCacheKey(documentUrl, format);

    if (iframeCache.has(cacheKey)) {
      console.log('Using cached iframe for:', cacheKey);
      return iframeCache.get(cacheKey);
    }

    const newIframe = document.createElement('iframe');
    newIframe.className = 'viewer-iframe';
    newIframe.frameBorder = '0';
    newIframe.allowFullscreen = true;
    newIframe.setAttribute('mozallowfullscreen', 'true');
    newIframe.setAttribute('webkitallowfullscreen', 'true');
    newIframe.style.display = 'none'; // Start hidden

    document.body.appendChild(newIframe);

    if (iframeCache.size >= MAX_CACHED_IFRAMES) {
      const oldestKey = iframeCache.keys().next().value;
      const oldestIframe = iframeCache.get(oldestKey);
      if (oldestIframe && oldestIframe.parentNode) {
        oldestIframe.parentNode.removeChild(oldestIframe);
      }
      iframeCache.delete(oldestKey);
      console.log('Removed oldest cached iframe:', oldestKey);
    }

    iframeCache.set(cacheKey, newIframe);
    console.log('Created and cached new iframe for:', cacheKey);

    return newIframe;
  }

  function showCachedIframe(targetIframe) {
    if (currentCachedIframe && currentCachedIframe !== targetIframe) {
      currentCachedIframe.style.display = 'none';
      currentCachedIframe.classList.add('hidden');
    }

    iframe.classList.add('hidden');
    iframe.style.display = 'none';

    targetIframe.style.display = 'block';
    targetIframe.classList.remove('hidden');
    currentCachedIframe = targetIframe;
  }

  function cleanupCachedIframes() {
    iframeCache.forEach((cachedIframe, key) => {
      if (cachedIframe && cachedIframe.parentNode) {
        cachedIframe.parentNode.removeChild(cachedIframe);
      }
    });
    iframeCache.clear();
    currentCachedIframe = null;
    console.log('Cleaned up all cached iframes');
  }

  async function fetchBinaryData(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error("Error fetching binary data:", error);
      throw error;
    }
  }

  function detectEncoding(uint8Array) {
    // Проверка BOM
    if (uint8Array.length >= 3 && uint8Array[0] === 0xef && uint8Array[1] === 0xbb && uint8Array[2] === 0xbf) {
      return "utf-8";
    }
    if (uint8Array.length >= 2 && uint8Array[0] === 0xff && uint8Array[1] === 0xfe) return "utf-16le";
    if (uint8Array.length >= 2 && uint8Array[0] === 0xfe && uint8Array[1] === 0xff) return "utf-16be";

    // Анализ частотности для кириллицы
    let cp1251Score = 0,
      cp866Score = 0;
    const sampleSize = Math.min(uint8Array.length, 1000);

    for (let i = 0; i < sampleSize; i++) {
      const byte = uint8Array[i];
      // CP1251: А-Я (0xC0-0xDF), а-я (0xE0-0xFF)
      if ((byte >= 0xc0 && byte <= 0xdf) || (byte >= 0xe0 && byte <= 0xff)) cp1251Score++;
      // CP866: А-П (0x80-0x8F), Р-Я (0x90-0x9F), а-п (0xA0-0xAF), р-я (0xE0-0xEF)
      if ((byte >= 0x80 && byte <= 0xaf) || (byte >= 0xe0 && byte <= 0xef)) cp866Score++;
    }

    return cp1251Score > cp866Score ? "windows-1251" : "ibm866";
  }

  function decodeBinaryData(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);

    try {
      const utf8Decoder = new TextDecoder("utf-8", {
        fatal: true,
      });
      const utf8Decoded = utf8Decoder.decode(uint8Array);
      console.log("Text successfully decoded as UTF-8");
      return utf8Decoded;
    } catch (e) {
      console.log("Failed to decode as UTF-8, trying other encodings");
    }

    const encoding = detectEncoding(uint8Array);
    const decoder = new TextDecoder(encoding);
    const decoded = decoder.decode(uint8Array);
    console.log(`Text successfully decoded as ${encoding === "ibm866" ? "OEM" : encoding}`);
    return decoded;
  }

  function isBrowserHasPDFViewer() {
    // Modern borwsers
    if (navigator.pdfViewerEnabled !== undefined) {
      return navigator.pdfViewerEnabled;
    }

    // Old browsers or not compatible with pdfViewerEnabled like Safari
    let hasPDFViewer = false;
    try {
      var hasPluginEnabled = navigator.mimeTypes && navigator.mimeTypes["application/pdf"] ? navigator.mimeTypes["application/pdf"].enabledPlugin : null;
      if (hasPluginEnabled) {
        hasPDFViewer = true;
      }
    } catch (e) {
      hasPDFViewer = false;
    }

    return hasPDFViewer;
  }

  function loadAdobeSdk() {
    return new Promise((resolve, reject) => {
      if (document.getElementById("adobe-sdk-script")) {
        resolve(); // SDK already loaded
        return;
      }

      const script = document.createElement("script");
      script.id = "adobe-sdk-script";
      script.src = "https://acrobatservices.adobe.com/view-sdk/viewer.js";
      script.type = "text/javascript";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Adobe SDK script"));

      document.head.appendChild(script);
    });
  }

  function setupViewerJs(documentUrl) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.11.6/viewer.min.css";
    if (!document.querySelector('link[href*="viewerjs"]')) {
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.11.6/viewer.min.js";

    script.onload = function () {
      const imageElement = document.getElementById("imageViewer");
      imageElement.src = documentUrl;

      currentViewer = new Viewer(imageElement, {
        inline: true,
        fullscreen: true,
        backdrop: false,
        button: false,
        navbar: false,
        title: false,
        toolbar: {
          zoomIn: true,
          zoomOut: true,
          oneToOne: true,
          reset: true,
          rotateLeft: true,
          rotateRight: true,
        },
        zoomRatio: 0.4,
      });

      hideLoader();
    };

    if (!document.querySelector('script[src*="viewerjs"]')) {
      document.body.appendChild(script);
    } else {
      script.onload();
    }
  }

  function setupAdobeViewer(documentUrl) {
    document.addEventListener("adobe_dc_view_sdk.ready", function () {
      var adobeDCView = new AdobeDC.View({
        clientId: adobeClientId,
        divId: "adobeViewer",
      });
      adobeDCView
        .previewFile({
          content: {
            location: {
              url: documentUrl,
            },
          },
          metaData: {
            fileName: "PDF Document",
          },
        })
        .then(hideLoader);
    });
    iframe.classList.toggle("hidden", true);
    adobeViewer.classList.toggle("hidden", false);
  }

  function convertToYouTubeEmbedUrl(url, autoplay = false, controls = true) {
    try {
      const urlObj = new URL(url);
      let videoId = "";
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname;

      if (hostname === "www.youtube.com" || hostname === "youtube.com" || hostname === "m.youtube.com") {
        if (pathname.includes("/watch")) {
          videoId = urlObj.searchParams.get("v");
        } else if (pathname.includes("/shorts/")) {
          videoId = pathname.split("/shorts/")[1]?.split("?")[0];
        } else if (pathname.includes("/embed/")) {
          videoId = pathname.split("/embed/")[1]?.split("?")[0];
        } else if (pathname.includes("/v/")) {
          videoId = pathname.split("/v/")[1]?.split("?")[0];
        }
      } else if (hostname === "youtu.be") {
        videoId = pathname.slice(1).split("?")[0];
      }

      if (!videoId) {
        throw new Error("Invalid YouTube URL - could not extract video ID");
      }

      const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
      if (autoplay) embedUrl.searchParams.set("autoplay", "1");
      if (!controls) embedUrl.searchParams.set("controls", "0");
      embedUrl.searchParams.set("rel", "0");

      return embedUrl.toString();
    } catch (error) {
      console.error("Error converting YouTube URL:", error);
      return null;
    }
  }

  function setupYouTubeViewer(documentUrl) {
    const currentDoc = documents[currentIndex];
    const autoplay = currentDoc.autoplay || false;
    const controls = currentDoc.controls !== false; // default to true

    const embedUrl = convertToYouTubeEmbedUrl(documentUrl, autoplay, controls);

    if (!embedUrl) {
      showUnsupportedFormat();
      return;
    }

    const cachedIframe = getOrCreateCachedIframe(documentUrl, 'video/youtube');

    // Only set src if it's different (avoid reloading)
    if (cachedIframe.src !== embedUrl) {
      cachedIframe.src = embedUrl;
      cachedIframe.addEventListener("load", hideLoader, {
        once: true,
      });
    } else {
      hideLoader();
    }

    showCachedIframe(cachedIframe);
  }

  function setupGoogleDocsViewer(documentUrl) {
    const currentDoc = documents[currentIndex];
    let embedUrl = documentUrl;

    try {
      const urlObj = new URL(embedUrl);
      if (currentDoc.readonly !== undefined) {
        urlObj.searchParams.set("rm", currentDoc.readonly ? "minimal" : "full");
      }
      if (currentDoc.rm) {
        urlObj.searchParams.set("rm", currentDoc.rm);
      }
      embedUrl = urlObj.toString();
    } catch (error) {
      console.error("Error processing Google Docs URL:", error);
    }

    const format = getCurrentFormat();
    const cachedIframe = getOrCreateCachedIframe(documentUrl, format);

    // Only set src if it's different (avoid reloading)
    if (cachedIframe.src !== embedUrl) {
      cachedIframe.src = embedUrl;
      cachedIframe.addEventListener("load", hideLoader, {
        once: true,
      });
    } else {
      hideLoader();
    }

    showCachedIframe(cachedIframe);
  }

  function setupVideoViewer(documentUrl) {
    const currentDoc = documents[currentIndex];
    const autoplay = currentDoc.autoplay || false;
    const controls = currentDoc.controls !== false;
    const loop = currentDoc.loop || false;

    cleanupCurrentViewer();

    const videoElement = document.createElement("video");
    videoElement.id = "videoPlayer";
    videoElement.className = "viewer-iframe";
    videoElement.src = documentUrl;
    videoElement.controls = controls;
    videoElement.autoplay = autoplay;
    videoElement.loop = loop;
    videoElement.style.width = "100%";
    videoElement.style.height = "100%";
    videoElement.style.objectFit = "contain";

    iframe.classList.add("hidden");
    document.body.appendChild(videoElement);

    videoElement.addEventListener("loadeddata", hideLoader, {
      once: true,
    });

    videoElement.addEventListener("error", () => {
      console.error("Error loading video:", documentUrl);
      showUnsupportedFormat();
    });
  }

  function loadDocument(index) {
    if (index < 0 || index >= documents.length) return;

    currentIndex = index;
    const documentUrl = getCurrentDocument();
    const currentDoc = documents[currentIndex];

    // Check if document should be shown as link only
    if (currentDoc && currentDoc.showAsLink) {
      const description = currentDoc.description || `Документ №${currentIndex + 1}`;
      showAsLinkMode(documentUrl, description);
      updateNavButtonVisibility();
      setupFullscreenButton();
      return;
    }

    const format = getCurrentFormat();

    if (!validateUrl(documentUrl)) {
      console.error("Недопустимый URL:", documentUrl);
      return;
    }

    cleanupCurrentViewer();
    loader.classList.remove("hidden");

    switch (format) {
      case "text/plain":
        iframe.classList.add("hidden");
        plainTextWrapper.classList.remove("hidden");
        console.log("fetching", documentUrl);
        fetchBinaryData(documentUrl).then((arrayBuffer) => {
          const text = decodeBinaryData(arrayBuffer);
          plainTextContainer.innerText = text;
          hideLoader();
        });
        break;
      case "application/msword":
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/vnd.oasis.opendocument.text":
      case "application/vnd.ms-excel":
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        const officeUrl = `${microsoftViewerUrl}?src=${encodeURIComponent(documentUrl)}`;
        const officeCachedIframe = getOrCreateCachedIframe(documentUrl, format);
        officeCachedIframe.classList.add("microsoft-viewer-fix");

        if (officeCachedIframe.src !== officeUrl) {
          officeCachedIframe.src = officeUrl;
          officeCachedIframe.addEventListener("load", hideLoader, {
            once: true,
          });
        } else {
          hideLoader();
        }

        showCachedIframe(officeCachedIframe);
        break;
      case "application/pdf":
        if (isBrowserHasPDFViewer()) {
          const pdfCachedIframe = getOrCreateCachedIframe(documentUrl, format);

          if (pdfCachedIframe.src !== documentUrl) {
            pdfCachedIframe.src = documentUrl;
            pdfCachedIframe.addEventListener("load", hideLoader, {
              once: true,
            });
          } else {
            hideLoader();
          }

          showCachedIframe(pdfCachedIframe);
          break;
        }
        loadAdobeSdk()
          .then(() => setupAdobeViewer(documentUrl))
          .catch((error) => {
            console.error("Error loading Adobe SDK: ", error);
          });
        break;
      case "image/gif":
      case "image/jpg":
      case "image/jpeg":
      case "image/png":
      case "image/svg+xml":
      case "image/bmp":
      case "image/webp":
        setupViewerJs(documentUrl);
        break;
      case "video/youtube":
        setupYouTubeViewer(documentUrl);
        break;
      case "video/mp4":
      case "video/webm":
      case "video/ogg":
      case "video/avi":
      case "video/mov":
      case "video/wmv":
      case "video/x-matroska":
        setupVideoViewer(documentUrl);
        break;
      case "application/google-docs":
      case "application/google-sheets":
      case "application/google-slides":
      case "application/google-drive":
        setupGoogleDocsViewer(documentUrl);
        break;
      case "text/html":
      case "application/xhtml+xml":
        const htmlCachedIframe = getOrCreateCachedIframe(documentUrl, format);

        if (htmlCachedIframe.src !== documentUrl) {
          htmlCachedIframe.src = documentUrl;
          htmlCachedIframe.addEventListener("load", hideLoader, {
            once: true,
          });
        } else {
          hideLoader();
        }

        showCachedIframe(htmlCachedIframe);
        break;
      default:
        showUnsupportedFormat();
    }

    // Update navigation button visibility after loading
    updateNavButtonVisibility();

    // Setup fullscreen button based on current document format
    setupFullscreenButton();
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Only proceed with document loading if we have valid documents
    if (documents.length > 0 && documents[0] && documents[0].url) {
      // Validate and set initial index
      const initialIndex = Math.max(0, Math.min(indexParam, documents.length - 1));
      currentIndex = initialIndex;

      setupGalleryNavigation();
      loadDocument(currentIndex);
      showFileName();
    }
  });

}

const javaScript = `(${setup.toString()})();`;

data.javaScript = javaScript;
