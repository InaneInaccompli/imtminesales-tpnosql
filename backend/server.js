import express, { json } from 'express';
import cors from 'cors'; // Ensure cors is installed and required
import apiRoutes from './routes/api';

const app = express();
app.use(cors());
app.use(json());

const PORT = 5000;

app.use('/api', apiRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
