import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.send('API rodando');
});

//Login

router.post('/auth/login', (req,res) => {

});

router.post('/auth/logout', (req,res) => {
    
});

//Postos

router.get('/postos/me', (req,res) => {
    
}); 

//Usuários

router.get('/postos/:id/usuarios', (req, res) => {

});

router.post('/postos/:id/usuarios', (req, res) => {

});

router.delete('/postos/:id/usuarios/:usuarioId', (req, res) => {

});

router.get('/usuarios/me', (req, res) => {

});

router.put('/usuarios/me', (req, res) => {

});


//Empresas

router.get('/postos/empresas/me', (req, res) => {

});

router.put('/empresas/:id', (req, res) => {

});


//Máquinas

router.get('/postos/:id/maquinas', (req, res) => {

});

router.post('/maquinas', (req, res) => {

});

router.get('/maquinas/:id', (req, res) => {

});


//Operadores


//Fechamentos


//Fechamentos x máquinas


//Fechamentos x empresas


//Divergências


//Observações


//Logs de auditoria


//Dashboard



export default router;