import express from 'express';
import bcrypt from 'bcrypt';
import { ErroHttp, rota } from './lib/http.js';
import { transacao } from './lib/transacao.js';
import { listar, cadastrar, alterarAtivo } from './lib/fabricasDeRotas.js';
import { registrarAtividade, sqlAtividades } from './lib/atividade.js';
import { CadastroPosto, camposPosto, valoresPosto, salvarEmpresas, vincularGerentes } from './patterns/template/Cadastros.js';
import { PostoValidationStrategy } from './patterns/strategy/EntityValidationStrategies.js';
import { Usuario } from './domain/entities.js';
import { planos, modulos, modulosAtivos } from './config/catalogo.js';

// Área administrativa (suporte interno): clientes, gerentes, módulos e planos.
// Montada em /admin depois da autenticação; só o perfil admin passa.
const admin = express.Router();
const validacaoPosto = new PostoValidationStrategy();

admin.use(rota('Erro ao validar perfil', (req, res, next) => {
    if (req.usuarioAutenticado.perfil !== 'admin') throw new ErroHttp(403, 'Área restrita aos administradores');
    next();
}));

// Pendente = ainda sem empresa ou sem gerente ativo vinculado.
const sqlStatusPosto = `CASE WHEN NOT p.ativo THEN 'inativo'
    WHEN NOT EXISTS (SELECT 1 FROM empresas e WHERE e.posto_id = p.posto_id)
      OR NOT EXISTS (SELECT 1 FROM postos_usuarios pu JOIN usuarios u USING (usuario_id) WHERE pu.posto_id = p.posto_id AND u.ativo AND u.perfil = 'gerente')
    THEN 'pendente' ELSE 'ativo' END`;

// Pendente = acesso criado, mas o gerente ainda não entrou no sistema.
const sqlStatusGerente = `CASE WHEN NOT u.ativo THEN 'inativo' WHEN u.ultimo_acesso IS NULL THEN 'pendente' ELSE 'ativo' END`;

const errosPosto = {
    '23505': new ErroHttp(409, 'CNPJ já cadastrado em outro estabelecimento'),
    '23503': new ErroHttp(400, 'Gerente responsável não encontrado'),
    '22001': new ErroHttp(400, 'Algum campo passou do tamanho permitido'),
};
const errosGerente = {
    '23505': new ErroHttp(409, 'E-mail já cadastrado'),
    '23503': new ErroHttp(400, 'Estabelecimento não encontrado'),
    '22001': new ErroHttp(400, 'Algum campo passou do tamanho permitido'),
};

// Resumo

admin.get('/resumo', rota('Erro ao carregar o resumo', async (req, res) => {
    const pool = req.app.get('db');
    const [postos, gerentes, atividades, cadastros] = await Promise.all([
        pool.query(`SELECT ${sqlStatusPosto} AS status, p.plano FROM postos p`),
        pool.query(`SELECT count(*)::int AS total FROM usuarios WHERE perfil = 'gerente' AND ativo`),
        pool.query(sqlAtividades, [null, 8]),
        pool.query(`SELECT to_char(mes, 'YYYY-MM') AS mes, count(p.posto_id)::int AS total
            FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month') mes
            LEFT JOIN postos p ON date_trunc('month', p.created_at) = mes
            GROUP BY mes ORDER BY mes`),
    ]);
    const ativos = postos.rows.filter((posto) => posto.status === 'ativo');
    res.json({
        estabelecimentos_ativos: ativos.length,
        ativacoes_pendentes: postos.rows.filter((posto) => posto.status === 'pendente').length,
        total_gerentes: gerentes.rows[0].total,
        mrr: ativos.reduce((soma, posto) => soma + (planos[posto.plano]?.precoMensal ?? 0), 0),
        atividades: atividades.rows,
        cadastros_por_mes: cadastros.rows,
    });
}));

// Estabelecimentos

// O nome do plano vem do catálogo (src/config/catalogo.js), não do banco.
admin.get('/estabelecimentos', rota('Erro ao listar estabelecimentos', async (req, res) => {
    const result = await req.app.get('db').query(
        `SELECT p.posto_id, p.nome, ${camposPosto.slice(1).map((campo) => `p.${campo}`).join(', ')}, p.endereco, p.plano, p.ativo, p.created_at,
            ${sqlStatusPosto} AS status,
            COALESCE((SELECT json_agg(json_build_object('empresa_id', e.empresa_id, 'nome', e.nome, 'cnpj', e.cnpj, 'tipo', e.tipo,
                'inscricao_estadual', e.inscricao_estadual) ORDER BY e.empresa_id) FROM empresas e WHERE e.posto_id = p.posto_id), '[]') AS empresas,
            COALESCE((SELECT json_agg(json_build_object('usuario_id', u.usuario_id, 'nome', u.nome, 'email', u.email) ORDER BY pu.created_at)
                FROM postos_usuarios pu JOIN usuarios u USING (usuario_id) WHERE pu.posto_id = p.posto_id AND u.perfil = 'gerente'), '[]') AS gerentes
         FROM postos p ORDER BY p.nome`,
    );
    res.json(result.rows.map((posto) => ({ ...posto, plano_nome: planos[posto.plano]?.nome ?? posto.plano })));
}));

// Cadastra o posto com as duas empresas e o gerente responsável numa transação só (Template Method).
admin.post('/estabelecimentos',
    registrarAtividade(() => 'Estabelecimento cadastrado', (req, corpo) => corpo.posto_id),
    cadastrar(new CadastroPosto(), 'Erro ao cadastrar estabelecimento',
        (req) => ({ ...req.body, usuarios: req.body.usuario_id ? [req.body.usuario_id] : [] }), errosPosto));

admin.put('/estabelecimentos/:id',
    registrarAtividade(() => 'Dados do estabelecimento atualizados', (req) => req.params.id),
    rota('Erro ao editar estabelecimento', async (req, res) => {
        if (!validacaoPosto.validate(req.body)) throw new ErroHttp(400, 'Dados obrigatórios ou inválidos');
        const postoId = req.params.id;
        await transacao(req.app.get('db'), async (client) => {
            const result = await client.query(
                `UPDATE postos SET ${camposPosto.map((campo, i) => `${campo} = $${i + 1}`).join(', ')}, endereco = $${camposPosto.length + 1}
                 WHERE posto_id = $${camposPosto.length + 2} RETURNING posto_id`,
                [...valoresPosto(req.body), postoId],
            );
            if (!result.rowCount) throw new ErroHttp(404, 'Estabelecimento não encontrado');
            await salvarEmpresas(client, postoId, req.body.empresas);
            await vincularGerentes(client, postoId, req.body.usuario_id ? [req.body.usuario_id] : []);
        });
        res.json({ posto_id: Number(postoId) });
    }, errosPosto));

// Inativar ou reativar: o histórico continua no banco nos dois casos.
admin.patch('/estabelecimentos/:id',
    registrarAtividade((req) => (req.body.ativo ? 'Estabelecimento reativado' : 'Estabelecimento inativado'), (req) => req.params.id),
    alterarAtivo('postos', 'posto_id', 'Estabelecimento não encontrado'));

// Módulos e plano

admin.get('/estabelecimentos/:id/modulos', rota('Erro ao carregar módulos', async (req, res) => {
    const pool = req.app.get('db');
    const posto = await pool.query('SELECT posto_id, nome, plano FROM postos WHERE posto_id = $1', [req.params.id]);
    if (!posto.rowCount) throw new ErroHttp(404, 'Estabelecimento não encontrado');
    const ativos = await modulosAtivos(pool, req.params.id);
    res.json({
        posto: posto.rows[0],
        planos: Object.entries(planos).map(([chave, plano]) => ({ chave, ...plano })),
        modulos: Object.entries(modulos).map(([chave, modulo]) => ({ chave, ...modulo, obrigatorio: Boolean(modulo.obrigatorio), ativo: ativos.includes(chave) })),
    });
}));

admin.put('/estabelecimentos/:id/modulos/:modulo',
    registrarAtividade((req) => `Módulo ${modulos[req.params.modulo]?.nome} ${req.body.ativo ? 'ativado' : 'desativado'}`, (req) => req.params.id),
    rota('Erro ao alterar módulo', async (req, res) => {
        const modulo = modulos[req.params.modulo];
        if (!modulo) throw new ErroHttp(404, 'Módulo não encontrado');
        if (modulo.obrigatorio) throw new ErroHttp(400, 'Este módulo é obrigatório e fica sempre ativo');
        if (typeof req.body.ativo !== 'boolean') throw new ErroHttp(400, 'Informe ativo como booleano');
        await req.app.get('db').query(
            `INSERT INTO postos_modulos (posto_id, modulo, ativo) VALUES ($1, $2, $3)
             ON CONFLICT (posto_id, modulo) DO UPDATE SET ativo = EXCLUDED.ativo, updated_at = now()`,
            [req.params.id, req.params.modulo, req.body.ativo],
        );
        res.json({ modulo: req.params.modulo, ativo: req.body.ativo });
    }, { '23503': new ErroHttp(404, 'Estabelecimento não encontrado') }));

admin.put('/estabelecimentos/:id/plano',
    registrarAtividade((req) => `Plano alterado para ${planos[req.body.plano]?.nome}`, (req) => req.params.id),
    rota('Erro ao alterar plano', async (req, res) => {
        if (!planos[req.body.plano]) throw new ErroHttp(400, 'Plano inválido');
        const result = await req.app.get('db').query('UPDATE postos SET plano = $1 WHERE posto_id = $2 RETURNING posto_id, plano', [req.body.plano, req.params.id]);
        if (!result.rowCount) throw new ErroHttp(404, 'Estabelecimento não encontrado');
        res.json(result.rows[0]);
    }));

// Gerentes

const sqlGerentes = `SELECT u.usuario_id, u.nome, u.email, u.telefone, u.ativo, u.created_at, u.ultimo_acesso, ${sqlStatusGerente} AS status,
        COALESCE((SELECT json_agg(json_build_object('posto_id', p.posto_id, 'nome', p.nome, 'cidade', p.cidade, 'uf', p.uf, 'ativo', p.ativo,
            'vinculado_em', pu.created_at,
            'cnpj_posto', (SELECT e.cnpj FROM empresas e WHERE e.posto_id = p.posto_id AND e.tipo = 'combustivel' ORDER BY e.empresa_id LIMIT 1)) ORDER BY p.nome)
          FROM postos_usuarios pu JOIN postos p USING (posto_id) WHERE pu.usuario_id = u.usuario_id), '[]') AS postos
    FROM usuarios u
    WHERE u.perfil = 'gerente' AND ($1::int IS NULL OR u.usuario_id = $1)
    ORDER BY u.nome`;

function validarGerente(dados, senhaObrigatoria) {
    if (!new Usuario(dados).validar() || !dados.telefone?.trim()) throw new ErroHttp(400, 'Nome, e-mail e telefone são obrigatórios');
    if ((senhaObrigatoria || dados.senha) && String(dados.senha ?? '').length < 8) throw new ErroHttp(400, 'A senha precisa ter pelo menos 8 caracteres');
}

admin.get('/gerentes', listar('Erro ao listar gerentes', sqlGerentes, () => [null]));

admin.get('/gerentes/:id', rota('Erro ao carregar gerente', async (req, res) => {
    const pool = req.app.get('db');
    const [gerente, historico] = await Promise.all([pool.query(sqlGerentes, [req.params.id]), pool.query(sqlAtividades, [req.params.id, 10])]);
    if (!gerente.rowCount) throw new ErroHttp(404, 'Gerente não encontrado');
    res.json({ ...gerente.rows[0], historico: historico.rows });
}));

admin.post('/gerentes',
    registrarAtividade((req) => `Gerente cadastrado (${req.body.nome})`, (req) => req.body.posto_id),
    rota('Erro ao cadastrar gerente', async (req, res) => {
        validarGerente(req.body, true);
        const { nome, email, telefone, senha, posto_id } = req.body;
        const senhaHash = await bcrypt.hash(senha, 10);
        const usuarioId = await transacao(req.app.get('db'), async (client) => {
            const usuario = await client.query(
                `INSERT INTO usuarios (nome, email, telefone, senha, perfil) VALUES ($1, $2, $3, $4, 'gerente') RETURNING usuario_id`,
                [nome.trim(), email.trim(), telefone.trim(), senhaHash],
            );
            if (posto_id) await vincularGerentes(client, posto_id, [usuario.rows[0].usuario_id]);
            return usuario.rows[0].usuario_id;
        });
        res.status(201).json({ usuario_id: usuarioId });
    }, errosGerente));

admin.put('/gerentes/:id',
    registrarAtividade((req) => `Dados do gerente atualizados (${req.body.nome})`, () => null),
    rota('Erro ao editar gerente', async (req, res) => {
        validarGerente(req.body, false);
        const { nome, email, telefone, senha } = req.body;
        const senhaHash = senha ? await bcrypt.hash(senha, 10) : null;
        const result = await req.app.get('db').query(
            `UPDATE usuarios SET nome = $1, email = $2, telefone = $3, senha = COALESCE($4, senha)
             WHERE usuario_id = $5 AND perfil = 'gerente' RETURNING usuario_id`,
            [nome.trim(), email.trim(), telefone.trim(), senhaHash, req.params.id],
        );
        if (!result.rowCount) throw new ErroHttp(404, 'Gerente não encontrado');
        res.json(result.rows[0]);
    }, errosGerente));

admin.patch('/gerentes/:id',
    registrarAtividade((req) => (req.body.ativo ? 'Acesso de gerente reativado' : 'Acesso de gerente inativado'), () => null),
    alterarAtivo('usuarios', 'usuario_id', 'Gerente não encontrado'));

// Vincula o gerente e reativa o acesso dele, caso tenha sido inativado ao perder o último vínculo.
admin.post('/gerentes/:id/postos/:postoId',
    registrarAtividade(() => 'Gerente vinculado ao estabelecimento'),
    rota('Erro ao vincular gerente', async (req, res) => {
        const result = await req.app.get('db').query(
            `WITH vinculo AS (
                INSERT INTO postos_usuarios (posto_id, usuario_id)
                SELECT $1::int, usuario_id FROM usuarios WHERE usuario_id = $2 AND perfil = 'gerente'
                ON CONFLICT DO NOTHING
            )
            UPDATE usuarios SET ativo = true WHERE usuario_id = $2 AND perfil = 'gerente' RETURNING usuario_id`,
            [req.params.postoId, req.params.id],
        );
        if (!result.rowCount) throw new ErroHttp(404, 'Gerente não encontrado');
        res.status(201).json({ usuario_id: result.rows[0].usuario_id, posto_id: Number(req.params.postoId) });
    }, { '23503': new ErroHttp(404, 'Estabelecimento não encontrado') }));

// Sem nenhum vínculo restante, o gerente perde o acesso.
admin.delete('/gerentes/:id/postos/:postoId',
    registrarAtividade(() => 'Gerente desvinculado do estabelecimento'),
    rota('Erro ao desvincular gerente', async (req, res) => {
        const { id: usuarioId, postoId } = req.params;
        const restantes = await transacao(req.app.get('db'), async (client) => {
            const removido = await client.query('DELETE FROM postos_usuarios WHERE posto_id = $1 AND usuario_id = $2', [postoId, usuarioId]);
            if (!removido.rowCount) throw new ErroHttp(404, 'Vínculo não encontrado');
            const total = (await client.query('SELECT count(*)::int AS total FROM postos_usuarios WHERE usuario_id = $1', [usuarioId])).rows[0].total;
            if (total === 0) await client.query('UPDATE usuarios SET ativo = false WHERE usuario_id = $1', [usuarioId]);
            return total;
        });
        res.json({ message: 'Gerente desvinculado do estabelecimento', usuario_inativado: restantes === 0 });
    }));

export default admin;
