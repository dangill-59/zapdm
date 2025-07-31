const BaseModel = require('./BaseModel');

class DocumentPage extends BaseModel {
    constructor(db) {
        super(db, 'document_pages');
    }

    async findOrCreate({ where, defaults }) {
        let page = await this.findOne({ where });
        if (page) return [page, false];
        const data = { ...defaults, ...where };
        const created = await this.create(data);
        return [created, true];
    }

    async create(data) {
        // Adjust columns as needed for your schema
        const stmt = this.db.prepare(
            `INSERT INTO document_pages (document_id, page_number, file_name, ocr_text, status, created_by)
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
        return { id: info.lastInsertRowid, ...data };
    }

    async bulkCreate(pages) {
        const stmt = this.db.prepare(
            `INSERT INTO document_pages (document_id, page_number, file_name, ocr_text, status, created_by)
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