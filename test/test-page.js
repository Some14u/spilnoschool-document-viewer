let currentDocuments = [];

function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

function updateDocumentList() {
    const listContainer = document.getElementById('documentList');
    const documentsContainer = document.getElementById('documents');

    if (currentDocuments.length === 0) {
        listContainer.style.display = 'none';
        return;
    }

    listContainer.style.display = 'block';
    documentsContainer.innerHTML = currentDocuments.map((doc, index) =>
        `<div class="document-item">
            <strong>${index + 1}.</strong> ${doc.description || doc.name || 'Документ'}
            <br><small>${doc.format || 'auto'} - ${doc.url.substring(0, 60)}${doc.url.length > 60 ? '...' : ''}</small>
        </div>`
    ).join('');
}

function sendToWidget(type, payload) {
    const iframe = document.getElementById('widgetFrame');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: type,
            payload: payload
        }, '*');
    }
}

function addSampleDocuments() {
    const basePath = window.location.pathname.includes('/dist/') ? '../assets/' : '/assets/';
    currentDocuments = [
        {
            url: basePath + "sample.pdf",
            description: "Локальный PDF документ",
            format: "application/pdf",
            showAsLink: true
        },
        {
            url: basePath + "sample.svg",
            description: "Локальный SVG файл",
            format: "image/svg+xml",
            showAsLink: true
        },
        {
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            description: "YouTube видео",
            format: "video/youtube"
        }
    ];

    sendToWidget('updateDocuments', {
        documents: currentDocuments,
        index: 0
    });

    updateDocumentList();
    showStatus(`Добавлено ${currentDocuments.length} тестовых документов`);
}

function addImageDocuments() {
    currentDocuments = [
        {
            url: "https://picsum.photos/800/600?random=1",
            description: "Случайное изображение 1",
            format: "image/jpeg"
        },
        {
            url: "https://picsum.photos/800/600?random=2",
            description: "Случайное изображение 2",
            format: "image/jpeg"
        },
        {
            url: "https://picsum.photos/800/600?random=3",
            description: "Случайное изображение 3",
            format: "image/jpeg"
        }
    ];

    sendToWidget('updateDocuments', {
        documents: currentDocuments,
        index: 0
    });

    updateDocumentList();
    showStatus(`Добавлено ${currentDocuments.length} изображений`);
}

function addVideoDocuments() {
    currentDocuments = [
        {
            url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            description: "YouTube: Me at the zoo",
            format: "video/youtube"
        },
        {
            url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
            description: "YouTube: Gangnam Style",
            format: "video/youtube"
        }
    ];

    sendToWidget('updateDocuments', {
        documents: currentDocuments,
        index: 0
    });

    updateDocumentList();
    showStatus(`Добавлено ${currentDocuments.length} видео`);
}

function clearDocuments() {
    currentDocuments = [];

    sendToWidget('updateDocuments', {
        documents: [],
        index: 0
    });

    updateDocumentList();
    showStatus('Все документы удалены', 'error');
}

window.addEventListener('message', function(event) {
    if (event.data === 'reload-widget') {
        reloadWidget();
    }
});

function checkBuildStatus() {
    showWidget();
}

function showBuildError(errorMessage) {
    const iframe = document.getElementById('widgetFrame');
    const errorDiv = document.getElementById('buildError');
    const errorDetails = document.getElementById('errorDetails');
    
    iframe.style.display = 'none';
    errorDiv.style.display = 'flex';
    errorDetails.textContent = errorMessage;
    
    showStatus('Обнаружена ошибка сборки виджета', 'error');
}

function showWidget() {
    const iframe = document.getElementById('widgetFrame');
    const errorDiv = document.getElementById('buildError');
    
    iframe.style.display = 'block';
    errorDiv.style.display = 'none';
}

function retryBuild() {
    showStatus('Перезагрузка виджета...', 'success');
    const iframe = document.getElementById('widgetFrame');
    iframe.src = iframe.src + '?t=' + Date.now();
    
    setTimeout(checkBuildStatus, 1000);
}

function reloadWidget() {
    const iframe = document.getElementById('widgetFrame');
    iframe.src = iframe.src + '?t=' + Date.now();
    showStatus('Виджет перезагружен');
    
    setTimeout(checkBuildStatus, 1000);
}

window.addEventListener('load', function() {
    showStatus('Тестовая страница загружена. Проверка статуса сборки виджета...');
    checkBuildStatus();
});
