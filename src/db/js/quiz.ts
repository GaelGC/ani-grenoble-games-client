// Tous les fichiers audio/image indexés depuis Nextcloud
let qmAllFiles: any[] = [];
let formType: string | null = null;

let formData: any = {};
let activeImageSlot: number | null = null;

var quizName: string = '';
var questions: any[] = [];


const QM_LABELS: Record<string, string> = { BlindTestQuestion: 'Blind test', ImagesQuestion: 'Images ×4', QuoteQuestion: 'Citation' };
const QM_CLASSES: Record<string, string> = { BlindTestQuestion: 'qm-bt', ImagesQuestion: 'qm-im', QuoteQuestion: 'qm-qu' };



// OUVERTURE / FERMETURE DU QUIZ MAKER

// Affiche la modale de saisie du nom du quiz (avant d'ouvrir le quiz maker)
function openQuizMakerPrompt() {
    const modal = document.getElementById('quiz-name-modal');
    const input = document.getElementById('quiz-name-input') as HTMLInputElement;
    input.value = '';
    modal.style.display = 'flex';
    input.focus();
    input.onkeydown = (e) => { if (e.key === 'Enter') confirmQuizName(); };
}

// Valide le nom saisi dans la modale et ouvre le quiz maker */
function confirmQuizName() {
    const input = document.getElementById('quiz-name-input') as HTMLInputElement;
    const name = input.value.trim();
    if (!name) return;
    quizName = name;
    document.getElementById('quiz-name-modal').style.display = 'none';
    openQuizMaker(false);
}

// Ouvre le quiz maker : cache l'explorateur de fichiers, affiche l'interface quiz
async function openQuizMaker(keepQuestions: boolean = false) {
    qmAllFiles = [];
    if (!keepQuestions) questions = [];
    document.getElementById('qm-filename').textContent = quizName + '.json';
    document.getElementById('DB_rec').style.display = 'none';
    document.getElementById('quiz-maker').style.display = 'block';
    qmRenderTree('/Quiz ressources');
    await qmIndexAll('/Quiz ressources');
    if (keepQuestions) qmCheckMissingFiles();
    else qmRenderList();
}

function closeQuizMaker() {
    document.getElementById('quiz-maker').style.display = 'none';
    document.getElementById('DB_rec').style.display = 'block';
}


// SIDEBAR GAUCHE — ARBORESCENCE NEXTCLOUD
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

            // Au clic : charge les enfants si pas encore fait, puis toggle l'affichage
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

// Charge les fichiers audio et image d'un dossier Nextcloud et les affiche dans le container.
async function qmLoadChildren(path: string, container: HTMLElement) {
    const response = await client.getDirectoryContents(path, {
        data: `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
                <d:getcontenttype/>
                <d:resourcetype/>
                <oc:fileid/>
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

// Indexe récursivement tous les fichiers audio/image depuis un chemin Nextcloud.
async function qmIndexAll(path: string) {
    const response = await client.getDirectoryContents(path, {
        data: `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
                <d:getcontenttype/>
                <d:resourcetype/>
                <oc:fileid/>
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


// Retrouve un fichier dans qmAllFiles à partir de son fileid Nextcloud.
// Retourne null si le fichier n'existe pas (supprimé ou non indexé).
function qmGetFileByFileid(fileid: number): any {
    if (!fileid) return null;
    return qmAllFiles.find(f => f.props?.fileid === fileid);
}


// Gère le clic sur un fichier dans la sidebar.
// Selon le type de question, assigne le fichier au bon champ du formulaire
function qmFileClick(file: any) {
    if (!formType) return;

    const mime = file.mime || '';
    const isAudio = mime.startsWith('audio/');
    const isImage = mime.startsWith('image/');

    if (formType === 'BlindTestQuestion') {
        if (isAudio) {
            formData.audio = file.props.fileid;

            // Pré-remplit la réponse avec le nom du fichier audio si vide
            if (!formData.answer) {
                formData.answer = file.basename.replace(/\.[^/.]+$/, '');
            }

            // Cherche automatiquement une image du même nom pour answerImage
            if (!formData.answerImage) {
                const baseName = file.basename.replace(/\.[^/.]+$/, '');
                const matchingImage = qmAllFiles.find(f => {
                    const mime = f.mime || '';
                    if (!mime.startsWith('image/')) return false;
                    const imgBase = f.basename.replace(/\.[^/.]+$/, '');
                    return imgBase === baseName;
                });
                if (matchingImage) {
                    formData.answerImage = matchingImage.props.fileid;
                }
            }
        } else if (isImage) {
            formData.answerImage = file.props.fileid;
        }
        qmRenderForm();

    } else if (formType === 'ImagesQuestion') {
        if (isImage) {
            if (activeImageSlot !== null) {
                // Remplace l'image du slot sélectionné
                formData.images[activeImageSlot] = file.props.fileid;
                activeImageSlot = null;
            } else {
                // Ajoute l'image en fin de liste
                formData.images.push(file.props.fileid);
            }
            qmRenderForm();
        }
    }
}

// Refresh l'arboresence à gauche
function qmRefreshTree() {
    qmAllFiles = [];
    qmRenderTree('/Quiz ressources');
    qmIndexAll('/Quiz ressources');
}


// Filtre les fichiers de la sidebar selon la saisie dans le champ de recherche
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


// FORMULAIRE — CRÉATION / ÉDITION D'UNE QUESTION
function qmShowTypePicker() {
    const picker = document.getElementById('qm-type-picker');
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
}

// Ouvre le formulaire pour créer une nouvelle question du type choisi
function qmOpenForm(type: string) {
    formType = type;
    formData = type === 'BlindTestQuestion' ? { audio: '', answerImage: '', answer: '' }
        : type === 'ImagesQuestion'    ? { images: [], answer: '' }
            :                               { text: '', hints: [''], answer: '' };

    document.getElementById('qm-neutral').style.display = 'none';
    document.getElementById('qm-type-picker').style.display = 'none';
    document.getElementById('qm-form').style.display = 'flex';

    document.getElementById('qm-form-badge').innerHTML = '<span class="qm-badge ' + QM_CLASSES[type] + '">' + QM_LABELS[type] + '</span>';
    document.getElementById('qm-editing-label').textContent = '';
    document.getElementById('qm-submit-btn').textContent = 'Ajouter à la liste →';

    qmRenderForm();
}

// Génèe un formulaire en fonction du type de question choisi
function qmRenderForm() {
    const body = document.getElementById('qm-form-body');
    body.innerHTML = '';

    if (formType === 'BlindTestQuestion') {
        const audioFile = qmGetFileByFileid(formData.audio);
        const imageFile = qmGetFileByFileid(formData.answerImage);
        const audioDiv = document.createElement('div');
        audioDiv.innerHTML = '<div class="qm-field-label">Fichier audio</div>';
        const audioField = document.createElement('div');
        audioField.className = 'qm-ffile ' + (formData.audio ? (audioFile ? 'qm-filled' : 'qm-missing-file') : '');
        audioField.innerHTML = '<span>♫</span><span>' + (audioFile ? audioFile.basename : (formData.audio ? 'Fichier supprimé' : '<- Sélectionne une musique à gauche')) + '</span>';
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
        if (audioFile) {
            qmLoadPreview(audioFile.filename, audioFile.mime, audioPreview);
        }
        body.appendChild(audioDiv);

        const imageDiv = document.createElement('div');
        imageDiv.innerHTML = '<div class="qm-field-label">Image réponse <span style="opacity:0.4;text-transform:none;font-size:10px">— optionnel</span></div>';
        const imageField = document.createElement('div');
        imageField.className = 'qm-ffile ' + (formData.answerImage ? (imageFile ? 'qm-filled' : 'qm-missing-file') : '');
        imageField.innerHTML = '<span>🖼</span><span>' + (imageFile ? imageFile.basename : (formData.answerImage ? 'Fichier supprimé' : '<- Sélectionne une image à gauche')) + '</span>';
        if (formData.answerImage) {
            const clr = document.createElement('span');
            clr.className = 'qm-clr';
            clr.textContent = '×';
            clr.onclick = () => qmClearField('answerImage');
            imageField.appendChild(clr);
        }
        const imagePreview = document.createElement('div');
        imagePreview.classList.add('qm-preview-small');
        imageDiv.appendChild(imageField);
        imageDiv.appendChild(imagePreview);
        if (imageFile) {
            qmLoadPreview(imageFile.filename, imageFile.mime, imagePreview);
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
        formData.images.forEach((fileid: number, i: number) => {
            grid.appendChild(qmCreateImageSlot(fileid, i));
        });
        const addBtn = document.createElement('button');
        addBtn.className = 'qm-add-hint';
        addBtn.textContent = '+ Ajouter une image';
        addBtn.onclick = () => { formData.images.push(null); qmRenderForm(); };
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


// Crée un slot image cliquable pour ImagesQuestion.
function qmCreateImageSlot(fileid: number | null, i: number): HTMLElement {
    const file = qmGetFileByFileid(fileid);
    const wrapper = document.createElement('div');

    const slot = document.createElement('div');
    slot.className = 'qm-ffile ' + (fileid ? (file ? 'qm-filled' : 'qm-missing-file') : '');
    const icon = document.createElement('span');
    icon.textContent = '🖼️';
    const label = document.createElement('span');
    label.textContent = file ? file.basename : (fileid ? '⚠ Fichier supprimé' : 'Image ' + (i + 1));
    slot.appendChild(icon);
    slot.appendChild(label);
    if (fileid) {
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
    if (fileid && file) {
        qmLoadPreview(file.filename, file.mime, preview);
    }

    wrapper.onclick = () => {
        activeImageSlot = i;
        document.querySelectorAll('.qm-img-active').forEach(el => el.classList.remove('qm-img-active'));
        wrapper.classList.add('qm-img-active');
    };

    return wrapper;
}

// Vide un champ du formulaire
function qmClearField(key: string) {
    formData[key] = '';
    qmRenderForm();
}

// Annule le formulaire en cours et réaffiche l'écran neutre */
function qmCancelForm() {
    formType = null;
    formData = {};
    document.getElementById('qm-form').style.display = 'none';
    document.getElementById('qm-neutral').style.display = 'flex';
}

// Charge et affiche un aperçu (audio ou image) d'un fichier Nextcloud dans un container HTML.
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


// ============================================================
// COLONNE DROITE — LISTE DES QUESTIONS
// ============================================================

// Valide et soumet le formulaire : crée une nouvelle question et l'ajoute à la liste.
async function qmSubmitForm() {
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

    let hints: string[] = [];
    if (formType === 'BlindTestQuestion' && formData.audio) {
        console.log('formData.audio :', formData.audio);
        console.log('type :', typeof formData.audio);
        const metadata = await ipcRenderer.invoke('db:get-metadata', formData.audio);
        console.log('metadata :', metadata);
        if (metadata) {
            if (metadata.artiste) hints.push(metadata.artiste);
            if (metadata.annee) hints.push(String(metadata.annee));
            if (metadata.genre) hints.push(metadata.genre);
            if (metadata.indice) hints.push(metadata.indice);
        }
    } else {
        hints = formData.hints || [];
    }

    const question = {
        name: 'ID_' + Math.random().toString(16).slice(2, 10),
        type: formType,
        point: 1,
        hints,
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
    qmAutoSave();
}

// Affiche la liste des questions dans la colonne de droite.
function qmRenderList() {
    const body = document.getElementById('qm-list-body');
    const count = document.getElementById('qm-q-count');
    count.textContent = questions.length ? '(' + questions.length + ')' : '';

    if (!questions.length) {
        body.innerHTML = '<div id="qm-list-empty">Aucune question pour le moment</div>';
        return;
    }

    body.innerHTML = '';

    questions.forEach((q, i) => {
        const item = document.createElement('div');
        item.className = 'qm-q-item' + (q.hasMissingFiles ? ' qm-missing' : '');

        // Sous-titre affiché sous la réponse selon le type
        let sub = '';
        if (q.type === 'BlindTestQuestion' && q.path) {
            const audioFile = qmGetFileByFileid(q.path);
            sub = audioFile ? audioFile.basename : '';
        }
        else if (q.type === 'ImagesQuestion') sub = q.images.length + ' image(s)';
        else if (q.type === 'QuoteQuestion' && q.text) sub = q.text.substring(0, 28) + '…';

        item.innerHTML = `
            <div class="qm-q-meta">
                <span class="qm-badge ${QM_CLASSES[q.type]}">${QM_LABELS[q.type]}</span>
                <div class="qm-q-name">${q.answer}</div>
                ${sub ? '<div class="qm-q-sub">' + sub + '</div>' : ''}
            </div>
            <span class="qm-q-del">×</span>`;

        item.querySelector('.qm-q-del').addEventListener('click', (e) => {
            e.stopPropagation();
            questions.splice(i, 1);
            qmRenderList();
            qmAutoSave();
        });

        item.onclick = () => qmEditQuestion(i);
        body.appendChild(item);
    });
}

// Ouvre le formulaire en mode édition pour une question existante. Charge les données de la question
function qmEditQuestion(i: number) {
    const q = questions[i];
    formType = q.type;
    formData = JSON.parse(JSON.stringify(q));

    // Pour BlindTest, remet les champs audio/answerImage dans formData
    if (formType === 'BlindTestQuestion') {
        formData.audio = q.path;
        formData.answerImage = q.answerImage || '';
    }

    document.getElementById('qm-neutral').style.display = 'none';
    document.getElementById('qm-form').style.display = 'flex';

    document.getElementById('qm-form-badge').innerHTML = '<span class="qm-badge ' + QM_CLASSES[formType] + '">' + QM_LABELS[formType] + '</span>';
    document.getElementById('qm-editing-label').textContent = 'Édition Q' + (i + 1);
    document.getElementById('qm-submit-btn').textContent = 'Sauvegarder';

    const editingIdx = i;
    document.getElementById('qm-submit-btn').onclick = () => qmSaveEdit(editingIdx);

    qmRenderForm();
}

// Sauvegarde les modifications
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
    qmAutoSave();
}


// LA FONCTION POUR EXPORTER
async function exportQuiz() {
    if (!questions.length) {
        alert('Aucune question à exporter');
        return;
    }

    const files: { destPath: string, buffer: number[] }[] = [];

    for (const q of questions) {
        if (q.type === 'BlindTestQuestion') {
            if (q.path) {
                const audioFile = qmGetFileByFileid(q.path);
                if (audioFile) {
                    const buffer = await client.getFileContents(audioFile.filename) as ArrayBuffer;
                    files.push({
                        destPath: 'BT/musiques/' + audioFile.basename,
                        buffer: Array.from(new Uint8Array(buffer))
                    });
                }
            }
            if (q.answerImage) {
                const imageFile = qmGetFileByFileid(q.answerImage);
                if (imageFile) {
                    const buffer = await client.getFileContents(imageFile.filename) as ArrayBuffer;
                    files.push({
                        destPath: 'BT/images/' + imageFile.basename,
                        buffer: Array.from(new Uint8Array(buffer))
                    });
                }
            }
        } else if (q.type === 'ImagesQuestion') {
            for (let i = 0; i < q.images.length; i++) {
                const imgFile = qmGetFileByFileid(q.images[i]);
                if (!imgFile) continue;
                const buffer = await client.getFileContents(imgFile.filename) as ArrayBuffer;
                const ext = imgFile.basename.split('.').pop();
                files.push({
                    destPath: '4images/' + q.answer + '/' + (i + 1) + '.' + ext,
                    buffer: Array.from(new Uint8Array(buffer))
                });
            }
        }
    }

    // Convertit les fileids en chemins locaux
    const exportedQuestions = questions.map(q => {
        if (q.type === 'BlindTestQuestion') {
            const audioFile = qmGetFileByFileid(q.path);
            const imageFile = qmGetFileByFileid(q.answerImage);
            return {
                ...q,
                path: audioFile ? 'question://BT\\musiques\\' + audioFile.basename : '',
                answerImage: imageFile ? 'question://BT\\images\\' + imageFile.basename : undefined
            };
        } else if (q.type === 'ImagesQuestion') {
            return {
                ...q,
                images: q.images.map((fileid: number, i: number) => {
                    const imgFile = qmGetFileByFileid(fileid);
                    if (!imgFile) return '';
                    const ext = imgFile.basename.split('.').pop();
                    return 'question://4images\\' + q.answer + '\\' + (i + 1) + '.' + ext;
                })
            };
        }
        return q;
    });

    const json = JSON.stringify({ questions: exportedQuestions }, null, 2);
    files.push({
        destPath: 'questions.json',
        buffer: Array.from(new TextEncoder().encode(json))
    });

    const citations = questions.filter(q => q.type === 'QuoteQuestion');
    if (citations.length) {
        let txt = '';
        citations.forEach(q => {
            txt += 'Question : ' + q.text + '\n\nRéponse : ' + q.answer + '\n\n';
        });
        files.push({
            destPath: 'questions/citations.txt',
            buffer: Array.from(new TextEncoder().encode(txt))
        });
    }

    const result = await ipcRenderer.invoke('quiz:export', { quizName, files });
    if (!result.cancelled) {
        alert('Export terminé ! Dossier : ' + result.exportPath);
    }
}


// MODALE DE CRÉATION / CHARGEMENT DE QUIZ
function switchQuizTab(tab: string) {
    document.getElementById('quiz-tab-create').style.display = tab === 'create' ? 'flex' : 'none';
    document.getElementById('quiz-tab-edit').style.display = tab === 'edit' ? 'flex' : 'none';
    document.querySelectorAll('.quiz-modal-tab').forEach((el, i) => {
        el.classList.toggle('active', (i === 0 && tab === 'create') || (i === 1 && tab === 'edit'));
    });
    if (tab === 'edit') qmLoadExistingQuizes();
}

// Charge et affiche la liste des quiz existants
async function qmLoadExistingQuizes() {
    const container = document.getElementById('quiz-list-existing');
    container.innerHTML = '<div style="opacity:0.4;font-size:12px;padding:4px">Chargement...</div>';

    try {
        const response = await client.getDirectoryContents('/Quiz ressources/quizs', {
            details: true
        });
        const jsons = response.data.filter(f => f.mime === 'application/json');

        container.innerHTML = '';
        if (!jsons.length) {
            container.innerHTML = '<div style="opacity:0.4;font-size:12px;padding:4px">Aucun quiz trouvé</div>';
            return;
        }

        jsons.forEach(file => {
            const item = document.createElement('div');
            item.className = 'quiz-existing-item';
            item.textContent = file.basename;
            item.onclick = () => loadExistingQuiz(file);
            container.appendChild(item);
        });
    } catch(e) {
        container.innerHTML = '<div style="opacity:0.4;font-size:12px;padding:4px">Erreur de chargement</div>';
    }
}

// Charge un quiz existant
async function loadExistingQuiz(file: any) {
    try {
        const content = await client.getFileContents(file.filename, { format: 'text' }) as string;
        const data = JSON.parse(content);
        questions = data.questions || [];
        quizName = file.basename.replace('.json', '');
        document.getElementById('quiz-name-modal').style.display = 'none';
        openQuizMaker(true);
        qmRenderList();
    } catch(e) {
        console.error('Erreur chargement quiz :', e);
    }
}


// SAUVEGARDE AUTOMATIQUE

let autoSaveTimeout: any = null;

function qmAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        const json = JSON.stringify({ questions }, null, 2);
        const path = '/Quiz ressources/quizs/' + quizName + '.json';
        try {
            await client.putFileContents(path, json, { overwrite: true });
            document.getElementById('qm-filename').textContent = quizName + '.json ✓';
            setTimeout(() => {
                document.getElementById('qm-filename').textContent = quizName + '.json';
            }, 2000);
        } catch(e) {
            console.error('Erreur autosauvegarde :', e);
            document.getElementById('qm-filename').textContent = quizName + '.json ⚠';
        }
    }, 2500);
}


// VÉRIFICATION DES FICHIERS MANQUANTS
function qmCheckMissingFiles() {
    let hasMissing = false;

    questions.forEach(q => {
        q.hasMissingFiles = false;

        if (q.type === 'BlindTestQuestion') {
            if (q.path && !qmGetFileByFileid(q.path)) q.hasMissingFiles = true;
            if (q.answerImage && !qmGetFileByFileid(q.answerImage)) q.hasMissingFiles = true;
        } else if (q.type === 'ImagesQuestion') {
            q.images.forEach((fileid: number) => {
                if (fileid && !qmGetFileByFileid(fileid)) q.hasMissingFiles = true;
            });
        }

        if (q.hasMissingFiles) hasMissing = true;
    });

    if (hasMissing) {
        alert('⚠ Un ou plusieurs éléments de ce quiz ont été supprimés.');
    }

    qmRenderList();
}