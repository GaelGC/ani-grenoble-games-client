// import { get } from 'node:http';

const { createClient } = require('webdav');
const http = require('node:http')
const { ipcRenderer } = require('electron')
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const cell = entry.target as HTMLElement;
            const file = JSON.parse(cell.dataset.file);
            loadThumbnail(file, cell);
            observer.unobserve(cell);
        }
    });
});
window.onload = function () {
    (document.getElementById('username') as HTMLInputElement).focus();
}

let client = null;
let currentPath = '/';

//  ----------- LOGIN ---------------------
async function login() {
    const username = (document.getElementById('username') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;

    try {
        client = createClient('http://192.168.1.200:8000/remote.php/dav/files/' + username + '/', {
            username,
            password
        });

        await client.getDirectoryContents('/');

        document.getElementById('login-form').style.display = 'none';
        document.getElementById('DB_rec').style.display = 'block';
        listFiles('/Quiz ressources');
        allFiles = [];
        indexFiles('/').then(() => {
            document.getElementById('index-status').textContent = '';
        });
    } catch (e) {
        document.getElementById('login-error').textContent = 'Identifiants incorrects';
    }
}
document.getElementById('password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
});

function togglePassword() {
    const input = document.getElementById('password') as HTMLInputElement;
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ----------------- LE CONTENU DU TABLEAU LA --------------------------------------
async function listFiles(path = '/') {
    document.querySelectorAll('th')[0].style.width = '50%';
    document.querySelectorAll('th')[2].style.width = '15%';
    document.querySelectorAll('th')[3].style.display = '';
    document.querySelectorAll('th')[2].textContent = 'Taille';
    currentPath = path;
    const files = await client.getDirectoryContents(path);

    const tbody = document.getElementById('file-body');
    tbody.innerHTML = '';

    files.forEach(file => {
        const row = document.createElement('tr');
        row.dataset.filename = file.filename;
        const size = file.type === 'directory' ? '—' : formatSize(file.size);
        const date = new Date(file.lastmod).toLocaleDateString('fr-FR');
        const fileType = formatType(file);

        row.innerHTML = `
            <td><input type="checkbox" class="file-checkbox"> ${file.basename}</td>
            <td>${formatType(file)}</td>
            <td>${size}</td>
            <td class="preview-cell"></td>
            <td>${date}</td>
            <td><button class="delete-btn">🗑</button></td>
        `;

        const deleteBtn = row.querySelector('.delete-btn') as HTMLElement;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFile(file).catch(e => console.error(e));
        };

        const checkbox = row.querySelector('.file-checkbox') as HTMLInputElement;
        checkbox.onclick = (e) => {
            e.stopPropagation();
            updateDeleteSelectedBtn();
        };
        const cell = row.querySelector('.preview-cell') as HTMLElement;
        if (fileType === 'Image') {
            cell.dataset.file = JSON.stringify(file);
            observer.observe(cell);
        } else {
            cell.textContent = '—';
        }
        row.style.cursor = 'pointer';
        row.onclick = () => {
            if (file.type === 'directory') {
                listFiles(file.filename);
            } else {
                openPreview(file);
            }
        };

        tbody.appendChild(row);
    });
    updateBreadcrumb(path);
}
function formatType(file) {
    if (file.type === 'directory') return ' Dossier';
    const mime = file.mime || '';
    if (mime.startsWith('image/')) return 'Image';
    if (mime.startsWith('audio/')) return 'Musique';
    if (mime.startsWith('video/')) return 'Vidéo';
    if (mime.startsWith('text/')) return 'Texte';
    if (mime === 'application/pdf') return 'PDF';
    if (mime === 'application/json') return 'JSON';
    return 'Fichier';
}
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

async function openPreview(file) {
    console.log('openPreview appelé pour :', file.basename);
    console.log('mime :', file.mime);
    if (file.type === 'directory') return;

    const mime = file.mime || '';
    const url = 'http://192.168.1.200:8000/remote.php/dav/files/'
        + (document.getElementById('username') as HTMLInputElement).value
        + file.filename;
    console.log('url :', url);

    const body = document.getElementById('preview-body');
    body.innerHTML = '';

    if (mime.startsWith('image/')) {
        const buffer = await client.getFileContents(file.filename) as ArrayBuffer;
        const blob = new Blob([buffer], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.src = objectUrl;
        img.onload = () => {
            if (img.naturalWidth >= img.naturalHeight) {
                img.style.width = '700px';
                img.style.height = 'auto';
            } else {
                img.style.height = '500px';
                img.style.width = 'auto';
            }
        };
        body.appendChild(img);
    } else if (mime.startsWith('audio/') || mime.startsWith('video/')) {
        const buffer = await client.getFileContents(file.filename) as ArrayBuffer;
        const blob = new Blob([buffer], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        const media = document.createElement(mime.startsWith('audio/') ? 'audio' : 'video');
        media.src = objectUrl;
        media.controls = true;
        media.autoplay = true;
        if (mime.startsWith('video/')) (media as HTMLVideoElement).style.maxWidth = '100%';
        body.appendChild(media);
    } else if (mime.startsWith('text/') || mime === 'application/json') {
        const content = await client.getFileContents(file.filename, { format: 'text' });
        const pre = document.createElement('pre');
        pre.textContent = content as string;
        body.appendChild(pre);
    } else {
        body.textContent = 'Aperçu non disponible pour ce type de fichier.';
    }

    document.getElementById('preview-modal').style.display = 'flex';
}

function closePreview() {
    document.getElementById('preview-modal').style.display = 'none';
    document.getElementById('preview-body').innerHTML = '';
}

const thumbnailCache = {};
async function loadThumbnail(file, cell) {
    try {
        let objectUrl = thumbnailCache[file.filename];
        if (!objectUrl) {
            const buffer = await client.getFileContents(file.filename) as ArrayBuffer;
            const blob = new Blob([buffer], { type: file.mime });
            objectUrl = URL.createObjectURL(blob);
            thumbnailCache[file.filename] = objectUrl;
        }
        const img = document.createElement('img');
        img.src = objectUrl;
        img.style.height = '40px';
        img.style.width = 'auto';
        img.style.borderRadius = '4px';
        cell.appendChild(img);
    } catch (e) {
        cell.textContent = '—';
    }
}

// --------------- NAVIGATION -----------------------
let allFiles = [];

async function indexFiles(path = '/') {
    const files = await client.getDirectoryContents(path);
    for (const file of files) {
        allFiles.push(file);
        if (file.type === 'directory') {
            await indexFiles(file.filename);
        }
    }
}

function search() {
    document.querySelectorAll('th')[2].textContent = 'Chemin';
    document.querySelectorAll('th')[3].style.display = 'none';
    document.querySelectorAll('th')[0].style.width = '35%';
    document.querySelectorAll('th')[2].style.width = '35%';
    const query = (document.getElementById('search-bar') as HTMLInputElement).value.toLowerCase();

    if (query === '') {
        listFiles(currentPath);
        return;
    }

    const results = allFiles.filter(f =>
        f.basename.toLowerCase().includes(query)
    );

    const tbody = document.getElementById('file-body');
    tbody.innerHTML = '';

    results.forEach(file => {
        const row = document.createElement('tr');
        const size = file.type === 'directory' ? '—' : formatSize(file.size);
        const date = new Date(file.lastmod).toLocaleDateString('fr-FR');

        row.innerHTML = `
            <td>${file.basename}</td>
            <td>${formatType(file)}</td>
            <td class="path-cell">${file.filename}</td>
            <td style="display:none"></td>
            <td>${date}</td>
        `;
        const pathCell = row.querySelector('.path-cell') as HTMLElement;
        const parentPath = file.filename.substring(0, file.filename.lastIndexOf('/')) || '/';

        pathCell.style.cursor = 'pointer';
        pathCell.style.textDecoration = 'underline';
        pathCell.onclick = (e) => {
            e.stopPropagation();
            (document.getElementById('search-bar') as HTMLInputElement).value = '';
            listFiles(parentPath);
        };
        row.style.cursor = 'pointer';
        row.onclick = () => {
            if (file.type === 'directory') {
                listFiles(file.filename);
            } else {
                openPreview(file);
            }
        };
        tbody.appendChild(row);
    });
}

// FIL D ARIANE LA LA PAUVRE L AUTRE CON L A ABANDONNE SUR L ILE LA
function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';


    const relativePath = path.replace('/Quiz ressources', '');
    const parts = relativePath.split('/').filter(p => p !== '');

    // lien racine
    const root = document.createElement('span');
    root.style.cursor = 'pointer';
    root.onclick = () => void listFiles('/Quiz ressources');

    const img = document.createElement('img');
    img.src = '../img/maison.png';
    img.style.height = '15px';
    img.style.verticalAlign = 'middle';

    root.appendChild(img);
    breadcrumb.appendChild(root);

    let builtPath = '';
    parts.forEach(part => {
        builtPath += '/' + part;
        const sep = document.createElement('span');
        sep.textContent = ' / ';
        breadcrumb.appendChild(sep);

        const link = document.createElement('span');
        link.textContent = part;
        link.style.cursor = 'pointer';
        const pathCopy = builtPath;
        link.onclick = () => void listFiles(pathCopy);
        breadcrumb.appendChild(link);
    });
}

// retour en arriere
function ArriereMecreant() {
    if (currentPath === '/') return;

    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    listFiles(parentPath);
}
// retour au launcher
function toLauncher() {
    ipcRenderer.send('launcher')
}


// -------------------------- EDIT --------------------------------

function getDestFolder(mime) {
    if (mime.startsWith('image/')) return '/Quiz ressources/images';
    if (mime.startsWith('audio/')) return '/Quiz ressources/musiques';
    if (mime.startsWith('video/')) return '/Quiz ressources/videos';
    if (mime.startsWith('text/') || mime === 'application/json') return '/Quiz ressources/questions';
    return null;
}

async function uploadFiles(files) {
    for (const file of Array.from(files) as File[]) {
        const folder = getDestFolder(file.type);
        console.log('fichier:', file.name, 'type:', file.type, 'dossier:', folder);
        console.log('destPath:', folder + '/' + file.name);
        if (!folder) {
            alert(`Type non supporté : ${file.type}`);
            continue;
        }

        const destPath = folder + '/' + file.name;
        const buffer = await file.arrayBuffer();

        try {
            await client.putFileContents(destPath, buffer, { overwrite: false });
            console.log(`${file.name} uploadé dans ${folder}`);
        } catch (e) {
            console.error('Erreur upload :', e);
            alert(`Erreur upload : ${file.name} — ${e.message}`);
        }
    }

    listFiles(currentPath);
    allFiles = [];
    void indexFiles('/');
}

// -------------------------------- SUPPRIMER --------------------------------
async function deleteFile(file) {
    if (!await showConfirm(`Supprimer "${file.basename}" ?`)) return;
    try {
        await client.deleteFile(file.filename);
        listFiles(currentPath);
    } catch (e) {
        alert(`Erreur suppression : ${e.message}`);
    }
}

async function deleteSelected() {
    const checkboxes = document.querySelectorAll('.file-checkbox:checked');
    if (!await showConfirm(`Supprimer ${checkboxes.length} fichier(s) ?`)) return;

    for (const checkbox of Array.from(checkboxes)) {
        const row = checkbox.closest('tr');
        const filename = (row as HTMLElement).dataset.filename;
        console.log('filename à supprimer:', filename);
        try {
            await client.deleteFile(filename);
        } catch (e) {
            console.error('Erreur suppression:', e);
        }
    }
    listFiles(currentPath);
}

function updateDeleteSelectedBtn() {
    const checked = document.querySelectorAll('.file-checkbox:checked').length;
    document.getElementById('delete-selected-btn').style.display =
        checked > 0 ? 'inline-flex' : 'none';
}

function toggleSelectAll() {
    const selectAll = document.getElementById('select-all') as HTMLInputElement;
    document.querySelectorAll('.file-checkbox').forEach(cb => {
        (cb as HTMLInputElement).checked = selectAll.checked;
    });
    updateDeleteSelectedBtn();
}

function showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-modal').style.display = 'flex';

        document.getElementById('confirm-ok').onclick = () => {
            document.getElementById('confirm-modal').style.display = 'none';
            resolve(true);
        };
        document.getElementById('confirm-cancel').onclick = () => {
            document.getElementById('confirm-modal').style.display = 'none';
            resolve(false);
        };
    });
}