const BaseModel = require('./BaseModel');

class Document extends BaseModel {
    constructor(db) {
        super(db, 'documents');
    }

    async findOrCreate({ where, defaults }) {
        let doc = await this.findOne({ where });
        if (doc) return [doc, false];
        const data = { ...defaults, ...where };
        const created = await this.create(data);
        return [created, true];
    }

    async create(data) {
        // Adjust columns as needed for your schema
        const stmt = this.db.prepare(
            `INSERT INTO documents (title, project_id, has_ocr_text, status, created_by)
             VALUES (?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
            data.title,
            data.projectId,
            data.hasOcrText ? 1 : 0,
            data.status,
            data.createdBy
        );
        return { id: info.lastInsertRowid, ...data };
    }

    async bulkCreate(docs) {
        const stmt = this.db.prepare(
            `INSERT INTO documents (title, project_id, has_ocr_text, status, created_by)
             VALUES (?, ?, ?, ?, ?)`
        );
        const insertMany = this.db.transaction((docs) => {
            for (const d of docs) {
                stmt.run(
                    d.title,
                    d.projectId,
                    d.hasOcrText ? 1 : 0,
                    d.status,
                    d.createdBy
                );
            }
        });
        insertMany(docs);
    }
}

module.exports = Document;