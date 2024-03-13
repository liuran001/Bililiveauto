const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./temp.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Database opening error: ', err.message);
    } else {
        console.log('Database connected.');
    }
});

// 创建表来存储webhook事件，并添加新列
db.serialize(() => {
    // 初始化创建表格，如果不存在
    db.run(`CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        name TEXT,
        room_id TEXT,
        rec_date TEXT
    )`, (err) => {
        if (err) {
            console.error('Error creating table: ', err.message);
        } else {
            console.log('Table created or already exists.');
        }
    });

    // 在这里不需要额外的操作来添加列，因为 CREATE TABLE IF NOT EXISTS 已经定义了所有必要的列。
    // 如果需要在已存在的表中添加新列，你可以使用 ALTER TABLE 语句，例如：
    // db.run("ALTER TABLE webhook_events ADD COLUMN new_column TEXT");
});

module.exports = db;
