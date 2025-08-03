require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
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

// Conexão com MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('Conectado ao MongoDB Atlas (usuariosdb) - Coleções: lumiere_photos e lumiere_batches'))
.catch(err => {
  console.error('Erro de conexão ao MongoDB:', err.message);
  process.exit(1);
});

// Esquemas específicos para o projeto Lumiere
const photoSchema = new mongoose.Schema({
  public_id: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  url: { type: String, required: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LumiereBatch' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'lumiere_photos' });

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  photos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LumierePhoto' }],
  createdAt: { type: Date, default: Date.now }
}, { collection: 'lumiere_batches' });

// Modelos com prefixo Lumiere
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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rotas
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'honnyfrontend@gmail.com' && password === 'senha123') {
    return res.json({ message: 'Login bem-sucedido!' });
  }
  res.status(401).json({ message: 'Credenciais inválidas' });
});

app.post('/upload', upload.array('photos', 10), async (req, res) => {
  try {
    // Criar um novo batch para este upload
    const batch = await LumiereBatch.create({
      name: `Upload ${new Date().toLocaleString()}`,
      description: `Upload contendo ${req.files.length} arquivo(s)`
    });

    // Processar cada foto e associar ao batch
    const uploadPromises = req.files.map(async file => {
      const photo = await LumierePhoto.create({
        public_id: file.filename,
        filename: file.originalname,
        url: file.path,
        batch_id: batch._id
      });
      
      // Atualizar o batch com a referência da foto
      batch.photos.push(photo._id);
      return photo;
    });

    await Promise.all(uploadPromises);
    await batch.save();

    res.json({ 
      message: `${req.files.length} arquivo(s) enviado(s) com sucesso!`,
      batchId: batch._id 
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro no upload: ' + err.message });
  }
});

app.get('/photos', async (req, res) => {
  try {
    const photos = await LumierePhoto.find()
      .populate('batch_id', 'name description')
      .sort({ createdAt: -1 });
      
    res.json({ photos });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar fotos: ' + err.message });
  }
});

app.get('/batches', async (req, res) => {
  try {
    const batches = await LumiereBatch.find()
      .populate('photos', 'filename url')
      .sort({ createdAt: -1 });
      
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar batches: ' + err.message });
  }
});

// Iniciar servidor
app.listen(process.env.PORT, () => {
  console.log(`Servidor Lumiere rodando na porta ${process.env.PORT}`);
  console.log(`Acesse: http://localhost:${process.env.PORT}`);
});