require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');

const app = express();

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// Verificação das variáveis de ambiente
console.log('Iniciando servidor com configuração:');
console.log('PORT:', process.env.PORT);
console.log('CLOUD_NAME:', process.env.CLOUD_NAME ? '***' : 'Não definido');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'mongodb+srv://***' : 'Não definido');

// Conexão com MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://honnyfrontend:vfepaF1m0HEoDnME@cluster0.xlvez.mongodb.net/usuariosdb?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas (usuariosdb)'))
  .catch(err => {
    console.error('❌ Erro de conexão ao MongoDB:', err.message);
    process.exit(1);
  });

// Esquemas do MongoDB
const photoSchema = new mongoose.Schema({
  public_id: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'lumiere_photos' });

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  photos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LumierePhoto' }],
  createdAt: { type: Date, default: Date.now }
}, { collection: 'lumiere_batches' });

const LumierePhoto = mongoose.model('LumierePhoto', photoSchema);
const LumiereBatch = mongoose.model('LumiereBatch', batchSchema);

// Configuração do Multer + Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'lumiere-visuals',
    public_id: `lumiere-${uuidv4()}`,
    transformation: [{ width: 1920, height: 1080, crop: 'limit' }]
  })
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas de Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rotas da API
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'honnyfrontend@gmail.com' && password === 'senha123') {
    return res.json({ success: true, message: 'Login bem-sucedido!' });
  }
  res.status(401).json({ success: false, message: 'Credenciais inválidas' });
});

app.post('/api/upload', upload.array('photos', 10), async (req, res) => {
  try {
    const batch = await LumiereBatch.create({
      name: `Upload ${new Date().toLocaleString()}`,
      description: `Upload com ${req.files.length} arquivo(s)`
    });

    const uploadPromises = req.files.map(async file => {
      const photo = await LumierePhoto.create({
        public_id: file.filename,
        filename: file.originalname,
        url: file.path,
        batch_id: batch._id
      });
      batch.photos.push(photo._id);
      return photo;
    });

    await Promise.all(uploadPromises);
    await batch.save();

    res.json({ 
      success: true,
      message: `${req.files.length} arquivo(s) enviado(s) com sucesso!`,
      batchId: batch._id 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Erro no upload: ' + err.message 
    });
  }
});

app.get('/api/photos', async (req, res) => {
  try {
    const photos = await LumierePhoto.find()
      .populate('batch_id', 'name description')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, photos });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar fotos: ' + err.message 
    });
  }
});

app.get('/api/batches', async (req, res) => {
  try {
    const batches = await LumiereBatch.find()
      .populate('photos', 'filename url')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, batches });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar batches: ' + err.message 
    });
  }
});

// Rota de fallback para 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Lumiere rodando na porta ${PORT}`);
  console.log(`🔗 Acesse: http://localhost:${PORT}`);
});