let qmAllFiles: any[] = [];
let formType: string | null = null;
let formData: any = {};
let activeImageSlot: number | null = null;

function openQuizMaker() {
    qmAllFiles = [];
    document.getElementById('DB_rec').style.display = 'none';
    document.getElementById('quiz-maker').style.display = 'block';
    qmRenderTree('/Quiz ressources');
    qmIndexAll('/Quiz ressources');
}

function closeQuizMaker() {
    document.getElementById('quiz-maker').style.display = 'none';
    document.getElementById('DB_rec').style.display = 'block';
}

// LA PARTIE A GAUCHE LA AVEC NEXTCLOUD
async function qmRenderTree(path: string) {
    const tree = document.getElementById('qm-tree');
    tree.innerHTML = '<div style="opacity:0.4;font-size:15px;padding:8px">Chargement...</div>';

    const response = await client.getDirectoryContents(path, {
        data: `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
                <d:getcontenttype/>
                <d:resourcetype/>
            </d:prop>
        </d:propfind>`,
        details: true
    });

    tree.innerHTML = '';
    for (const file of response.data) {
        if (file.type === 'directory') {
            const folder = document.createElement('div');
            folder.className = 'qm-folder';
            folder.textContent = '▸' + file.basename;

            const children = document.createElement('div');
            children.style.display = 'none';
            children.style.paddingLeft = '12px';

            folder.onclick = async () => {
                if (children.style.display === 'none') {
                    if (children.innerHTML === '') {
                        await qmLoadChildren(file.filename, children);
                    }
                    children.style.display = 'block';
                    folder.textContent = '▾' + file.basename;
                } else {
                    children.style.display = 'none';
                    folder.textContent = '▸' + file.basename;
                }
            };

            tree.appendChild(folder);
            tree.appendChild(children);
        }
    }
}

async function qmLoadChildren(path: string, container: HTMLElement) {
    const response = await client.getDirectoryContents(path, {
        data: `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
                <d:getcontenttype/>
                <d:resourcetype/>
            </d:prop>
        </d:propfind>`,
        details: true
    });

    for (const file of response.data) {
        const mime = file.mime || '';
        if (!mime.startsWith('audio/') && !mime.startsWith('image/')) continue;
        qmAllFiles.push(file);
        const div = document.createElement('div');
        div.className = 'qm-file';
        div.textContent = file.basename;
        div.onclick = () => qmFileClick(file);
        container.appendChild(div);
    }
}

async function qmIndexAll(path: string) {
    const response = await client.getDirectoryContents(path, {
        data: `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
                <d:getcontenttype/>
                <d:resourcetype/>
            </d:prop>
        </d:propfind>`,
        details: true
    });

    for (const file of response.data) {
        if (file.type === 'directory') {
            await qmIndexAll(file.filename);
        } else {
            const mime = file.mime || '';
            if (mime.startsWith('audio/') || mime.startsWith('image/')) {
                qmAllFiles.push(file);
            }
        }
    }
}

function qmFileClick(file: any) {
    if (!formType) return;

    const mime = file.mime || '';
    const isAudio = mime.startsWith('audio/');
    const isImage = mime.startsWith('image/');

    if (formType === 'BlindTestQuestion') {
        if (isAudio) {
            formData.audio = file.filename;

            if (!formData.answer) {
                formData.answer = file.basename.replace(/\.[^/.]+$/, '');
            }

            if (!formData.answerImage) {
                const baseName = file.basename.replace(/\.[^/.]+$/, '');
                const matchingImage = qmAllFiles.find(f => {
                    const mime = f.mime || '';
                    if (!mime.startsWith('image/')) return false;
                    const imgBase = f.basename.replace(/\.[^/.]+$/, '');
                    return imgBase === baseName;
                });
                if (matchingImage) {
                    formData.answerImage = matchingImage.filename;
                }
            }
        } else if (isImage) {
            formData.answerImage = file.filename;
        }
        qmRenderForm();

    } else if (formType === 'ImagesQuestion') {
        if (isImage) {
            if (activeImageSlot !== null) {
                formData.images[activeImageSlot] = file.filename;
                activeImageSlot = null;
            } else {
                formData.images.push(file.filename);
            }
            qmRenderForm();
        }
    }
}

function qmRefreshTree() {
    qmAllFiles = [];
    qmRenderTree('/Quiz ressources');
    qmIndexAll('/Quiz ressources');
}

function qmSearch() {
    const query = (document.getElementById('qm-search') as HTMLInputElement).value.toLowerCase().trim();
    const tree = document.getElementById('qm-tree');

    if (query === '') {
        qmRenderTree('/Quiz ressources');
        return;
    }

    const results = qmAllFiles.filter(f =>
        f.basename.toLowerCase().includes(query) &&
        (f.mime?.startsWith('audio/') || f.mime?.startsWith('image/'))
    );

    tree.innerHTML = '';
    results.forEach(file => {
        const div = document.createElement('div');
        div.className = 'qm-file';
        const icon = file.mime?.startsWith('audio/') ? '🎵' : '🖼️';
        div.textContent = icon + ' ' + file.basename;
        div.onclick = () => qmFileClick(file);
        tree.appendChild(div);
    });
}

function qmShowTypePicker() {
    const picker = document.getElementById('qm-type-picker');
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
}

function qmOpenForm(type: string) {
    formType = type;
    formData = type === 'BlindTestQuestion' ? { audio: '', answerImage: '', answer: '' }
        : type === 'ImagesQuestion'    ? { images: [], answer: '' }
            :                               { text: '', hints: [''], answer: '' };

    document.getElementById('qm-neutral').style.display = 'none';
    document.getElementById('qm-type-picker').style.display = 'none';
    document.getElementById('qm-form').style.display = 'flex';

    const labels = { BlindTestQuestion: 'Blind test', ImagesQuestion: 'Images ×4', QuoteQuestion: 'Citation' };
    const classes = { BlindTestQuestion: 'qm-bt', ImagesQuestion: 'qm-im', QuoteQuestion: 'qm-qu' };
    document.getElementById('qm-form-badge').innerHTML = '<span class="qm-badge ' + classes[type] + '">' + labels[type] + '</span>';
    document.getElementById('qm-editing-label').textContent = '';
    document.getElementById('qm-submit-btn').textContent = 'Ajouter à la liste →';

    qmRenderForm();
}

// PARTIE DU MILIEU LA
function qmRenderForm() {
    const body = document.getElementById('qm-form-body');
    body.innerHTML = '';

    if (formType === 'BlindTestQuestion') {
        const audioDiv = document.createElement('div');
        audioDiv.innerHTML = '<div class="qm-field-label">Fichier audio</div>';
        const audioField = document.createElement('div');
        audioField.className = 'qm-ffile ' + (formData.audio ? 'qm-filled' : '');
        audioField.innerHTML = '<span>🎵</span><span>' + (formData.audio ? formData.audio.split('/').pop() : '<- Sélectionne une musique à gauche') + '</span>';
        if (formData.audio) {
            const clr = document.createElement('span');
            clr.className = 'qm-clr';
            clr.textContent = '×';
            clr.onclick = () => qmClearField('audio');
            audioField.appendChild(clr);
        }
        const audioPreview = document.createElement('div');
        audioDiv.appendChild(audioField);
        audioDiv.appendChild(audioPreview);
        if (formData.audio) {
            const mime = qmAllFiles.find(f => f.filename === formData.audio)?.mime || 'audio/mpeg';
            qmLoadPreview(formData.audio, mime, audioPreview);
        }
        body.appendChild(audioDiv);

        const imageDiv = document.createElement('div');
        imageDiv.innerHTML = '<div class="qm-field-label">Image réponse <span style="opacity:0.4;text-transform:none;font-size:10px">— optionnel</span></div>';
        const imageField = document.createElement('div');
        imageField.className = 'qm-ffile ' + (formData.answerImage ? 'qm-filled' : '');
        imageField.innerHTML = '<span>🖼️</span><span>' + (formData.answerImage ? formData.answerImage.split('/').pop() : '<- Sélectionne une image à gauche') + '</span>';
        if (formData.answerImage) {
            const clr = document.createElement('span');
            clr.className = 'qm-clr';
            clr.textContent = '×';
            clr.onclick = () => qmClearField('answerImage');
            imageField.appendChild(clr);
        }
        const imagePreview = document.createElement('div');
        imageDiv.appendChild(imageField);
        imageDiv.appendChild(imagePreview);
        if (formData.answerImage) {
            const mime = qmAllFiles.find(f => f.filename === formData.answerImage)?.mime || 'image/jpeg';
            qmLoadPreview(formData.answerImage, mime, imagePreview);
        }
        body.appendChild(imageDiv);

        const answerDiv = document.createElement('div');
        answerDiv.innerHTML = '<div class="qm-field-label">Réponse</div>';
        const answerInput = document.createElement('input');
        answerInput.className = 'qm-input';
        answerInput.id = 'qm-answer';
        answerInput.type = 'text';
        answerInput.value = formData.answer;
        answerInput.placeholder = 'Titre de la chanson...';
        answerInput.oninput = () => { formData.answer = answerInput.value; };
        answerDiv.appendChild(answerInput);
        body.appendChild(answerDiv);
    } else if (formType === 'ImagesQuestion') {
        const imagesDiv = document.createElement('div');
        imagesDiv.innerHTML = '<div class="qm-field-label">Images</div>';

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '8px';
        grid.style.marginBottom = '8px';

        formData.images.forEach((img: string, i: number) => {
            grid.appendChild(qmCreateImageSlot(img, i));
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'qm-add-hint';
        addBtn.textContent = '+ Ajouter une image';
        addBtn.onclick = () => { formData.images.push(''); qmRenderForm(); };

        imagesDiv.appendChild(grid);
        imagesDiv.appendChild(addBtn);
        body.appendChild(imagesDiv);

        const answerDiv = document.createElement('div');
        answerDiv.innerHTML = '<div class="qm-field-label">Réponse</div>';
        const answerInput = document.createElement('input');
        answerInput.className = 'qm-input';
        answerInput.type = 'text';
        answerInput.value = formData.answer;
        answerInput.placeholder = 'Ce qu\'il faut deviner...';
        answerInput.oninput = () => { formData.answer = answerInput.value; };
        answerDiv.appendChild(answerInput);
        body.appendChild(answerDiv);

    } else if (formType === 'QuoteQuestion') {
        const textDiv = document.createElement('div');
        textDiv.innerHTML = '<div class="qm-field-label">Texte de la citation</div>';
        const textarea = document.createElement('textarea');
        textarea.className = 'qm-input';
        textarea.rows = 3;
        textarea.value = formData.text;
        textarea.oninput = () => { formData.text = textarea.value; };
        textDiv.appendChild(textarea);
        body.appendChild(textDiv);

        const answerDiv = document.createElement('div');
        answerDiv.innerHTML = '<div class="qm-field-label">Réponse</div>';
        const answerInput = document.createElement('input');
        answerInput.className = 'qm-input';
        answerInput.type = 'text';
        answerInput.value = formData.answer;
        answerInput.oninput = () => { formData.answer = answerInput.value; };
        answerDiv.appendChild(answerInput);
        body.appendChild(answerDiv);

        const hintsDiv = document.createElement('div');
        hintsDiv.innerHTML = '<div class="qm-field-label">Indices <span style="opacity:0.4;text-transform:none;font-size:10px">— optionnel</span></div>';
        const hintsList = document.createElement('div');
        hintsList.style.display = 'flex';
        hintsList.style.flexDirection = 'column';
        hintsList.style.gap = '6px';
        formData.hints.forEach((hint: string, i: number) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            const num = document.createElement('span');
            num.style.fontSize = '11px';
            num.style.opacity = '0.4';
            num.style.width = '14px';
            num.textContent = (i + 1) + '.';
            const input = document.createElement('input');
            input.className = 'qm-input';
            input.style.flex = '1';
            input.type = 'text';
            input.value = hint;
            input.placeholder = 'Indice ' + (i + 1) + '...';
            input.oninput = () => { formData.hints[i] = input.value; };
            row.appendChild(num);
            row.appendChild(input);
            hintsList.appendChild(row);
        });
        const addHintBtn = document.createElement('button');
        addHintBtn.className = 'qm-add-hint';
        addHintBtn.textContent = '+ Ajouter un indice';
        addHintBtn.onclick = () => { formData.hints.push(''); qmRenderForm(); };
        hintsDiv.appendChild(hintsList);
        hintsDiv.appendChild(addHintBtn);
        body.appendChild(hintsDiv);
    }
}
function qmCreateImageSlot(img: string, i: number): HTMLElement {
    const wrapper = document.createElement('div');

    const slot = document.createElement('div');
    slot.className = 'qm-ffile ' + (img ? 'qm-filled' : '');
    const icon = document.createElement('span');
    icon.textContent = '🖼️';
    const label = document.createElement('span');
    label.textContent = img ? img.split('/').pop() : 'Image ' + (i + 1);
    slot.appendChild(icon);
    slot.appendChild(label);
    if (img) {
        const clr = document.createElement('span');
        clr.className = 'qm-clr';
        clr.textContent = '×';
        clr.onclick = (e) => {
            e.stopPropagation();
            formData.images.splice(i, 1);
            qmRenderForm();
        };
        slot.appendChild(clr);
    }
    wrapper.appendChild(slot);

    const preview = document.createElement('div');
    wrapper.appendChild(preview);
    if (img) {
        const mime = qmAllFiles.find(f => f.filename === img)?.mime || 'image/jpeg';
        qmLoadPreview(img, mime, preview);
    }

    wrapper.onclick = () => {
        activeImageSlot = i;
        document.querySelectorAll('.qm-img-active').forEach(el => el.classList.remove('qm-img-active'));
        wrapper.classList.add('qm-img-active');
    };

    return wrapper;
}

function qmClearField(key: string) {
    formData[key] = '';
    qmRenderForm();
}

function qmCancelForm() {
    formType = null;
    formData = {};
    document.getElementById('qm-form').style.display = 'none';
    document.getElementById('qm-neutral').style.display = 'flex';
}

async function qmLoadPreview(filename: string, mime: string, container: HTMLElement) {
    container.innerHTML = '<div style="opacity:0.4;font-size:11px;padding:4px">Chargement...</div>';
    try {
        const buffer = await client.getFileContents(filename) as ArrayBuffer;
        const blob = new Blob([buffer], { type: mime });
        const objectUrl = URL.createObjectURL(blob);

        if (mime.startsWith('audio/')) {
            const audio = document.createElement('audio');
            audio.src = objectUrl;
            audio.controls = true;
            audio.style.width = '100%';
            audio.style.marginTop = '6px';
            audio.style.height = '32px';
            container.innerHTML = '';
            container.appendChild(audio);
        } else if (mime.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = objectUrl;
            img.style.width = '75%';
            img.style.height = '75%';
            img.style.objectFit = 'cover';
            container.innerHTML = '';
            container.appendChild(img);
        }
    } catch(e) {
        container.innerHTML = '<div style="opacity:0.4;font-size:11px;padding:4px">Preview indisponible</div>';
    }
}


// LA COLONNE DE DROITE

let questions: any[] = [];

function qmSubmitForm() {
    if (!formData.answer) {
        alert('La réponse est obligatoire');
        return;
    }
    if (formType === 'BlindTestQuestion' && !formData.audio) {
        alert('Un fichier audio est obligatoire');
        return;
    }
    if (formType === 'ImagesQuestion' && formData.images.length === 0) {
        alert('Au moins une image est obligatoire');
        return;
    }

    const question = {
        name: 'ID_' + Math.random().toString(16).slice(2, 10),
        type: formType,
        point: 1,
        hints: formData.hints || [],
        answer: formData.answer,
        ...(formType === 'BlindTestQuestion' && {
            path: formData.audio,
            answerImage: formData.answerImage || undefined
        }),
        ...(formType === 'ImagesQuestion' && {
            images: formData.images
        }),
        ...(formType === 'QuoteQuestion' && {
            text: formData.text
        })
    };

    questions.push(question);
    qmCancelForm();
    qmRenderList();
}

function qmRenderList() {
    const body = document.getElementById('qm-list-body');
    const count = document.getElementById('qm-q-count');
    count.textContent = questions.length ? '(' + questions.length + ')' : '';

    if (!questions.length) {
        body.innerHTML = '<div id="qm-list-empty">Aucune question pour le moment</div>';
        return;
    }

    body.innerHTML = '';
    const labels = { BlindTestQuestion: 'Blind test', ImagesQuestion: 'Images', QuoteQuestion: 'Citation' };
    const classes = { BlindTestQuestion: 'qm-bt', ImagesQuestion: 'qm-im', QuoteQuestion: 'qm-qu' };

    questions.forEach((q, i) => {
        const item = document.createElement('div');
        item.className = 'qm-q-item';

        let sub = '';
        if (q.type === 'BlindTestQuestion' && q.path) sub = q.path.split('/').pop();
        else if (q.type === 'ImagesQuestion') sub = q.images.length + ' image(s)';
        else if (q.type === 'QuoteQuestion' && q.text) sub = q.text.substring(0, 28) + '…';

        item.innerHTML = `
            <div class="qm-q-meta">
                <span class="qm-badge ${classes[q.type]}">${labels[q.type]}</span>
                <div class="qm-q-name">${q.answer}</div>
                ${sub ? '<div class="qm-q-sub">' + sub + '</div>' : ''}
            </div>
            <span class="qm-q-del">×</span>`;

        item.querySelector('.qm-q-del').addEventListener('click', (e) => {
            e.stopPropagation();
            questions.splice(i, 1);
            qmRenderList();
        });

        item.onclick = () => qmEditQuestion(i);
        body.appendChild(item);
    });
}

function qmEditQuestion(i: number) {
    const q = questions[i];
    formType = q.type;
    formData = JSON.parse(JSON.stringify(q));

    if (formType === 'BlindTestQuestion') {
        formData.audio = q.path;
        formData.answerImage = q.answerImage || '';
    }

    document.getElementById('qm-neutral').style.display = 'none';
    document.getElementById('qm-form').style.display = 'flex';

    const labels = { BlindTestQuestion: 'Blind test', ImagesQuestion: 'Images', QuoteQuestion: 'Citation' };
    const classes = { BlindTestQuestion: 'qm-bt', ImagesQuestion: 'qm-im', QuoteQuestion: 'qm-qu' };
    document.getElementById('qm-form-badge').innerHTML = '<span class="qm-badge ' + classes[formType] + '">' + labels[formType] + '</span>';
    document.getElementById('qm-editing-label').textContent = 'Édition Q' + (i + 1);
    document.getElementById('qm-submit-btn').textContent = 'Sauvegarder';

    const editingIdx = i;
    document.getElementById('qm-submit-btn').onclick = () => qmSaveEdit(editingIdx);

    qmRenderForm();
}
function qmSaveEdit(i: number) {
    if (!formData.answer) { alert('La réponse est obligatoire'); return; }

    questions[i] = {
        name: questions[i].name,
        type: formType,
        point: 1,
        hints: formData.hints || [],
        answer: formData.answer,
        ...(formType === 'BlindTestQuestion' && {
            path: formData.audio,
            answerImage: formData.answerImage || undefined
        }),
        ...(formType === 'ImagesQuestion' && {
            images: formData.images
        }),
        ...(formType === 'QuoteQuestion' && {
            text: formData.text
        })
    };

    qmCancelForm();
    qmRenderList();
}