data.css = `
      .hidden {
        display: none !important;
      }

      body,
      html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .plain-text-wrapper,
      .viewer-iframe {
        width: 100%;
        height: 100%;
        border: none;
        position: absolute;
        left: 0;
        top: 0;
      }

      .audio-player-iframe {
        width: calc(100% - 160px) !important;
      }

      .microsoft-viewer-fix {
        left: -1px;
        top: -1px;
        width: calc(100% + 1px);
        height: calc(100% + 1px);
      }

      #loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .loader {
        width: 66px;
        height: 66px;
        animation: circleRoot 1.4s linear infinite;
      }

      .loader circle {
        stroke-width: 3;
        animation: circleNested 1.4s ease-in-out infinite;
        stroke: #f88010;
        stroke-linecap: round;
        stroke-dasharray: 80px, 200px;
        stroke-dashoffset: 0px;
      }

      @keyframes circleRoot {
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes circleNested {
        0% {
          stroke-dasharray: 1px, 200px;
          stroke-dashoffset: 0px;
        }
        50% {
          stroke-dasharray: 100px, 200px;
          stroke-dashoffset: -15px;
        }
        100% {
          stroke-dasharray: 1px, 200px;
          stroke-dashoffset: -120px;
        }
      }

      .plain-text-wrapper {
        overflow-y: auto;
        padding: 17px;
        box-sizing: border-box;
      }

      .plain-text-container {
        max-width: 800px;
        min-height: 100%;
        box-sizing: border-box;
        background: white;
        color: black;
        box-shadow: 0 3px 15px 0px #0002, 0 0 0 1px #0002;
        margin-inline: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        user-select: text;
        font-size: 18px;
        line-height: 1.35;
        padding: clamp(20px, 10%, 80px);
      }

      @media screen and (max-width: 767px) {
        .plain-text-container {
          font-size: 16px;
        }
      }

      .image-viewer {
        width: 100%;
        height: 100%;
      }

      .viewer-toolbar {
        scale: 1.3;
      }

      .viewer-toolbar li {
        background-color: rgba(128, 128, 128, 0.8);
      }

      .viewer-toolbar li:before {
        background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 560 40'%3E%3Cpath fill='%23fff' d='M49.6 17.9h20.2v3.9H49.6zm123.1 2 10.9-11 2.7 2.8-8.2 8.2 8.2 8.2-2.7 2.7-10.9-10.9zm94 0-10.8-11-2.7 2.8 8.1 8.2-8.1 8.2 2.7 2.7 10.8-10.9zM212 9.3l20.1 10.6L212 30.5V9.3zm161.5 4.6-7.2 6 7.2 5.9v-4h12.4v4l7.3-5.9-7.3-6v4h-12.4v-4zm40.2 12.3 5.9 7.2 5.9-7.2h-4V13.6h4l-5.9-7.3-5.9 7.3h4v12.6h-4zm35.9-16.5h6.3v2h-4.3V16h-2V9.7Zm14 0h6.2V16h-2v-4.3h-4.2v-2Zm6.2 14V30h-6.2v-2h4.2v-4.3h2Zm-14 6.3h-6.2v-6.3h2v4.4h4.3v2Zm-438 .1v-8.3H9.6v-3.9h8.2V9.7h3.9v8.2h8.1v3.9h-8.1v8.3h-3.9zM93.6 9.7h-5.8v3.9h2V30h3.8V9.7zm16.1 0h-5.8v3.9h1.9V30h3.9V9.7zm-11.9 4.1h3.9v3.9h-3.9zm0 8.2h3.9v3.9h-3.9zm244.6-11.7 7.2 5.9-7.2 6v-3.6c-5.4-.4-7.8.8-8.7 2.8-.8 1.7-1.8 4.9 2.8 8.2-6.3-2-7.5-6.9-6-11.3 1.6-4.4 8-5 11.9-4.9v-3.1Zm147.2 13.4h6.3V30h-2v-4.3h-4.3v-2zm14 6.3v-6.3h6.2v2h-4.3V30h-1.9zm6.2-14h-6.2V9.7h1.9V14h4.3v2zm-13.9 0h-6.3v-2h4.3V9.7h2V16zm33.3 12.5 8.6-8.6-8.6-8.7 1.9-1.9 8.6 8.7 8.6-8.7 1.9 1.9-8.6 8.7 8.6 8.6-1.9 2-8.6-8.7-8.6 8.7-1.9-2zM297 10.3l-7.1 5.9 7.2 6v-3.6c5.3-.4 7.7.8 8.7 2.8.8 1.7 1.7 4.9-2.9 8.2 6.3-2 7.5-6.9 6-11.3-1.6-4.4-7.9-5-11.8-4.9v-3.1Zm-157.3-.6c2.3 0 4.4.7 6 2l2.5-3 1.9 9.2h-9.3l2.6-3.1a6.2 6.2 0 0 0-9.9 5.1c0 3.4 2.8 6.3 6.2 6.3 2.8 0 5.1-1.9 6-4.4h4c-1 4.7-5 8.3-10 8.3a10 10 0 0 1-10-10.2 10 10 0 0 1 10-10.2Z' /%3E%3C/svg%3E");
      }

      .gallery-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: rgba(128, 128, 128, 0.8);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        transition: opacity 0.3s ease, background-color 0.15s;
        opacity: 1;
      }

      .gallery-nav:hover {
        background: rgba(128, 128, 128, 0.9);
      }

      .gallery-nav.fade-out {
        opacity: 0;
        pointer-events: none;
      }

      .gallery-nav-prev {
        left: 20px;
      }

      .gallery-nav-next {
        right: 20px;
      }

      .gallery-nav svg {
        width: 24px;
        height: 24px;
        fill: white;
      }

      .gallery-nav-prev svg {
        transform: translateX(-1px);
      }

      .gallery-nav-next svg {
        transform: translateX(1px);
      }

      @media screen and (max-width: 767px) {
        .gallery-nav {
          width: 40px;
          height: 40px;
        }

        .gallery-nav svg {
          width: 26px;
          height: 26px;
        }

        .gallery-nav-prev {
          left: 10px;
        }

        .gallery-nav-next {
          right: 10px;
        }
      }

      .iframe-mouse-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 999999;
        pointer-events: auto;
      }

      .unsupported-format {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        text-align: center;
        font-size: 18px;
        max-width: 400px;
        z-index: 1001;
      }

      .description-display {
        position: absolute;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: 500;
        z-index: 1002;
        transition: opacity 0.3s ease;
        opacity: 1;
        pointer-events: none;
        max-width: 600px;
        text-align: center;
		    white-space: pre-line;
		    overflow: hidden;
        text-overflow: ellipsis;

        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .description-display.fade-out {
        opacity: 0;
      }
      .description-display .open-link-btn {
        color: #ccc;
        text-decoration: underline;
        font-size: 120%;
        font-weight: 500;
        cursor: pointer;
        pointer-events: auto;
        display: block;
        transition: color 0.2s ease;
      }

      .description-display .open-link-btn:hover {
        color: white;
      }

      .description-display.show-as-link {
        top: 50%;
        bottom: auto;
        transform: translate(-50%, -50%);
        padding: 24px 40px;
        border-radius: 0;
      }

      .gallery-nav:hover {
        background: rgba(0, 0, 0, 0.7);
      }

      .fullscreen-btn {
        position: absolute;
        bottom: 10px;
        right: var(--fullscreen-btn-right, 10px);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(128, 128, 128, 0.8);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        transition: opacity 0.3s ease, background-color 0.15s;
        opacity: 1;
      }

      .fullscreen-btn:hover {
        background: rgba(0, 0, 0, 0.7);
      }

      .fullscreen-btn.fade-out {
        opacity: 0;
        pointer-events: none;
      }

      .fullscreen-btn svg {
        width: 16px;
        height: 16px;
        fill: white;
      }
`;
