import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Timeout de 30 minutes pour supporter l'import de 1M users
const TIMEOUT = 30 * 60 * 1000;

const PORT = process.env.PORT || 5000;

app.use('/api', apiRoutes);

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
server.timeout = TIMEOUT;
server.keepAliveTimeout = TIMEOUT;
