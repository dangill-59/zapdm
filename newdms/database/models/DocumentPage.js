const BaseModel = require('./BaseModel');

class DocumentPage extends BaseModel {
    constructor(db) {
        super(db, 'pages');
    }

    async findOrCreate({ where, defaults }) {
        let page = await this.findOne({ where });
        if (page) return [page, false];
        const data = { ...defaults, ...where };
        const created = await this.create(data);
        return [created, true];
    }

    async create(data) {
        const stmt = this.db.prepare(
            `INSERT INTO pages (documentId, pageNumber, fileName, ocrText, status, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
            data.documentId,
            data.pageNumber,
            data.fileName,
            data.ocrText,
            data.status,
            data.createdBy
        );
        return { id: info.lastInsertRowid, ...data, documentId: data.documentId };
    }

    async bulkCreate(pages) {
        const stmt = this.db.prepare(
            `INSERT INTO pages (documentId, pageNumber, fileName, ocrText, status, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`
        );
        const insertMany = this.db.transaction((pages) => {
            for (const p of pages) {
                stmt.run(
                    p.documentId,
                    p.pageNumber,
                    p.fileName,
                    p.ocrText,
                    p.status,
                    p.createdBy
                );
            }
        });
        insertMany(pages);
    }
}

module.exports = DocumentPage;