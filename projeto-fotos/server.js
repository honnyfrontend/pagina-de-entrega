const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Conectado ao MongoDB'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Esquema do Mongoose para as fotos
const photoSchema = new mongoose.Schema({
  public_id: {
    type: String,
    required: true,
    unique: true
  },
  filename: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Photo = mongoose.model('Photo', photoSchema);

// Configurar middlewares
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do Multer para upload de arquivos com Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lumiere-visuals-photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 1920, height: 1080, crop: 'limit' }],
    public_id: (req, file) => `photo-${uuidv4()}`
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB
});

// Rota de login simulada
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'honnyfrontend@gmail.com' && password === 'senha123') {
    return res.status(200).json({ message: 'Login bem-sucedido!' });
  } else {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }
});

// Rota de upload de fotos
app.post('/upload', upload.array('photos', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const existingPhoto = await Photo.findOne({ public_id: file.filename });
      if (existingPhoto) {
        throw new Error(`Foto ${file.filename} já existe no sistema.`);
      }

      const newPhoto = new Photo({
        public_id: file.filename,
        filename: file.originalname,
        url: file.path
      });

      return newPhoto.save();
    });

    await Promise.all(uploadPromises);
    res.status(200).json({ message: 'Uploads realizados com sucesso!' });
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ 
      message: err.message || 'Erro no servidor ao processar o upload.' 
    });
  }
});

// Rota para listar fotos
app.get('/photos', async (req, res) => {
  try {
    const photos = await Photo.find({}).sort({ createdAt: -1 });
    
    if (!photos || photos.length === 0) {
      return res.status(200).json({ photos: [], message: 'Nenhuma foto encontrada.' });
    }

    res.status(200).json({ photos });
  } catch (err) {
    console.error('Erro ao buscar fotos:', err);
    res.status(500).json({ message: 'Erro no servidor ao buscar fotos.' });
  }
});

// Rota para download de fotos - VERSÃO CORRIGIDA (ÚNICA ALTERAÇÃO REALIZADA)
app.get('/download/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    const { quality } = req.query;

    if (!publicId) {
      return res.status(400).json({ message: 'ID da foto não fornecido.' });
    }

    const photo = await Photo.findOne({ public_id: publicId });
    if (!photo) {
      return res.status(404).json({ message: 'Foto não encontrada.' });
    }

    // CORREÇÃO: Remove a duplicação do nome da pasta se existir
    const cleanPublicId = publicId.replace('lumiere-visuals-photos/', '');
    const cloudinaryPublicId = `lumiere-visuals-photos/${cleanPublicId}`;
    
    let options = {
      flags: 'attachment',
      secure: true
    };

    if (quality && quality !== 'original') {
      if (quality === 'small') {
        options.width = 720;
        options.quality = 70;
      } else if (quality === 'medium') {
        options.width = 1080;
        options.quality = 80;
      }
    }

    // Gera a URL corretamente formatada
    const downloadUrl = cloudinary.url(cloudinaryPublicId, options);
    
    // Redireciona para a URL do Cloudinary
    res.redirect(downloadUrl);
  } catch (err) {
    console.error('Erro no download:', err);
    res.status(500).json({ message: 'Erro no servidor ao processar o download.' });
  }
});

// Rota para deletar fotos
app.delete('/photos/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({ message: 'ID da foto não fornecido.' });
    }

    // Verifica se a foto existe no banco de dados
    const photo = await Photo.findOne({ public_id: publicId });
    if (!photo) {
      return res.status(404).json({ message: 'Foto não encontrada no banco de dados.' });
    }

    // Tenta deletar do Cloudinary
    const cloudinaryPublicId = `lumiere-visuals-photos/${publicId.replace('lumiere-visuals-photos/', '')}`;
    const cloudinaryResult = await cloudinary.uploader.destroy(cloudinaryPublicId);

    // Deleta do banco de dados independente do resultado do Cloudinary
    await Photo.deleteOne({ public_id: publicId });

    res.status(200).json({ 
      success: true,
      message: 'Foto deletada com sucesso.',
      cloudinaryResult: cloudinaryResult.result
    });

  } catch (err) {
    console.error('Erro ao deletar foto:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erro no servidor ao deletar a foto.',
      error: err.message
    });
  }
});

// Rota para servir o dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rota padrão para qualquer outra requisição
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erro interno no servidor.' });
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});