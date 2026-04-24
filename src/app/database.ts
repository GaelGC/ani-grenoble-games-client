import mariadb from 'mariadb';

let connection: mariadb.Connection | null = null;

export async function connectDB(config: {
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
}) {
    connection = await mariadb.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database
    });
    console.log('MariaDB connected !');
}

export async function getFileMetadata(fileid: number) {
    if (!connection) throw new Error('DB non connectée');
    const rows = await connection.query(
        'SELECT * FROM infos WHERE id = ?',
        [fileid]
    );
    return rows[0] || null;
}

export async function setFileMetadata(fileid: number, data: {
    artiste?: string,
    genre?: string,
    annee?: number,
    indice?: string,
    nom_musique?: string
}) {
    if (!connection) throw new Error('DB non connectée');
    await connection.query(
        `INSERT INTO infos (id, artiste, genre, annee, indice, nom_musique)
         VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                                  artiste = VALUES(artiste),
                                  genre = VALUES(genre),
                                  annee = VALUES(annee),
                                  indice = VALUES(indice),
                                  nom_musique = VALUES(nom_musique)`,
        [fileid, data.artiste ?? null, data.genre ?? null, data.annee ?? null, data.indice ?? null, data.nom_musique ?? null]
    );
}