import express from 'express';
import routes from './routes.js';
import 'dotenv/config';

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));

