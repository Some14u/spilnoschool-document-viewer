const css = data.css;
const javaScript = data.javaScript;

data.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Document Viewer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
 		${css}
    </style>
  </head>
  <body>
    <div id="loader" class="hidden">
      <svg class="loader" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none"></circle></svg>
    </div>

    <iframe id="viewer" class="viewer-iframe" frameborder="0" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
    <div id="adobeViewer" class="hidden"></div>
    <img id="imageViewer" class="image-viewer hidden" />
    <div id="plainTextWrapper" class="plain-text-wrapper hidden"><div id="plainTextContainer" class="plain-text-container"></div></div>
    <div id="unsupportedFormat" class="unsupported-format hidden">
      <div>Ресурс у цьому форматі не підтримується</div>
    </div>

    <button id="galleryNavPrev" class="gallery-nav gallery-nav-prev hidden">
      <svg viewBox="0 0 24 24">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
      </svg>
    </button>

    <button id="galleryNavNext" class="gallery-nav gallery-nav-next hidden">
      <svg viewBox="0 0 24 24">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
      </svg>
    </button>

    <div id="descriptionDisplay" class="description-display hidden"></div>

    <div id="controlButtonsContainer" class="control-buttons-container">
      <button id="toggleDescriptionBtn" class="toggle-description-btn">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path d="M109.5 95.2C99.3 103 87.7 112 87.7 134.6h24.8c0-13.6 8.8-21.3 17.9-29.2 9.5-8.3 19.3-16.9 19.3-32.8a49.6 49.6 0 1 0-99.2 0h24.8c0-13.6 11.2-24.8 24.8-24.8s24.8 11.2 24.8 24.8c0 10.9-7.2 16.4-15.3 22.6Zm2.9 82.8v-24.8H87.6V178h24.8Z" />
        </svg>
      </button>

      <a id="downloadLink" class="download-link hidden">
        <button id="downloadBtn" class="download-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <path fill="none" stroke="currentColor" stroke-width="22" d="m147 70-47 48-47-48m-25 45v51h144v-51M100 10v108" />
          </svg>
        </button>
      </a>

      <button id="fullscreenBtn" class="fullscreen-btn hidden">
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 15H15V10H13.2V13.2H10V15ZM6 15V13.2H2.8V10H1V15H6ZM10 2.8H12.375H13.2V6H15V1H10V2.8ZM6 1V2.8H2.8V6H1V1H6Z" />
        </svg>
      </button>
    </div>

    <script>
		${javaScript}
    </script>
  </body>
</html>
`;
