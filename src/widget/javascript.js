const documents = data.__request.query_params?.documents || [];
const config = data.__request.query_params?.config || {};





function script(documents, config) {
  class DocumentViewer {
    constructor(documents, config = {}) {
      this.config = config;
      this.showDescriptionEnabled = this.config.showDescription || false;
      this.microsoftViewerUrl = this.config.microsoftViewerUrl || "https://view.officeapps.live.com/op/embed.aspx";
      this.audioPlayerUrl = this.config.audioPlayerUrl || "https://r8zm973ets.apigw.corezoid.com/widgets/audio-player";
      // this.adobeClientId = this.config.adobeClientId || "d5c9b76969ff481fb343aabb22d609b0"; // for localhost
      this.adobeClientId = this.config.adobeClientId || "7ef4db68cd074a8391182c8cdbac68bf"; // for apiGW

      // Parse documents array or single document
      this.documents = documents || [];
      this.isGalleryMode = this.documents.length > 1;

      this.iframe = document.getElementById("viewer");
      this.plainTextWrapper = document.getElementById("plainTextWrapper");
      this.plainTextContainer = document.getElementById("plainTextContainer");
      this.adobeViewer = document.getElementById("adobeViewer");
      this.loader = document.getElementById("loader");
      this.galleryNavPrev = document.getElementById("galleryNavPrev");
      this.galleryNavNext = document.getElementById("galleryNavNext");
      this.unsupportedFormat = document.getElementById("unsupportedFormat");
      this.descriptionDisplay = document.getElementById("descriptionDisplay");
      this.fullscreenBtn = document.getElementById("fullscreenBtn");
      this.toggleDescriptionBtn = document.getElementById("toggleDescriptionBtn");
      this.controlButtonsContainer = document.getElementById("controlButtonsContainer");

      this.galleryNavPrevHandler = null;
      this.galleryNavNextHandler = null;

      this.hideNavTimeout = null;
      this.hideFileNameTimeout = null;
      this.currentViewer = null;

      this.iframeCache = new Map(); // Key: documentUrl + format, Value: iframe element
      this.maxCachedIframes = this.config.maxCachedIframes || 20; // Reasonable limit to prevent memory issues
      this.currentCachedIframe = null;
    }

    hideOverlay() {
      const overlay = document.getElementById("iframeMouseOverlay");
      if (overlay) overlay.remove();
    }

    isFullscreenAllowed() {
      // Check if fullscreen API is available
      const fullscreenEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;

      // For iframe context, we need to check if we can request fullscreen on the parent frame
      if (window.frameElement) {
        return fullscreenEnabled;
      }

      // For direct access (not in iframe), fullscreen should still work
      return fullscreenEnabled;
    }

    shouldShowFullscreenButton() {
      if (!this.isFullscreenAllowed()) return false;

      // Don't show fullscreen button for video formats (they have their own)
      const currentFormat = this.getCurrentFormat().toLowerCase();
      if (currentFormat.startsWith("video/") || currentFormat === "video/youtube") {
        return false;
      }

      return true;
    }

    updateFullscreenButtonPosition() {
      // Static positioning - always 10px from top-right corner
      document.documentElement.style.setProperty("--fullscreen-btn-right", "10px");
    }

    toggleFullscreen() {
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

    showOverlay() {
      const rect = (this.currentCachedIframe || this.iframe).getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      if (document.getElementById("iframeMouseOverlay")) return;

      const container = (this.currentCachedIframe || this.iframe).parentElement;
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
          this.showNavButtons(e);
          forwardMouseEvent(e, "mousemove");
        },
        touchstart: (e) => {
          this.showNavButtons(e);
          forwardTouchEvent(e);
        },
        click: (e) => {
          this.showNavButtons(e);
          forwardMouseEvent(e, "click");
        },
        mousedown: (e) => {
          this.showNavButtons(e);
          forwardMouseEvent(e, "mousedown");
        },
        mouseup: (e) => {
          this.showNavButtons(e);
          forwardMouseEvent(e, "mouseup");
        },
        dblclick: (e) => {
          this.showNavButtons(e);
          forwardMouseEvent(e, "dblclick");
        },
        contextmenu: (e) => {
          this.showNavButtons(e);
          forwardMouseEvent(e, "contextmenu");
        },
        wheel: (e) => {
          this.showNavButtons(e);
          forwardWheelEvent(e);
        },
        touchmove: (e) => {
          this.showNavButtons(e);
          forwardTouchEvent(e);
        },
        touchend: (e) => {
          this.showNavButtons(e);
          forwardTouchEvent(e);
        },
      };

      Object.entries(eventMap).forEach(([type, handler]) => {
        overlay.addEventListener(type, handler, {
          passive: false
        });
      });
    };

    validateUrl(url) {
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

    initializeEventListeners() {
      // Initialize fullscreen button and event listeners early so they work even with no initial documents
      document.addEventListener("DOMContentLoaded", () => {
        // Only setup fullscreen button if we have documents
        if (this.documents.length > 0) {
          this.setupFullscreenButton();
          this.updateFullscreenButtonPosition();
        }
      });

      // Update fullscreen button position on window resize
      window.addEventListener("resize", () => this.updateFullscreenButtonPosition());
    }

    // Helper functions for empty state handling
    hideAllViewers() {
      // Use cleanupCurrentViewer to properly cleanup all viewers including ViewerJS
      this.cleanupCurrentViewer();
    }

    hideNavButtons() {
      if (this.galleryNavPrev) this.galleryNavPrev.classList.add("hidden");
      if (this.galleryNavNext) this.galleryNavNext.classList.add("hidden");
    }

    hideFileName() {
      const descriptionDisplay = document.getElementById("descriptionDisplay");
      if (descriptionDisplay) descriptionDisplay.classList.add("hidden");
    }

    hideFullscreenButton() {
      if (this.fullscreenBtn) this.fullscreenBtn.classList.add("hidden");
    }

    initializePostMessageListener() {
      // PostMessage support for updating documents - initialize early so it works even with no initial documents
      window.addEventListener("message", (event) => {
        const value = event.data.id ? event.data.value : event.data;
        const { type, payload } = value;
        if (type === "updateDocuments") {
          const newDocuments = payload.documents;
          let newIndex = payload.index;

          if (Array.isArray(newDocuments) && newDocuments.length > 0) {
            // If no index provided, try to preserve current document if URL hasn't changed
            if (newIndex === undefined && this.documents.length > 0 && this.currentIndex >= 0 && this.currentIndex < this.documents.length) {
              const currentDocumentUrl = this.documents[this.currentIndex].url;
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

            this.cleanupCachedIframes();

            this.documents.length = 0;
            this.documents.push(...newDocuments);
            this.isGalleryMode = newDocuments.length > 1;

            // Update current index
            this.currentIndex = Math.max(0, Math.min(newIndex, this.documents.length - 1));

            // Hide loader and initialize document viewer with new data
            this.hideLoader();
            this.setupGalleryNavigation();
            this.loadDocument(this.currentIndex);
            this.showDocumentDescription();
            this.updateFullscreenButtonPosition();

            console.log("Documents updated via postMessage:", this.documents.length, "documents, index:", this.currentIndex);
            // console.log("Document array after update:", this.documents);
          } else if (Array.isArray(newDocuments) && newDocuments.length === 0) {
            // Handle empty array - clear everything
            this.cleanupCachedIframes();

            this.documents.length = 0;
            this.isGalleryMode = false;
            this.currentIndex = -1;

            // Clear URL parameters
            const newUrl = window.location.pathname;
            window.history.replaceState({}, "", newUrl);

            // Hide all UI elements
            this.hideAllViewers();
            this.hideNavButtons();
            this.hideFileName();
            this.hideFullscreenButton();

            console.log("Documents cleared via postMessage - showing empty state");
          }
        } else if (type === "selectDocument") {
          // Handle document selection by url or index
          const {
            url,
            index
          } = payload;
          let targetIndex = -1;

          if (typeof index === "number" && index >= 0 && index < this.documents.length) {
            // Select by index
            targetIndex = index;
            console.log("Selecting document by index:", index);
          } else if (url) {
            // Select by URL
            targetIndex = this.documents.findIndex((doc) => doc.url === url);
            console.log("Selecting document by URL:", url, "found at index:", targetIndex);
          }

          if (targetIndex >= 0 && targetIndex < this.documents.length) {
            this.currentIndex = targetIndex;

            // Load the selected document
            this.loadDocument(this.currentIndex);
            this.showDocumentDescription();
            this.updateNavButtonVisibility();

            console.log("Document selected successfully, new index:", this.currentIndex);
          } else {
            console.warn("Document not found for selection criteria:", {
              url,
              index
            });
          }
        }
      });
    }

    initializeDocuments() {
      if (!this.documents.length || !this.documents[0] || !this.documents[0].url) {
        console.log("No document URL provided.");
        this.hideLoader();
        return;
      }

      if (!this.validateUrl(this.documents[0].url)) {
        console.error("Недопустимый URL");
        this.hideLoader();
        return;
      }
    }

    showNavButtons() {
      this.hideOverlay();

      // Update fullscreen button position based on scrollbar presence
      this.updateFullscreenButtonPosition();

      // Show fullscreen button if allowed and not video format (always show, even for single files)
      if (this.shouldShowFullscreenButton()) {
        this.fullscreenBtn.classList.remove("fade-out");
      }

      if (this.toggleDescriptionBtn) {
        this.toggleDescriptionBtn.classList.remove("fade-out");
      }

      // Show navigation buttons only in gallery mode
      if (this.isGalleryMode) {
        if (this.currentIndex === 0) {
          this.galleryNavPrev.classList.add("fade-out");
        } else {
          this.galleryNavPrev.classList.remove("fade-out");
        }

        if (this.currentIndex === this.documents.length - 1) {
          this.galleryNavNext.classList.add("fade-out");
        } else {
          this.galleryNavNext.classList.remove("fade-out");
        }
      }

      clearTimeout(this.hideNavTimeout);
      this.hideNavTimeout = setTimeout(() => {
        if (this.isGalleryMode) {
          this.galleryNavPrev.classList.add("fade-out");
          this.galleryNavNext.classList.add("fade-out");
        }
        if (this.shouldShowFullscreenButton()) {
          this.fullscreenBtn.classList.add("fade-out");
        }
        if (this.toggleDescriptionBtn) {
          this.toggleDescriptionBtn.classList.add("fade-out");
        }
        this.showOverlay();
      }, 2000);
    }

    hideNavButtons() {
      clearTimeout(this.hideNavTimeout);
      if (this.isGalleryMode) {
        this.galleryNavPrev.classList.add("fade-out");
        this.galleryNavNext.classList.add("fade-out");
      }
      if (this.shouldShowFullscreenButton()) {
        this.fullscreenBtn.classList.add("fade-out");
      }
      if (this.toggleDescriptionBtn) {
        this.toggleDescriptionBtn.classList.add("fade-out");
      }
      this.showOverlay();
    }

    updateUrlWithIndex(index) {
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

    showDocumentDescription() {
      const currentDoc = this.documents[this.currentIndex];
      if (!currentDoc) return;

      // Check if description should be shown based on toggle state or document override
      const shouldShowDescription = currentDoc.showDescription !== undefined
        ? currentDoc.showDescription
        : this.showDescriptionEnabled;

      let description = currentDoc.description;
      if (!description || description.trim() === "" || description === "Document") {
        description = `Документ №${this.currentIndex + 1}`;
      }

      this.descriptionDisplay.innerHTML = '';
      this.descriptionDisplay.className = "description-display";
      this.descriptionDisplay.classList.remove("hidden", "fade-out");

      // Check if current document uses viewerJS (image formats)
      const documentFormat = this.getCurrentFormat().toLowerCase();
      const isViewerJSFormat = [
        "image/gif", "image/jpg", "image/jpeg", "image/png", 
        "image/svg+xml", "image/bmp", "image/webp"
      ].includes(documentFormat);

      if (isViewerJSFormat) {
        this.descriptionDisplay.classList.add("shift-up");
      } else {
        this.descriptionDisplay.classList.remove("shift-up");
      }

      // Apply anchor-top for video content, but NOT for showAsLink documents
      const isVideoContent = documentFormat.startsWith("video/");
      const isShowAsLink = currentDoc && currentDoc.showAsLink;
      
      if (isVideoContent && !isShowAsLink) {
        this.controlButtonsContainer.classList.add("anchor-top");
      } else {
        this.controlButtonsContainer.classList.remove("anchor-top");
      }

      if (currentDoc.showAsLink) {
        this.descriptionDisplay.classList.add("show-as-link");
      } else {
        this.descriptionDisplay.classList.remove("show-as-link");
      }

      if (shouldShowDescription) {
        const descriptionText = document.createElement('div');
        descriptionText.className = 'description-text';
        descriptionText.textContent = description;
        this.descriptionDisplay.appendChild(descriptionText);
      }

      clearTimeout(this.hideFileNameTimeout);

      // Handle showAsLink documents - always show link regardless of toggle
      if (currentDoc.showAsLink) {
        const documentUrl = this.getCurrentDocument();

        if (!documentUrl) {
          const errorDiv = document.createElement('div');
          errorDiv.style.color = 'red';
          errorDiv.style.fontSize = '12px';
          errorDiv.textContent = 'Ошибка: URL документа не найден';
          this.descriptionDisplay.appendChild(errorDiv);
        } else {
          const openLink = document.createElement('a');
          openLink.className = 'open-link-btn';
          openLink.href = documentUrl;
          openLink.target = '_blank';
          openLink.textContent = 'Перейти за посиланням';
          this.descriptionDisplay.appendChild(openLink);
        }

        // Don't set timeout for showAsLink documents - they stay visible
        return;
      }

      if (!shouldShowDescription) {
        this.descriptionDisplay.classList.add("hidden");
        return;
      }

      // Check if current document is audio format
      const audioFormat = this.getCurrentFormat().toLowerCase();
      const isAudioFormat = audioFormat.startsWith('audio/');

      // Don't set timeout for audio documents when description is enabled
      if (isAudioFormat) {
        return;
      }

    }

    setupGalleryNavigation() {
      if (!this.isGalleryMode) {
        this.galleryNavPrev.classList.add("hidden");
        this.galleryNavNext.classList.add("hidden");

        if (this.galleryNavPrevHandler) {
          this.galleryNavPrev.removeEventListener("click", this.galleryNavPrevHandler);
          this.galleryNavPrevHandler = null;
        }
        if (this.galleryNavNextHandler) {
          this.galleryNavNext.removeEventListener("click", this.galleryNavNextHandler);
          this.galleryNavNextHandler = null;
        }
      } else {
        this.galleryNavPrev.classList.remove("hidden");
        this.galleryNavNext.classList.remove("hidden");

        if (this.galleryNavPrevHandler) {
          this.galleryNavPrev.removeEventListener("click", this.galleryNavPrevHandler);
        }
        if (this.galleryNavNextHandler) {
          this.galleryNavNext.removeEventListener("click", this.galleryNavNextHandler);
        }

        this.galleryNavPrevHandler = () => {
          if (this.currentIndex > 0) {
            this.currentIndex--;
            this.loadDocument(this.currentIndex);
            this.updateUrlWithIndex(this.currentIndex);
            this.showNavButtons();
            this.showDocumentDescription();
          }
        };

        this.galleryNavNextHandler = () => {
          if (this.currentIndex < this.documents.length - 1) {
            this.currentIndex++;
            this.loadDocument(this.currentIndex);
            this.updateUrlWithIndex(this.currentIndex);
            this.showNavButtons();
            this.showDocumentDescription();
          }
        };

        this.galleryNavPrev.addEventListener("click", this.galleryNavPrevHandler);
        this.galleryNavNext.addEventListener("click", this.galleryNavNextHandler);

        this.updateNavButtonVisibility();
      }

      document.body.addEventListener("mousemove", () => this.showNavButtons());
      document.body.addEventListener("touchstart", () => this.showNavButtons());
    }

    setupFullscreenButton() {
      // Setup fullscreen button (called after document loads to check format)
      if (this.shouldShowFullscreenButton()) {
        this.fullscreenBtn.classList.remove("hidden");
        this.fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
      } else {
        this.fullscreenBtn.classList.add("hidden");
      }
    }

    setupToggleDescriptionButton() {
      if (this.toggleDescriptionBtn) {
        this.toggleDescriptionBtn.addEventListener('click', () => {
          this.showDescriptionEnabled = !this.showDescriptionEnabled;
          this.updateToggleButtonState();
          this.showDocumentDescription();
        });
        this.updateToggleButtonState();
      }
    }

    updateToggleButtonState() {
      if (this.toggleDescriptionBtn) {
        this.toggleDescriptionBtn.classList.toggle('enabled', this.showDescriptionEnabled);
      }
    }

    updateNavButtonVisibility() {
      if (!this.isGalleryMode) return;

      if (this.currentIndex === 0) {
        this.galleryNavPrev.classList.add("fade-out");
      } else {
        this.galleryNavPrev.classList.remove("fade-out");
      }

      if (this.currentIndex === this.documents.length - 1) {
        this.galleryNavNext.classList.add("fade-out");
      } else {
        this.galleryNavNext.classList.remove("fade-out");
      }
    }

    getCurrentDocument() {
      return this.documents[this.currentIndex] ? this.documents[this.currentIndex].url : "";
    }

    detectFormatFromUrl(url) {
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

    getCurrentFormat() {
      if (!this.documents[this.currentIndex]) return "";

      const explicitFormat = this.documents[this.currentIndex].format;
      if (explicitFormat) {
        return explicitFormat;
      }

      const url = this.documents[this.currentIndex].url;
      const detectedFormat = this.detectFormatFromUrl(url);

      if (detectedFormat) {
        console.log(`Auto-detected format: ${detectedFormat} for URL: ${url}`);
        return detectedFormat;
      }

      return "";
    }

    cleanupCurrentViewer() {
      this.iframe.classList.add("hidden");
      this.plainTextWrapper.classList.add("hidden");
      this.adobeViewer.classList.add("hidden");
      this.unsupportedFormat.classList.add("hidden");
      document.getElementById("imageViewer").classList.add("hidden");

      if (this.currentCachedIframe) {
        this.currentCachedIframe.classList.add("hidden");
        this.currentCachedIframe.style.display = 'none';
      }

      this.iframe.classList.remove("microsoft-viewer-fix");
      this.iframe.src = "";
      this.plainTextContainer.innerText = "";

      this.iframeCache.forEach((cachedIframe) => {
        cachedIframe.classList.remove("audio-player-iframe");
      });

      const existingVideo = document.getElementById("videoPlayer");
      if (existingVideo) {
        existingVideo.remove();
      }

      if (this.currentViewer && this.currentViewer.destroy) {
        this.currentViewer.destroy();
      }
      this.currentViewer = null;
    }

    hideLoader() {
      this.loader.classList.toggle("hidden", true);
    }

    getQueryParameter(param) {
      const params = new URLSearchParams(window.location.search);
      return params.get(param);
    }

    showUnsupportedFormat() {
      this.unsupportedFormat.classList.remove("hidden");
      this.hideLoader();
    }


    getCacheKey(documentUrl, format) {
      return `${format}:${documentUrl}`;
    }

    getOrCreateCachedIframe(documentUrl, format) {
      const cacheKey = this.getCacheKey(documentUrl, format);

      if (this.iframeCache.has(cacheKey)) {
        console.log('Using cached iframe for:', cacheKey);
        return this.iframeCache.get(cacheKey);
      }

      const newIframe = document.createElement('iframe');
      newIframe.className = 'viewer-iframe';
      newIframe.frameBorder = '0';
      newIframe.allowFullscreen = true;
      newIframe.setAttribute('mozallowfullscreen', 'true');
      newIframe.setAttribute('webkitallowfullscreen', 'true');
      newIframe.style.display = 'none'; // Start hidden

      document.body.appendChild(newIframe);

      if (this.iframeCache.size >= this.maxCachedIframes) {
        const oldestKey = this.iframeCache.keys().next().value;
        const oldestIframe = this.iframeCache.get(oldestKey);
        if (oldestIframe && oldestIframe.parentNode) {
          oldestIframe.parentNode.removeChild(oldestIframe);
        }
        this.iframeCache.delete(oldestKey);
        console.log('Removed oldest cached iframe:', oldestKey);
      }

      this.iframeCache.set(cacheKey, newIframe);
      console.log('Created and cached new iframe for:', cacheKey);

      return newIframe;
    }

    showCachedIframe(targetIframe) {
      if (this.currentCachedIframe && this.currentCachedIframe !== targetIframe) {
        this.currentCachedIframe.style.display = 'none';
        this.currentCachedIframe.classList.add('hidden');
      }

      this.iframe.classList.add('hidden');
      this.iframe.style.display = 'none';

      targetIframe.style.display = 'block';
      targetIframe.classList.remove('hidden');
      this.currentCachedIframe = targetIframe;
    }

    cleanupCachedIframes() {
      this.iframeCache.forEach((cachedIframe, key) => {
        if (cachedIframe && cachedIframe.parentNode) {
          cachedIframe.parentNode.removeChild(cachedIframe);
        }
      });
      this.iframeCache.clear();
      this.currentCachedIframe = null;
      console.log('Cleaned up all cached iframes');
    }

    async fetchBinaryData(url) {
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

    detectEncoding(uint8Array) {
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

    decodeBinaryData(arrayBuffer) {
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

      const encoding = this.detectEncoding(uint8Array);
      const decoder = new TextDecoder(encoding);
      const decoded = decoder.decode(uint8Array);
      console.log(`Text successfully decoded as ${encoding === "ibm866" ? "OEM" : encoding}`);
      return decoded;
    }

    isBrowserHasPDFViewer() {
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

    loadAdobeSdk() {
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

    setupViewerJs(documentUrl) {
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

        this.currentViewer = new Viewer(imageElement, {
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

        this.hideLoader();
      }.bind(this);

      if (!document.querySelector('script[src*="viewerjs"]')) {
        document.body.appendChild(script);
      } else {
        script.onload();
      }
    }

    setupAdobeViewer(documentUrl) {
      document.addEventListener("adobe_dc_view_sdk.ready", function () {
        var adobeDCView = new AdobeDC.View({
          clientId: this.adobeClientId,
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
          .then(this.hideLoader);
      }.bind(this));
      this.iframe.classList.toggle("hidden", true);
      this.adobeViewer.classList.toggle("hidden", false);
    }

    convertToYouTubeEmbedUrl(url, autoplay = false, controls = true) {
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

    setupYouTubeViewer(documentUrl) {
      const currentDoc = this.documents[this.currentIndex];
      const autoplay = currentDoc.autoplay || false;
      const controls = currentDoc.controls !== false; // default to true

      const embedUrl = this.convertToYouTubeEmbedUrl(documentUrl, autoplay, controls);

      if (!embedUrl) {
        this.showUnsupportedFormat();
        return;
      }

      const cachedIframe = this.getOrCreateCachedIframe(documentUrl, 'video/youtube');

      // Only set src if it's different (avoid reloading)
      if (cachedIframe.src !== embedUrl) {
        cachedIframe.src = embedUrl;
        cachedIframe.addEventListener("load", () => this.hideLoader(), {
          once: true,
        });
      } else {
        this.hideLoader();
      }

      this.showCachedIframe(cachedIframe);
    }

    setupGoogleDocsViewer(documentUrl) {
      const currentDoc = this.documents[this.currentIndex];
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

      const format = this.getCurrentFormat();
      const cachedIframe = this.getOrCreateCachedIframe(documentUrl, format);

      // Only set src if it's different (avoid reloading)
      if (cachedIframe.src !== embedUrl) {
        cachedIframe.src = embedUrl;
        cachedIframe.addEventListener("load", () => this.hideLoader(), {
          once: true,
        });
      } else {
        this.hideLoader();
      }

      this.showCachedIframe(cachedIframe);
    }

    setupVideoViewer(documentUrl) {
      const currentDoc = this.documents[this.currentIndex];
      const autoplay = currentDoc.autoplay || false;
      const controls = currentDoc.controls !== false;
      const loop = currentDoc.loop || false;

      this.cleanupCurrentViewer();

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

      this.iframe.classList.add("hidden");
      document.body.appendChild(videoElement);

      videoElement.addEventListener("loadeddata", () => this.hideLoader(), {
        once: true,
      });

      videoElement.addEventListener("error", () => {
        console.error("Error loading video:", documentUrl);
        this.showUnsupportedFormat();
      });
    }

    setupAudioViewer(documentUrl) {
      const audioPlayerUrl = `${this.audioPlayerUrl}?url=${encodeURIComponent(documentUrl)}&enableCors=false`;
      const format = this.getCurrentFormat();
      const cachedIframe = this.getOrCreateCachedIframe(documentUrl, format);

      if (cachedIframe.src !== audioPlayerUrl) {
        cachedIframe.src = audioPlayerUrl;
        cachedIframe.addEventListener("load", () => this.hideLoader(), {
          once: true,
        });
      } else {
        this.hideLoader();
      }

      cachedIframe.classList.add("audio-player-iframe");

      this.showCachedIframe(cachedIframe);
    }

    loadDocument(index) {
      if (index < 0 || index >= this.documents.length) return;

      this.currentIndex = index;
      const documentUrl = this.getCurrentDocument();
      const currentDoc = this.documents[this.currentIndex];

      // Check if document should be shown as link only
      if (currentDoc && currentDoc.showAsLink) {
        this.cleanupCurrentViewer();
        this.hideLoader();
        this.showDocumentDescription();
        this.updateNavButtonVisibility();
        this.setupFullscreenButton();
        return;
      }

      const format = this.getCurrentFormat();

      if (!this.validateUrl(documentUrl)) {
        console.error("Недопустимый URL:", documentUrl);
        return;
      }

      this.cleanupCurrentViewer();
      this.loader.classList.remove("hidden");

      switch (format) {
        case "text/plain":
          this.iframe.classList.add("hidden");
          this.plainTextWrapper.classList.remove("hidden");
          console.log("fetching", documentUrl);
          this.fetchBinaryData(documentUrl).then((arrayBuffer) => {
            const text = this.decodeBinaryData(arrayBuffer);
            this.plainTextContainer.innerText = text;
            this.hideLoader();
          });
          break;
        case "application/msword":
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        case "application/vnd.oasis.opendocument.text":
        case "application/vnd.ms-excel":
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
          const officeUrl = `${this.microsoftViewerUrl}?src=${encodeURIComponent(documentUrl)}`;
          const officeCachedIframe = this.getOrCreateCachedIframe(documentUrl, format);
          officeCachedIframe.classList.add("microsoft-viewer-fix");

          if (officeCachedIframe.src !== officeUrl) {
            officeCachedIframe.src = officeUrl;
            officeCachedIframe.addEventListener("load", () => this.hideLoader(), {
              once: true,
            });
          } else {
            this.hideLoader();
          }

          this.showCachedIframe(officeCachedIframe);
          break;
        case "application/pdf":
          if (this.isBrowserHasPDFViewer()) {
            const pdfCachedIframe = this.getOrCreateCachedIframe(documentUrl, format);

            if (pdfCachedIframe.src !== documentUrl) {
              pdfCachedIframe.src = documentUrl;
              pdfCachedIframe.addEventListener("load", () => this.hideLoader(), {
                once: true,
              });
            } else {
              this.hideLoader();
            }

            this.showCachedIframe(pdfCachedIframe);
            break;
          }
          this.loadAdobeSdk()
            .then(() => this.setupAdobeViewer(documentUrl))
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
          this.setupViewerJs(documentUrl);
          break;
        case "video/youtube":
          this.setupYouTubeViewer(documentUrl);
          break;
        case "video/mp4":
        case "video/webm":
        case "video/ogg":
        case "video/avi":
        case "video/mov":
        case "video/wmv":
        case "video/x-matroska":
          this.setupVideoViewer(documentUrl);
          break;
        case "audio/mpeg":
        case "audio/wav":
        case "audio/ogg;codecs=vorbis":
        case "audio/ogg;codecs=opus":
        case "audio/webm;codecs=opus":
        case "audio/mp4;codecs=mp4a.40.2":
          this.setupAudioViewer(documentUrl);
          break;
        case "application/google-docs":
        case "application/google-sheets":
        case "application/google-slides":
        case "application/google-drive":
          this.setupGoogleDocsViewer(documentUrl);
          break;
        case "text/html":
        case "application/xhtml+xml":
          const htmlCachedIframe = this.getOrCreateCachedIframe(documentUrl, format);

          if (htmlCachedIframe.src !== documentUrl) {
            htmlCachedIframe.src = documentUrl;
            htmlCachedIframe.addEventListener("load", () => this.hideLoader(), {
              once: true,
            });
          } else {
            this.hideLoader();
          }

          this.showCachedIframe(htmlCachedIframe);
          break;
        default:
          this.showUnsupportedFormat();
      }

      // Update navigation button visibility after loading
      this.updateNavButtonVisibility();

      // Setup fullscreen button based on current document format
      this.setupFullscreenButton();
    }

    init() {
      // Initialize event listeners and PostMessage support
      this.initializeEventListeners();
      this.initializePostMessageListener();
      this.initializeDocuments();

      document.addEventListener("DOMContentLoaded", () => {
        // Only proceed with document loading if we have valid documents
        if (this.documents.length > 0 && this.documents[0] && this.documents[0].url) {

          this.currentIndex = Math.max(0, Math.min(this.config.index ?? 0, this.documents.length - 1));

          this.setupGalleryNavigation();
          this.setupToggleDescriptionButton();
          this.loadDocument(this.currentIndex);
          this.showDocumentDescription();
        }
      });
    }

  }

  const viewer = new DocumentViewer(documents, config);
  viewer.init();
  console.log("Document Viewer initialized")
}

const javaScript = `
const documents = ${JSON.stringify(documents, null, 2)};
const config = ${JSON.stringify(config, null, 2)};

(${script.toString()})(documents, config);`;

data.javaScript = javaScript;
