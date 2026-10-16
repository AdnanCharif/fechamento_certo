import express from 'express';
import bcrypt from 'bcrypt';
import { JwtTokenService } from './patterns/singleton/JwtTokenService.js';
import { CadastroEmpresa, CadastroMaquina, CadastroOperador } from './patterns/template/Cadastros.js';
import { gerarAlertas } from './patterns/strategy/RegrasDeAlerta.js';
import { productVariability } from './config/productVariability.js';
import { Fechamento } from './domain/entities.js';
import { ErroHttp, rota } from './lib/http.js';
import { transacao } from './lib/transacao.js';
import { listar, cadastrar, alterarAtivo, excluirDoFechamento } from './lib/fabricasDeRotas.js';
import { registrarAtividade } from './lib/atividade.js';
import { modulosAtivos } from './config/catalogo.js';
import adminRouter from './adminRoutes.js';

const router = express.Router();
const tokenService = JwtTokenService.getInstance();

// Middlewares

function autenticar(req, res, next) {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token de acesso obrigatório' });
    try {
        req.usuarioAutenticado = tokenService.verify(token);
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}

function featureGestaoOperadores(req, res, next) {
    if (productVariability.operatorManagement) return next();
    return res.status(404).json({ error: 'A gestão de operadores está desativada nesta versão' });
}

const validarAcessoPosto = rota('Erro ao validar acesso ao posto', async (req, res, next) => {
    const postoId = req.params.postoId || req.body.posto_id;
    const result = await req.app.get('db').query(
        'SELECT 1 FROM postos_usuarios JOIN postos USING (posto_id) WHERE posto_id = $1 AND usuario_id = $2 AND ativo',
        [postoId, req.usuarioAutenticado.usuario_id],
    );
    if (!result.rowCount) throw new ErroHttp(403, 'Usuário sem acesso a este posto');
    next();
});

// Dados pessoais e lista de postos: cada usuário só acessa os próprios.
const somenteProprioUsuario = (param) => rota('Erro ao validar usuário', (req, res, next) => {
    if (String(req.params[param]) !== String(req.usuarioAutenticado.usuario_id)) throw new ErroHttp(403, 'Acesso permitido apenas ao próprio usuário');
    next();
});

// Fechamento arquivado só pode ser consultado: bloqueia edição dele, das divergências e das observações.
const validarFechamentoEditavel = rota('Erro ao validar fechamento', async (req, res, next) => {
    const result = await req.app.get('db').query(
        'SELECT status FROM fechamentos WHERE fechamento_id = $1 AND posto_id = $2',
        [req.params.fechamentoId, req.params.postoId],
    );
    if (!result.rowCount) throw new ErroHttp(404, 'Fechamento não encontrado');
    if (result.rows[0].status === 'arquivado') throw new ErroHttp(409, 'Fechamento arquivado não pode ser alterado');
    next();
});

// Cadeia reutilizada por toda rota que altera um fechamento ou o que pertence a ele.
const fechamentoEditavel = [validarAcessoPosto, validarFechamentoEditavel];

const statusDivergencia = ['pendente', 'investigada', 'resolvida'];

const validarDivergencia = rota('Erro ao validar divergência', (req, res, next) => {
    const { valor_diferenca, status = 'pendente' } = req.body;
    if (valor_diferenca === null || valor_diferenca === '' || !Number.isFinite(Number(valor_diferenca)) || !statusDivergencia.includes(status)) {
        throw new ErroHttp(400, 'Informe o valor da diferença e um status válido (pendente, investigada ou resolvida)');
    }
    next();
});

async function validarOperadorDoPosto(pool, operadorId, postoId) {
    if (!operadorId) return;
    const result = await pool.query('SELECT 1 FROM operadores JOIN empresas USING (empresa_id) WHERE operador_id = $1 AND posto_id = $2', [operadorId, postoId]);
    if (!result.rowCount) throw new ErroHttp(400, 'Operador não pertence a este posto');
}

// Diferença total de um fechamento: cartões (soma por empresa) mais o dinheiro em caixa.
const sqlDiferencaFechamento = `COALESCE((SELECT SUM(fe.diferenca) FROM fechamento_empresa fe WHERE fe.fechamento_id = f.fechamento_id), 0)
            + COALESCE(f.valor_dinheiro_declarado - f.valor_dinheiro_esperado, 0)`;

const registrarLog = (client, fechamentoId, usuarioId, acao, campo, anterior, novo) => client.query(
    'INSERT INTO logs_auditoria (fechamento_id, usuario_id, acao, campo_alterado, valor_anterior, valor_novo) VALUES ($1, $2, $3, $4, $5, $6)',
    [fechamentoId, usuarioId, acao, campo.slice(0, 255), anterior, novo],
);

router.get('/', (req, res) => {
    res.send('API rodando');
});

router.get('/config/variabilidade', (req, res) => {
    res.json(productVariability.toJSON());
});

//Login

router.post('/auth/login', rota('Erro ao fazer login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) throw new ErroHttp(400, 'Email e senha são obrigatórios');

    const sql = `
        SELECT usuario_id, nome, email, senha, ativo, perfil
        FROM usuarios
        WHERE email = $1;
    `;
    const result = await req.app.get('db').query(sql, [email]);
    const usuario = result.rows[0];

    // Usuário não encontrado, desativado (soft delete) ou senha errada recebem a mesma resposta.
    if (!usuario || !usuario.ativo || !await bcrypt.compare(senha, usuario.senha)) {
        throw new ErroHttp(401, 'Email ou senha inválidos');
    }

    // Gera o token de sessão; o perfil decide entre a área do gerente e a do administrador.
    const token = tokenService.sign({ usuario_id: usuario.usuario_id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
    await req.app.get('db').query('UPDATE usuarios SET ultimo_acesso = now() WHERE usuario_id = $1', [usuario.usuario_id]);

    res.json({
        token,
        usuario: {
            usuario_id: usuario.usuario_id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
        }
    });
}));

router.post('/auth/logout', (req,res) => {
    res.json({ message: 'Sessão encerrada. Remova o token armazenado no cliente.' });
});

// As rotas de dados exigem um JWT emitido pelo endpoint de login.
router.use(autenticar);
router.use('/operadores', featureGestaoOperadores);
router.use('/admin', adminRouter);

//Postos

router.get('/postos/:usuarioid', somenteProprioUsuario('usuarioid'), listar('Erro ao buscar postos do usuário',
    `select p.posto_id as posto_id, p.nome as nome_posto, u.nome as nome_usuario
     from postos_usuarios pu
     inner join postos p on pu.posto_id = p.posto_id
     inner join usuarios u on pu.usuario_id = u.usuario_id
     where u.usuario_id = $1 and p.ativo
     order by p.nome`,
    (req) => [req.params.usuarioid]));

// Módulos contratados pelo posto (o front usa para montar o menu).
router.get('/postos/:postoId/modulos', validarAcessoPosto, rota('Erro ao carregar módulos do posto', async (req, res) => {
    res.json(await modulosAtivos(req.app.get('db'), req.params.postoId));
}));

//Usuários (cadastro, vínculos e status de gerentes ficam na área admin: src/adminRoutes.js)

router.get('/usuarios/:id', somenteProprioUsuario('id'), rota('Erro ao buscar usuário', async (req, res) => {
    const sql = `SELECT usuario_id, nome, email, telefone, perfil, created_at
                 FROM usuarios
                 WHERE usuario_id = $1;`;
    const result = await req.app.get('db').query(sql, [req.params.id]);
    if (!result.rows[0]) throw new ErroHttp(404, 'Usuário não encontrado');
    res.json(result.rows[0]);
}));

router.put('/usuarios/:id', somenteProprioUsuario('id'), rota('Erro ao editar usuário', async (req, res) => {
    const userId = req.params.id;
    const { nome, email, senha } = req.body;
    if (!nome?.trim() || !email?.trim()) throw new ErroHttp(400, 'Nome e email são obrigatórios');

    await transacao(req.app.get('db'), async (client) => {
        // Atualiza nome e email
        const updateUsuario = `
            UPDATE usuarios
            SET nome = $1, email = $2
            WHERE usuario_id = $3;
        `;
        await client.query(updateUsuario, [nome, email, userId]);

        // Se a senha foi fornecida, atualiza também
        if (senha) {
            const senhaHash = await bcrypt.hash(senha, 10);
            const updateSenha = `
                UPDATE usuarios
                SET senha = $1
                WHERE usuario_id = $2;
            `;
            await client.query(updateSenha, [senhaHash, userId]);
        }
    });

    res.json({
        message: 'Usuário editado com sucesso',
    });
}));


//Empresas

router.get('/postos/empresas/:posto_id', listar('Erro ao buscar empresas do posto',
    'select empresa_id, nome, cnpj, tipo, created_at from empresas where posto_id = $1',
    (req) => [req.params.posto_id]));

router.put('/empresas/:id', rota('Erro ao editar empresa', async (req, res) => {
    const { nome, cnpj, tipo } = req.body;
    const sql = `
        UPDATE empresas
        SET nome = $1, cnpj = $2, tipo = $3
        WHERE empresa_id = $4;
    `;
    await req.app.get('db').query(sql, [nome, cnpj, tipo, req.params.id]);
    res.json({ message: 'Empresa editada com sucesso' });
}));

router.post('/empresas', cadastrar(new CadastroEmpresa(), 'Erro ao cadastrar empresa'));

router.delete('/empresas/:id', rota('Não foi possível remover a empresa; confira se ela possui máquinas ou operadores vinculados', async (req, res) => {
    const result = await req.app.get('db').query('DELETE FROM empresas WHERE empresa_id = $1 RETURNING empresa_id', [req.params.id]);
    if (!result.rowCount) throw new ErroHttp(404, 'Empresa não encontrada');
    res.json({ message: 'Empresa removida com sucesso' });
}));


//Máquinas

// Mesmo SELECT para listar as máquinas do posto e buscar uma máquina; muda só o filtro.
const sqlMaquinas = `select m.maquina_id, m.empresa_id, m.nome as nome_maquina, e.nome as nome_empresa, m.ativo, m.created_at
    from maquinas m inner join empresas e on e.empresa_id = m.empresa_id`;

router.get('/postos/:id/maquinas', listar('Erro ao buscar máquinas do posto', `${sqlMaquinas} where e.posto_id = $1`, (req) => [req.params.id]));

router.post('/maquinas', registrarAtividade((req, maquina) => `Cadastro da máquina ${maquina.nome}`, (req, maquina) => maquina.posto_id),
    cadastrar(new CadastroMaquina(), 'Erro ao cadastrar máquina'));

router.get('/maquinas/:id', listar('Erro ao listar máquina', `${sqlMaquinas} where m.maquina_id = $1`, (req) => [req.params.id]));

router.put('/maquinas/:id', rota('Erro ao editar maquina', async (req, res) => {
    const { empresa_id, nome, ativo } = req.body;
    if (!empresa_id || !nome?.trim() || typeof ativo !== 'boolean') {
        throw new ErroHttp(400, 'Empresa, nome e status válido são obrigatórios');
    }

    const sql = `update maquinas set
    empresa_id = $2,
    nome = $3,
    ativo = $4
    where maquina_id = $1
    RETURNING maquina_id`;
    const result = await req.app.get('db').query(sql, [req.params.id, empresa_id, nome, ativo]);
    if (!result.rowCount) throw new ErroHttp(404, 'Máquina não encontrada');
    res.json({"message": "Máquina alterada com sucesso"});
}));

// Excluir máquina é inativá-la; o PATCH liga e desliga.
router.delete('/maquinas/:id', alterarAtivo('maquinas', 'maquina_id', 'Máquina não encontrada', false));
router.patch('/maquinas/:id', alterarAtivo('maquinas', 'maquina_id', 'Máquina não encontrada'));


//Operadores
router.get('/operadores/posto/:id', listar('Erro ao listar operadores do posto',
    `select o.operador_id, o.empresa_id, o.nome as nome_operador, e.nome as nome_empresa, o.ativo, o.created_at
     from operadores o inner join empresas e on e.empresa_id = o.empresa_id
     where e.posto_id = $1`,
    (req) => [req.params.id]));

router.post('/operadores', registrarAtividade((req, operador) => `Cadastro do operador ${operador.nome}`, (req, operador) => operador.posto_id),
    cadastrar(new CadastroOperador(), 'Erro ao cadastrar operador'));

router.get('/operadores/nome', listar('Erro ao buscar operador', 'select * from operadores where nome = $1', (req) => [req.query.nome]));

router.put('/operadores/:id', rota('Erro ao editar operador', async (req, res) => {
    const {empresa_id, nome} = req.body;
    if (!empresa_id || !nome?.trim()) throw new ErroHttp(400, 'Empresa e nome são obrigatórios');

    const sql = `update operadores set
                empresa_id = $1,
                nome = $2
                where operador_id = $3`;
    await req.app.get('db').query(sql, [empresa_id, nome, req.params.id]);
    res.json({message: 'Operador editado com sucesso'});
}));

// Excluir operador é inativá-lo; o PATCH liga e desliga.
router.delete('/operadores/:id', alterarAtivo('operadores', 'operador_id', 'Operador não encontrado', false));
router.patch('/operadores/:id', alterarAtivo('operadores', 'operador_id', 'Operador não encontrado'));

// Fechamentos

router.get('/postos/:postoId/fechamentos/dashboard', validarAcessoPosto, rota('Erro ao carregar dashboard', async (req, res) => {
    const pool = req.app.get('db');
    const [summary, daily, recent] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT f.fechamento_id)::int AS quantidade,
            COALESCE(SUM(CASE WHEN e.tipo = 'combustivel' THEN fe.diferenca ELSE 0 END), 0) AS posto,
            COALESCE(SUM(CASE WHEN e.tipo = 'conveniencia' THEN fe.diferenca ELSE 0 END), 0) AS loja
            FROM fechamentos f LEFT JOIN fechamento_empresa fe USING (fechamento_id)
            LEFT JOIN empresas e USING (empresa_id)
            WHERE f.posto_id = $1 AND date_trunc('month', f.data_referencia) = date_trunc('month', CURRENT_DATE)`, [req.params.postoId]),
        pool.query(`SELECT f.data_referencia::text AS data, ${sqlDiferencaFechamento} AS diferenca
            FROM fechamentos f
            WHERE f.posto_id = $1 AND date_trunc('month', f.data_referencia) = date_trunc('month', CURRENT_DATE)
            ORDER BY f.data_referencia`, [req.params.postoId]),
        pool.query(`SELECT f.fechamento_id, f.data_referencia::text AS data, f.status,
            COALESCE(SUM(fe.valor_recebido), 0) AS total_cartoes
            FROM fechamentos f LEFT JOIN fechamento_empresa fe USING (fechamento_id)
            WHERE f.posto_id = $1 GROUP BY f.fechamento_id ORDER BY f.data_referencia DESC LIMIT 5`, [req.params.postoId]),
    ]);
    res.json({ totals: summary.rows[0], daily: daily.rows, recent: recent.rows });
}));

router.get('/postos/:postoId/fechamentos', validarAcessoPosto, listar('Erro ao listar fechamentos',
    `SELECT f.fechamento_id, f.data_referencia::text AS data,
        f.status, f.valor_dinheiro_declarado AS dinheiro_declarado, f.valor_dinheiro_esperado AS dinheiro_esperado,
        COALESCE(SUM(fe.valor_esperado), 0) AS total_esperado,
        COALESCE(SUM(fe.valor_recebido), 0) AS total_cartoes,
        COALESCE(SUM(CASE WHEN e.tipo = 'combustivel' THEN fe.diferenca ELSE 0 END), 0) AS posto,
        COALESCE(SUM(CASE WHEN e.tipo = 'conveniencia' THEN fe.diferenca ELSE 0 END), 0) AS loja
        FROM fechamentos f LEFT JOIN fechamento_empresa fe USING (fechamento_id)
        LEFT JOIN empresas e USING (empresa_id)
        WHERE f.posto_id = $1 AND ($2::date IS NULL OR f.data_referencia >= $2::date)
          AND ($3::date IS NULL OR f.data_referencia <= $3::date)
          AND ($4::varchar IS NULL OR f.status = $4::varchar)
        GROUP BY f.fechamento_id ORDER BY f.data_referencia DESC`,
    ({ params, query: { from, to, status } }) => [params.postoId, from || null, to || null, status && status !== 'Todos' ? status : null]));

router.post('/postos/:postoId/fechamentos', validarAcessoPosto, rota('Erro ao salvar fechamento', async (req, res) => {
    const { data_referencia, valor_dinheiro_esperado, valor_dinheiro_declarado, maquinas } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_referencia || '') || !Fechamento.valoresValidos(req.body)) {
        throw new ErroHttp(400, 'Informe data, valores não negativos e lançamentos de máquinas válidos');
    }
    const criado = await transacao(req.app.get('db'), async (client) => {
        const fechamento = await client.query(`INSERT INTO fechamentos
            (posto_id, usuario_id, data_referencia, valor_dinheiro_esperado, valor_dinheiro_declarado, status)
            VALUES ($1, $2, $3::date, $4, $5, 'em_analise') RETURNING fechamento_id`,
        [req.params.postoId, req.usuarioAutenticado.usuario_id, data_referencia, valor_dinheiro_esperado, valor_dinheiro_declarado]);
        const fechamentoId = fechamento.rows[0].fechamento_id;
        const totals = new Map();
        for (const item of maquinas) {
            const machine = await client.query(`SELECT m.maquina_id, m.empresa_id FROM maquinas m
                JOIN empresas e USING (empresa_id) WHERE m.maquina_id = $1 AND e.posto_id = $2 AND m.ativo`,
            [item.maquina_id, req.params.postoId]);
            if (!machine.rowCount) throw new ErroHttp(400, 'Uma máquina não pertence a este posto ou está inativa');
            if (item.operador_id) {
                const operator = await client.query('SELECT 1 FROM operadores WHERE operador_id = $1 AND empresa_id = $2 AND ativo', [item.operador_id, machine.rows[0].empresa_id]);
                if (!operator.rowCount) throw new ErroHttp(400, 'Operador inválido para a empresa da máquina');
            }
            const detail = await client.query(`INSERT INTO fechamento_maquinas
                (fechamento_id, maquina_id, operador_id, turno, valor_esperado, valor_recebido)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING fechamento_maquina_id, diferenca`,
            [fechamentoId, item.maquina_id, item.operador_id || null, item.turno || null, item.valor_esperado, item.valor_recebido]);
            const companyId = machine.rows[0].empresa_id;
            const current = totals.get(companyId) || { esperado: 0, recebido: 0 };
            current.esperado += Number(item.valor_esperado); current.recebido += Number(item.valor_recebido); totals.set(companyId, current);
            const difference = Number(detail.rows[0].diferenca);
            if (difference !== 0) {
                const div = await client.query(`INSERT INTO divergencias (fechamento_id, fechamento_maquina_id, operador_id, valor_diferenca)
                    VALUES ($1, $2, $3, $4) RETURNING divergencia_id`, [fechamentoId, detail.rows[0].fechamento_maquina_id, item.operador_id || null, difference]);
                if (item.observacao?.trim()) await client.query('INSERT INTO observacoes (fechamento_id, divergencia_id, usuario_id, texto) VALUES ($1, $2, $3, $4)', [fechamentoId, div.rows[0].divergencia_id, req.usuarioAutenticado.usuario_id, item.observacao.trim()]);
            }
        }
        for (const [empresaId, total] of totals) await client.query(`INSERT INTO fechamento_empresa (fechamento_id, empresa_id, valor_esperado, valor_recebido) VALUES ($1, $2, $3, $4)`, [fechamentoId, empresaId, total.esperado, total.recebido]);
        const novoFechamento = new Fechamento(req.body);
        const cashDiff = novoFechamento.calcularDiferencaDinheiro();
        if (cashDiff !== 0) await client.query('INSERT INTO divergencias (fechamento_id, valor_diferenca) VALUES ($1, $2)', [fechamentoId, cashDiff]);
        const status = novoFechamento.definirStatus([...totals.values()].some((t) => t.esperado !== t.recebido));
        await client.query('UPDATE fechamentos SET status = $1, updated_at = now() WHERE fechamento_id = $2', [status, fechamentoId]);
        await registrarLog(client, fechamentoId, req.usuarioAutenticado.usuario_id, 'Criação de fechamento', 'status', null, status);
        return { fechamento_id: fechamentoId, status };
    });
    res.status(201).json(criado);
}, { '23505': new ErroHttp(409, 'Já existe um fechamento para este posto e data') }));

router.get('/postos/:postoId/fechamentos/:fechamentoId', validarAcessoPosto, rota('Erro ao carregar detalhe do fechamento', async (req, res) => {
    const pool = req.app.get('db');
    const header = await pool.query(`SELECT f.*, u.nome AS usuario_nome FROM fechamentos f JOIN usuarios u USING (usuario_id)
        WHERE f.fechamento_id = $1 AND f.posto_id = $2`, [req.params.fechamentoId, req.params.postoId]);
    if (!header.rowCount) throw new ErroHttp(404, 'Fechamento não encontrado');
    const [companies, machines, observations, divergences] = await Promise.all([
        pool.query(`SELECT e.empresa_id, e.nome, e.tipo, fe.valor_esperado, fe.valor_recebido, fe.diferenca
            FROM fechamento_empresa fe JOIN empresas e USING (empresa_id) WHERE fe.fechamento_id = $1 ORDER BY e.empresa_id`, [req.params.fechamentoId]),
        pool.query(`SELECT fm.fechamento_maquina_id, m.maquina_id, m.nome AS maquina_nome, e.nome AS empresa_nome,
            e.tipo, fm.turno, fm.valor_esperado, fm.valor_recebido, fm.diferenca, o.nome AS operador_nome
            FROM fechamento_maquinas fm JOIN maquinas m USING (maquina_id) JOIN empresas e USING (empresa_id)
            LEFT JOIN operadores o USING (operador_id) WHERE fm.fechamento_id = $1 ORDER BY m.nome`, [req.params.fechamentoId]),
        pool.query(`SELECT ob.observacao_id, ob.texto, ob.created_at, u.nome AS usuario_nome FROM observacoes ob
            JOIN usuarios u USING (usuario_id) WHERE ob.fechamento_id = $1 ORDER BY ob.created_at`, [req.params.fechamentoId]),
        pool.query(`SELECT d.divergencia_id, d.valor_diferenca, d.status, d.operador_id, fm.maquina_id, m.nome AS maquina_nome
            FROM divergencias d LEFT JOIN fechamento_maquinas fm USING (fechamento_maquina_id)
            LEFT JOIN maquinas m USING (maquina_id) WHERE d.fechamento_id = $1`, [req.params.fechamentoId]),
    ]);
    res.json({ fechamento: header.rows[0], empresas: companies.rows, maquinas: machines.rows, observacoes: observations.rows, divergencias: divergences.rows });
}));

// Edita valores do fechamento; cada campo alterado vira uma linha em logs_auditoria.
router.put('/postos/:postoId/fechamentos/:fechamentoId', fechamentoEditavel, rota('Erro ao editar fechamento', async (req, res) => {
    const { valor_dinheiro_esperado, valor_dinheiro_declarado, maquinas = [] } = req.body;
    if (!Fechamento.valoresValidos({ ...req.body, maquinas })) {
        throw new ErroHttp(400, 'Informe valores não negativos para o dinheiro e para as máquinas');
    }
    const { fechamentoId } = req.params;
    const editado = await transacao(req.app.get('db'), async (client) => {
        const atual = (await client.query('SELECT valor_dinheiro_esperado, valor_dinheiro_declarado, status FROM fechamentos WHERE fechamento_id = $1 FOR UPDATE', [fechamentoId])).rows[0];
        const alteracoes = [];
        const comparar = (campo, anterior, novo) => {
            if (Number(anterior) !== Number(novo)) alteracoes.push([campo, anterior, Number(novo).toFixed(2)]);
        };
        comparar('valor_dinheiro_esperado', atual.valor_dinheiro_esperado, valor_dinheiro_esperado);
        comparar('valor_dinheiro_declarado', atual.valor_dinheiro_declarado, valor_dinheiro_declarado);
        await client.query('UPDATE fechamentos SET valor_dinheiro_esperado = $1, valor_dinheiro_declarado = $2 WHERE fechamento_id = $3',
            [valor_dinheiro_esperado, valor_dinheiro_declarado, fechamentoId]);
        for (const item of maquinas) {
            const linha = await client.query(`SELECT fm.valor_esperado, fm.valor_recebido, m.nome FROM fechamento_maquinas fm
                JOIN maquinas m USING (maquina_id) WHERE fm.fechamento_maquina_id = $1 AND fm.fechamento_id = $2`, [item.fechamento_maquina_id, fechamentoId]);
            if (!linha.rowCount) throw new ErroHttp(400, 'Lançamento de máquina não pertence a este fechamento');
            comparar(`${linha.rows[0].nome}: valor_esperado`, linha.rows[0].valor_esperado, item.valor_esperado);
            comparar(`${linha.rows[0].nome}: valor_recebido`, linha.rows[0].valor_recebido, item.valor_recebido);
            await client.query('UPDATE fechamento_maquinas SET valor_esperado = $1, valor_recebido = $2 WHERE fechamento_maquina_id = $3',
                [item.valor_esperado, item.valor_recebido, item.fechamento_maquina_id]);
        }
        // Recalcula o resumo por empresa a partir das máquinas e, com ele, o status.
        await client.query(`UPDATE fechamento_empresa fe SET valor_esperado = t.esperado, valor_recebido = t.recebido
            FROM (SELECT m.empresa_id, SUM(fm.valor_esperado) AS esperado, SUM(fm.valor_recebido) AS recebido
                  FROM fechamento_maquinas fm JOIN maquinas m USING (maquina_id) WHERE fm.fechamento_id = $1 GROUP BY m.empresa_id) t
            WHERE fe.fechamento_id = $1 AND fe.empresa_id = t.empresa_id`, [fechamentoId]);
        const empresaDivergente = await client.query('SELECT 1 FROM fechamento_empresa WHERE fechamento_id = $1 AND diferenca <> 0', [fechamentoId]);
        const status = new Fechamento(req.body).definirStatus(empresaDivergente.rowCount > 0);
        if (status !== atual.status) alteracoes.push(['status', atual.status, status]);
        await client.query('UPDATE fechamentos SET status = $1, updated_at = now() WHERE fechamento_id = $2', [status, fechamentoId]);
        for (const [campo, anterior, novo] of alteracoes) {
            await registrarLog(client, fechamentoId, req.usuarioAutenticado.usuario_id, 'Edição de fechamento', campo, anterior, novo);
        }
        return { fechamento_id: Number(fechamentoId), status, alteracoes: alteracoes.length };
    });
    res.json(editado);
}));

// "Excluir" um fechamento é arquivá-lo: ele nunca é apagado e a mudança fica no log.
router.delete('/postos/:postoId/fechamentos/:fechamentoId', fechamentoEditavel, rota('Erro ao arquivar fechamento', async (req, res) => {
    const { fechamentoId } = req.params;
    await transacao(req.app.get('db'), async (client) => {
        const anterior = await client.query('SELECT status FROM fechamentos WHERE fechamento_id = $1 FOR UPDATE', [fechamentoId]);
        await client.query(`UPDATE fechamentos SET status = 'arquivado', updated_at = now() WHERE fechamento_id = $1`, [fechamentoId]);
        await registrarLog(client, fechamentoId, req.usuarioAutenticado.usuario_id, 'Arquivamento de fechamento', 'status', anterior.rows[0].status, 'arquivado');
    });
    res.json({ fechamento_id: Number(fechamentoId), status: 'arquivado' });
}));

// Divergências

router.post('/postos/:postoId/fechamentos/:fechamentoId/divergencias', fechamentoEditavel, validarDivergencia, rota('Erro ao registrar divergência', async (req, res) => {
    const { fechamento_maquina_id, operador_id, valor_diferenca, status = 'pendente' } = req.body;
    const pool = req.app.get('db');
    await validarOperadorDoPosto(pool, operador_id, req.params.postoId);
    // A máquina, quando informada, precisa ser um lançamento deste fechamento.
    const result = await pool.query(`INSERT INTO divergencias (fechamento_id, fechamento_maquina_id, operador_id, valor_diferenca, status)
        SELECT $1::int, $2::int, $3::int, $4::numeric, $5::varchar
        WHERE $2::int IS NULL OR EXISTS (SELECT 1 FROM fechamento_maquinas WHERE fechamento_maquina_id = $2 AND fechamento_id = $1)
        RETURNING divergencia_id, fechamento_id, fechamento_maquina_id, operador_id, valor_diferenca, status`,
    [req.params.fechamentoId, fechamento_maquina_id || null, operador_id || null, valor_diferenca, status]);
    if (!result.rowCount) throw new ErroHttp(400, 'Máquina não pertence a este fechamento');
    res.status(201).json(result.rows[0]);
}));

router.put('/postos/:postoId/fechamentos/:fechamentoId/divergencias/:id', fechamentoEditavel, validarDivergencia, rota('Erro ao editar divergência', async (req, res) => {
    const { operador_id, valor_diferenca, status = 'pendente' } = req.body;
    const pool = req.app.get('db');
    await validarOperadorDoPosto(pool, operador_id, req.params.postoId);
    const result = await pool.query(`UPDATE divergencias SET operador_id = $1, valor_diferenca = $2, status = $3
        WHERE divergencia_id = $4 AND fechamento_id = $5
        RETURNING divergencia_id, fechamento_id, fechamento_maquina_id, operador_id, valor_diferenca, status`,
    [operador_id || null, valor_diferenca, status, req.params.id, req.params.fechamentoId]);
    if (!result.rowCount) throw new ErroHttp(404, 'Divergência não encontrada');
    res.json(result.rows[0]);
}));

// Observações ligadas à divergência excluída continuam no fechamento como observações gerais (ON DELETE SET NULL).
router.delete('/postos/:postoId/fechamentos/:fechamentoId/divergencias/:id', fechamentoEditavel,
    excluirDoFechamento('divergencias', 'divergencia_id', 'Divergência não encontrada', 'Divergência excluída com sucesso'));

// Observações

router.post('/postos/:postoId/fechamentos/:fechamentoId/observacoes', fechamentoEditavel, rota('Erro ao registrar observação', async (req, res) => {
    const { texto, divergencia_id } = req.body;
    if (!texto?.trim()) throw new ErroHttp(400, 'O texto da observação é obrigatório');
    // A divergência, quando informada, precisa ser deste fechamento.
    const result = await req.app.get('db').query(`INSERT INTO observacoes (fechamento_id, divergencia_id, usuario_id, texto)
        SELECT $1::int, $2::int, $3::int, $4::text
        WHERE $2::int IS NULL OR EXISTS (SELECT 1 FROM divergencias WHERE divergencia_id = $2 AND fechamento_id = $1)
        RETURNING observacao_id, fechamento_id, divergencia_id, usuario_id, texto, created_at`,
    [req.params.fechamentoId, divergencia_id || null, req.usuarioAutenticado.usuario_id, texto.trim()]);
    if (!result.rowCount) throw new ErroHttp(400, 'Divergência não pertence a este fechamento');
    res.status(201).json(result.rows[0]);
}));

router.put('/postos/:postoId/fechamentos/:fechamentoId/observacoes/:id', fechamentoEditavel, rota('Erro ao editar observação', async (req, res) => {
    const { texto } = req.body;
    if (!texto?.trim()) throw new ErroHttp(400, 'O texto da observação é obrigatório');
    const result = await req.app.get('db').query(`UPDATE observacoes SET texto = $1 WHERE observacao_id = $2 AND fechamento_id = $3
        RETURNING observacao_id, fechamento_id, divergencia_id, usuario_id, texto, created_at`,
    [texto.trim(), req.params.id, req.params.fechamentoId]);
    if (!result.rowCount) throw new ErroHttp(404, 'Observação não encontrada');
    res.json(result.rows[0]);
}));

router.delete('/postos/:postoId/fechamentos/:fechamentoId/observacoes/:id', fechamentoEditavel,
    excluirDoFechamento('observacoes', 'observacao_id', 'Observação não encontrada', 'Observação excluída com sucesso'));

// Rede (módulo Multi-unidade): compara os postos do gerente que têm o módulo ativo.

async function postosDaRede(pool, usuarioId) {
    const result = await pool.query(`SELECT p.posto_id, p.nome, p.cidade, p.uf, p.endereco FROM postos p
        JOIN postos_usuarios pu USING (posto_id)
        JOIN postos_modulos pm ON pm.posto_id = p.posto_id AND pm.modulo = 'multi_unidade' AND pm.ativo
        WHERE pu.usuario_id = $1 AND p.ativo ORDER BY p.nome`, [usuarioId]);
    if (!result.rowCount) throw new ErroHttp(404, 'O módulo Multi-unidade não está ativo em nenhum dos seus postos');
    return result.rows;
}

// Fechamentos não arquivados dos últimos N dias, do mais recente ao mais antigo, agrupados por posto.
async function fechamentosDaRede(pool, postos, dias) {
    const result = await pool.query(`SELECT f.posto_id, f.fechamento_id, f.data_referencia::text AS data, f.status, f.created_at,
            ${sqlDiferencaFechamento} AS diferenca,
            COALESCE((SELECT SUM(fe.valor_recebido) FROM fechamento_empresa fe WHERE fe.fechamento_id = f.fechamento_id), 0)
            + COALESCE(f.valor_dinheiro_declarado, 0) AS total
        FROM fechamentos f
        WHERE f.posto_id = ANY($1::int[]) AND f.status <> 'arquivado' AND f.data_referencia > CURRENT_DATE - $2::int
        ORDER BY f.data_referencia DESC`, [postos.map((posto) => posto.posto_id), dias]);
    const porPosto = new Map(postos.map((posto) => [posto.posto_id, []]));
    for (const fechamento of result.rows) porPosto.get(fechamento.posto_id).push(fechamento);
    return porPosto;
}

function resumirPosto(fechamentos) {
    const soma = (filtro) => fechamentos.filter(filtro).reduce((total, f) => total + Number(f.diferenca), 0);
    const saldo = soma(() => true);
    return {
        fechamentos: fechamentos.length,
        total: fechamentos.reduce((total, f) => total + Number(f.total), 0),
        sobra: soma((f) => Number(f.diferenca) > 0),
        falta: soma((f) => Number(f.diferenca) < 0),
        saldo,
        status: productVariability.classificarSaldo(saldo),
    };
}

router.get('/rede/comparativo', rota('Erro ao carregar o comparativo', async (req, res) => {
    const dias = [7, 30, 90].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
    const pool = req.app.get('db');
    const postos = await postosDaRede(pool, req.usuarioAutenticado.usuario_id);
    const fechamentos = await fechamentosDaRede(pool, postos, dias);
    const ranking = postos.map((posto) => ({ ...posto, ...resumirPosto(fechamentos.get(posto.posto_id)) })).sort((a, b) => b.saldo - a.saldo);
    res.json({ dias, limite: productVariability.divergenceAlertLimit, postos: ranking });
}));

router.get('/rede/alertas', rota('Erro ao carregar os alertas', async (req, res) => {
    const pool = req.app.get('db');
    const postos = await postosDaRede(pool, req.usuarioAutenticado.usuario_id);
    const [fechamentos, datas] = await Promise.all([
        fechamentosDaRede(pool, postos, 30),
        pool.query(`SELECT CURRENT_DATE::text AS hoje, (CURRENT_DATE - 1)::text AS ontem, (CURRENT_DATE - 7)::text AS "inicioSemana"`),
    ]);
    res.json(gerarAlertas(postos, fechamentos, { limite: productVariability.divergenceAlertLimit, ...datas.rows[0] }));
}));

router.get('/rede/postos/:postoId', rota('Erro ao carregar o detalhamento', async (req, res) => {
    const pool = req.app.get('db');
    const posto = (await postosDaRede(pool, req.usuarioAutenticado.usuario_id)).find((item) => String(item.posto_id) === req.params.postoId);
    if (!posto) throw new ErroHttp(404, 'Posto fora da sua rede Multi-unidade');
    const [fechamentos, gerente] = await Promise.all([
        fechamentosDaRede(pool, [posto], 30),
        pool.query(`SELECT u.nome FROM postos_usuarios pu JOIN usuarios u USING (usuario_id)
            WHERE pu.posto_id = $1 AND u.perfil = 'gerente' AND u.ativo ORDER BY pu.created_at LIMIT 1`, [posto.posto_id]),
    ]);
    const lista = fechamentos.get(posto.posto_id);
    res.json({
        posto: { ...posto, gerente: gerente.rows[0]?.nome ?? null },
        ...resumirPosto(lista),
        diario: [...lista].reverse().map(({ data, diferenca }) => ({ data, diferenca })),
        ultimos: lista.slice(0, 6),
    });
}));

export default router;
