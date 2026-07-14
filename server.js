const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 【关键配置1：允许局域网代理访问】
app.set('trust proxy', true);

// 聊天记录文件路径（自动创建）
const CHAT_FILE = path.join(__dirname, 'chat.json');
// 管理员密码文件（自动创建，首次运行会在控制台显示）
const ADMIN_FILE = path.join(__dirname, 'admin.json');

// 初始化聊天文件
if (!fs.existsSync(CHAT_FILE)) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
}
// 初始化管理员密码（首次运行才生成）
if (!fs.existsSync(ADMIN_FILE)) {
  const adminPwd = '123456';
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ password: adminPwd }));
  console.log('\n=========================================');
  console.log('首次运行！管理员密码已生成：');
  console.log(adminPwd);
  console.log('请保存此密码用于清空聊天记录！');
  console.log('=========================================\n');
}

// 读取聊天记录
function readChat() {
  return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
}
// 写入聊天记录
function writeChat(data) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
}
// 读取管理员密码
function readAdmin() {
  return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8')).password;
}

// 静态资源
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 获取历史消息接口
app.get('/api/messages', (req, res) => {
  res.json(readChat().slice(-200)); // 最多返回200条
});

// 清空聊天记录接口（仅管理员）
app.post('/api/clear', (req, res) => {
  const { password } = req.body;
  if (password === readAdmin()) {
    writeChat([]);
    io.emit('clear_chat');
    res.json({ success: true });
  } else {
    res.status(403).json({ error: '密码错误' });
  }
});

// 在线人数统计
let onlineUsers = new Set();

// Socket连接
io.on('connection', (socket) => {
  onlineUsers.add(socket.id);
  io.emit('online_count', onlineUsers.size);

  // 用户加入
  socket.on('join', (user) => {
    socket.broadcast.emit('user_joined', {
      username: user.username,
      message: `${user.username} 加入了聊天室`
    });
  });

  // 接收消息
  socket.on('send_message', (data) => {
    const chat = readChat();
    const msg = {
      id: uuidv4(),
      userId: data.userId,
      username: data.username,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    chat.push(msg);
    writeChat(chat);
    io.emit('new_message', msg);
  });

  // 断开连接
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online_count', onlineUsers.size);
  });
});

// 【关键配置2：绑定所有网络接口，允许局域网访问】
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 聊天室启动成功！`);
  console.log(`📱 自己访问：http://localhost:${PORT}`);
  console.log(`👥 分享给同事：http://你的局域网IP:${PORT}`);
  console.log(`💡 查局域网IP方法：命令行输入 ipconfig 找「IPv4 地址」`);
});
