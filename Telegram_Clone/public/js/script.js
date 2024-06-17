// Establece conexión con el servidor utilizando Socket.io
const socket = io();

// Evento para detectar cuando el usuario está escribiendo y emite esta información
document.getElementById('chatMessage').addEventListener('input', () => {
    socket.emit('typing', { name: JSON.parse(localStorage.getItem('user')).name });
});

// Función para manejar el proceso de inicio de sesión
function login(event) {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const status = document.getElementById('status').value;
    const fileInput = document.getElementById('avatarUpload');
    const radioInput = document.querySelector('input[name="avatar"]:checked');
    let avatar;

    if (fileInput.files.length > 0) {
        
        const formData = new FormData();
        formData.append('avatar', fileInput.files[0]);
        formData.append('name', name);
        formData.append('status', status);

        axios.post('/upload-avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }).then(response => {
            avatar = response.data.avatarUrl;
            continueLogin(name, status, avatar);
        }).catch(error => console.error('Error uploading avatar:', error));
    } else if (radioInput) {
        // Use selected avatar
        avatar = radioInput.value;
        continueLogin(name, status, avatar);
    } else {
        alert('Please select an avatar or upload an image.');
    }
}

// Función para continuar el proceso de inicio de sesión una vez seleccionado o subido el avatar
function continueLogin(name, status, avatar) {
    localStorage.setItem('user', JSON.stringify({ name, status, avatar }));
    socket.emit('join', { name, avatar });
    document.getElementById('welcome').textContent = 'Welcome, ' + name;
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('mainPage').style.display = 'block';
}

// Actualización de la lista de usuarios conectados
socket.on('update-user-list', (users) => {
    const userList = document.getElementById('userList').querySelector('ul');
    userList.innerHTML = '';
    Object.values(users).forEach(user => {
        const userElement = document.createElement('li');
        const avatarImg = document.createElement('img');
        avatarImg.src = user.avatar;  // Ensure avatar URL is correct
        avatarImg.classList.add('avatar');
        userElement.appendChild(avatarImg);
        userElement.append(user.name);
        userElement.addEventListener('click', () => openPrivateChat(user.name));
        userList.appendChild(userElement);
    });
});

// Abrir el modal para chat privado
function openPrivateChat(userName) {
    document.getElementById('privateChatModal').style.display = 'block';
    document.getElementById('privateChatHeader').textContent = `Chat Privado con ${userName}`;
    document.getElementById('privateMessages').innerHTML = '';  // Limpiar mensajes anteriores

    // Configura el botón de enviar mensaje y el de cerrar aquí:
    document.getElementById('sendPrivateMessage').onclick = () => sendPrivateMessage(userName);
    document.getElementById('closePrivateChat').onclick = closePrivateChat;
}

// Enviar un mensaje privado
function sendPrivateMessage(toUserName) {
    const messageInput = document.getElementById('privateMessageInput');
    const message = messageInput.value;
    if (message.trim() === '') return; // No enviar mensajes vacíos
    socket.emit('private-message', { toUserName, message });
    messageInput.value = '';
    appendMessageToPrivateChat('You', message);
}


socket.on('private-message', ({ from, message }) => {
    if (document.getElementById('privateChatModal').style.display === 'block' &&
        document.getElementById('privateChatHeader').textContent.includes(from)) {
        appendMessageToPrivateChat(from, message);
    } else {
        updateUnreadMessages(from);
    }
});


// Añadir mensajes al chat privado

function appendMessageToPrivateChat(from, message) {
    const messagesContainer = document.getElementById('privateMessages');
    const messageElement = document.createElement('div');
    messageElement.textContent = `${from}: ${message}`;
    messagesContainer.appendChild(messageElement);
}

// Cerrar el chat privado
function closePrivateChat() {
    document.getElementById('privateChatModal').style.display = 'none';
}

function sendMessage() {
    const messageInput = document.getElementById('chatMessage');
    const message = messageInput.value;
    if (message.trim() !== '') {
        const user = JSON.parse(localStorage.getItem('user'));
        socket.emit('chat-message', { message, name: user.name });
        messageInput.value = '';
    }
}

// Enviar mensaje en el chat general
socket.on('chat-message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${data.name}: ${data.message}`;
    document.getElementById('messages').appendChild(messageElement);
});

// Para manejar la conexión de usuarios
socket.on('user-connected', (user) => {
    const connectMsg = document.createElement('div');
    connectMsg.textContent = `${user.name} has connected`;
    document.getElementById('messages').appendChild(connectMsg);
});

// y esto para la desconexión de usuarios
socket.on('user-disconnected', (user) => {
    const disconnectMsg = document.createElement('div');
    disconnectMsg.textContent = `${user.name} has disconnected`;
    document.getElementById('messages').appendChild(disconnectMsg);
});

// Mostrar cuando un usuario está escribiendo
socket.on('typing', (data) => {
    document.getElementById('typing').textContent = `${data.name} esta escribiendo...`;
    setTimeout(() => { document.getElementById('typing').textContent = ''; }, 3000);
});

// Actualizar mensajes no leídos en la lista de usuarios
function updateUnreadMessages(from) {
    const userElements = document.querySelectorAll('#userList li');
    userElements.forEach(el => {
        if (el.textContent.includes(from)) {
            let badge = el.querySelector('.unread-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.classList.add('unread-badge');
                badge.textContent = '(Nuevo mensaje)';
                el.appendChild(badge);

                // esto lo pongo para que en 6 segundos se borre la notificación de nuevo mensaje
                setTimeout(() => {
                    el.removeChild(badge);
                }, 6000);
            }
        }
    });
}

// Función para subir y enviar archivos
function sendFile() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        axios.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }).then(response => {
            if (response.data.success) {
                // Emitir evento para enviar el archivo a otros usuarios
                socket.emit('file-message', { filePath: response.data.filePath, fileType: fileInput.files[0].type });
            }
        }).catch(error => console.error('Error uploading file:', error));
    }
}

// Mostrar archivos enviados en el chat
socket.on('file-message', ({ filePath, fileType }) => {
    const messageElement = document.createElement('div');
    if (fileType.startsWith('image/')) {
        const image = new Image();
        image.src = filePath;
        image.style.maxWidth = '200px';
        image.style.maxHeight = '200px';
        messageElement.appendChild(image);
    } else {
        const link = document.createElement('a');
        link.href = filePath;
        link.textContent = 'Descargar Archivo';
        link.download = true;
        messageElement.appendChild(link);
    }
    document.getElementById('messages').appendChild(messageElement);
});