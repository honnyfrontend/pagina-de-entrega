document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const fileNamesDisplay = document.getElementById('file-names');
    const photoGallery = document.getElementById('photo-gallery');
    const uploadForm = document.getElementById('uploadForm');
    const downloadModal = document.getElementById('downloadModal');
    
    let currentDownloadPublicId = '';
    let currentDownloadFilename = '';

    // Event Listeners
    fileInput.addEventListener('change', updateFileNames);
    uploadForm.addEventListener('submit', handleUpload);
    
    // Load photos on page load
    loadPhotos();

    // Functions
    function updateFileNames() {
        if (fileInput.files.length > 0) {
            const names = Array.from(fileInput.files).map(file => file.name).join(', ');
            fileNamesDisplay.textContent = `${fileInput.files.length} arquivo(s) selecionado(s): ${names}`;
        } else {
            fileNamesDisplay.textContent = 'Nenhum arquivo selecionado.';
        }
    }

    async function handleUpload(e) {
        e.preventDefault();

        if (!fileInput.files || fileInput.files.length === 0) {
            alert('Por favor, selecione pelo menos um arquivo.');
            return;
        }

        const formData = new FormData();
        for (const file of fileInput.files) {
            formData.append('photos', file);
        }

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao fazer o upload.');
            }

            const result = await response.json();
            alert(result.message || 'Upload realizado com sucesso!');
            fileInput.value = '';
            fileNamesDisplay.textContent = 'Nenhum arquivo selecionado.';
            loadPhotos();
        } catch (error) {
            console.error('Erro:', error);
            alert(error.message || 'Erro ao conectar com o servidor.');
        }
    }

    async function loadPhotos() {
        try {
            const response = await fetch('/api/photos');
            
            if (!response.ok) {
                throw new Error('Erro ao carregar fotos');
            }
            
            const result = await response.json();
            
            if (!result.photos) {
                throw new Error('Formato de dados inválido');
            }

            photoGallery.innerHTML = '';
            
            if (result.photos.length === 0) {
                photoGallery.innerHTML = '<p>Nenhuma foto encontrada.</p>';
                return;
            }

            result.photos.forEach(photo => {
                if (!photo.url || !photo.public_id || !photo.filename) {
                    console.warn('Foto com dados incompletos:', photo);
                    return;
                }

                const photoCard = document.createElement('div');
                photoCard.className = 'photo-card';
                photoCard.innerHTML = `
                    <img src="${photo.url}" alt="${photo.filename}" loading="lazy">
                    <div class="action-buttons">
                        <button class="action-btn download-btn" onclick="openModal('${photo.public_id}', '${photo.filename}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn delete-btn" onclick="deletePhoto('${photo.public_id}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;
                photoGallery.appendChild(photoCard);
            });
        } catch (error) {
            console.error('Erro ao carregar fotos:', error);
            photoGallery.innerHTML = `<p>Erro ao carregar fotos: ${error.message}</p>`;
        }
    }

    window.openModal = function(publicId, filename) {
        currentDownloadPublicId = publicId;
        currentDownloadFilename = filename;
        downloadModal.style.display = 'flex';
    };

    window.closeModal = function() {
        downloadModal.style.display = 'none';
    };

    window.downloadPhoto = function(quality) {
        const downloadUrl = `/api/download/${encodeURIComponent(currentDownloadPublicId)}?quality=${quality}`;
        window.open(downloadUrl, '_blank');
        closeModal();
    };

    window.deletePhoto = async function(publicId) {
        if (!confirm(`Tem certeza que deseja deletar esta foto?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/photos/${encodeURIComponent(publicId)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao deletar a foto.');
            }

            const result = await response.json();
            alert(result.message || 'Foto deletada com sucesso!');
            loadPhotos();
        } catch (error) {
            console.error('Erro ao deletar foto:', error);
            alert(error.message || 'Erro ao conectar com o servidor para deletar a foto.');
        }
    };
});