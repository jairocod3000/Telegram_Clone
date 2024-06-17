const express = require('express');
const http = require('http');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración para la carga de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Define el destino de los archivos subidos
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });


app.use(bodyParser.json());
// Sirve archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));
// Configuración de las sesiones
app.use(session({
    secret: 'secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false } 
}));

// Ruta POST para iniciar sesión
app.post('/login', (req, res) => {
    const { name, status, avatar } = req.body;
    req.session.user = { name, status, avatar };
    res.json({ loggedIn: true });
});

// Ruta POST para subir avatares
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    const avatarUrl = `/uploads/${req.file.filename}`;
    res.json({ avatarUrl });
});

// Ruta POST para subir archivos
app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        const filePath = `/uploads/${req.file.filename}`;
        res.json({ success: true, filePath: filePath, fileType: req.file.mimetype });
    } else {
        res.status(400).json({ success: false, message: 'No file uploaded' });
    }
});

// Ruta GET para verificar la sesión del usuario
app.get('/session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

let connectedUsers = {};

// Manejo de conexiones WebSocket
io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado');

    // Manejar evento 'join'
    socket.on('join', ({ name, avatar }) => {
        connectedUsers[socket.id] = { name, avatar, socketId: socket.id };
        socket.broadcast.emit('user-connected', { name, avatar });
        io.emit('update-user-list', connectedUsers);
    });

    // Manejar desconexiones
    socket.on('disconnect', () => {
        if (connectedUsers[socket.id]) {
            io.emit('user-disconnected', connectedUsers[socket.id]);
            delete connectedUsers[socket.id];
            io.emit('update-user-list', connectedUsers);
        }
    });

    // Manejar mensajes de chat
    socket.on('chat-message', (msg) => {
        io.emit('chat-message', { name: connectedUsers[socket.id].name, message: msg.message });
    });

    // Manejar notificaciones de que alguien está escribiendo
    socket.on('typing', (name) => {
        socket.broadcast.emit('typing', name);
    });

    // Manejar mensajes privados
    socket.on('private-message', ({ toUserName, message }) => {
        const recipient = Object.values(connectedUsers).find(user => user.name === toUserName);
        if (recipient) {
            io.to(recipient.socketId).emit('private-message', { from: connectedUsers[socket.id].name, message });
        } else {
            console.log('Destinatario no encontrado');
        }
    });

    // Manejar mensajes de archivo
    socket.on('file-message', ({ filePath, fileType }) => {
        io.emit('file-message', { filePath, fileType });
    });
});

// Para inicciar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
