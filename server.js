const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Настройка для приема больших файлов (наши Base64 видео до 100мб)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Раздаем наши статические HTML, CSS и JS файлы
app.use(express.static(path.join(__dirname)));

// --- ПРОСТАЯ БАЗА ДАННЫХ (Файл db.json на сервере) ---
const dbFile = path.join(__dirname, 'db.json');

// Создаем базу, если ее еще нет
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: [], videos: [], comments: [] }));
}

const readDB = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
const writeDB = (data) => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));

// --- API РОУТЫ (Наш Бэкенд) ---

// 1. Получить всю базу целиком (для синхронизации при загрузке)
app.get('/api/database', (req, res) => {
    res.json(readDB());
});

// 2. Зарегистрировать или обновить юзера (лайки, подписки, аватарка)
app.post('/api/users', (req, res) => {
    const db = readDB();
    const userIndex = db.users.findIndex(u => u.login === req.body.login);
    if (userIndex > -1) {
        db.users[userIndex] = req.body; // Обновляем
    } else {
        db.users.push(req.body); // Создаем нового
    }
    writeDB(db);
    res.json({ success: true });
});

// 3. Добавить, обновить или удалить видео
app.post('/api/videos', (req, res) => {
    const db = readDB();
    const { action, video, videoId } = req.body;
    
    if (action === 'add') db.videos.push(video);
    if (action === 'update') {
        const idx = db.videos.findIndex(v => v.id === video.id);
        if (idx > -1) db.videos[idx] = video;
    }
    if (action === 'delete') db.videos = db.videos.filter(v => v.id !== videoId);
    
    writeDB(db);
    res.json({ success: true });
});

// 4. Синхронизировать комментарии
app.post('/api/comments', (req, res) => {
    const db = readDB();
    db.comments = req.body.comments; // Просто перезаписываем массив комментов
    writeDB(db);
    res.json({ success: true });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`[YouTok Server] Успешно запущен на порту ${PORT}!`);
});