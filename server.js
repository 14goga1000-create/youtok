const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздаем наши статические HTML, CSS и JS файлы
app.use(express.static(path.join(__dirname)));

// Запуск сервера
app.listen(PORT, () => {
    console.log(`[YouTok Server] Успешно запущен на порту ${PORT}!`);
});