// Registro de atividades reutilizável: o middleware entra antes do handler da rota e,
// quando a resposta sai com sucesso, grava a ação em logs_atividade.
// descricao(req, corpo) e postoId(req, corpo) recebem o corpo da resposta, então
// também funcionam em cadastros, onde o id só existe depois do INSERT.
export const registrarAtividade = (descricao, postoId = (req) => req.params.postoId) => (req, res, next) => {
  const enviarJson = res.json.bind(res);
  res.json = (corpo) => {
    if (res.statusCode < 400) {
      req.app.get('db').query(
        'INSERT INTO logs_atividade (usuario_id, posto_id, descricao) VALUES ($1, $2, $3)',
        [req.usuarioAutenticado.usuario_id, postoId(req, corpo) ?? null, descricao(req, corpo).slice(0, 255)],
      ).catch((err) => console.error('Erro ao registrar atividade:', err));
    }
    return enviarJson(corpo);
  };
  next();
};

// Atividades recentes: logs_atividade mais as ações sobre fechamentos (logs_auditoria).
// Uma edição grava uma linha por campo no mesmo instante; o DISTINCT junta essas linhas.
export const sqlAtividades = `SELECT a.created_at, a.descricao, u.usuario_id, u.nome AS usuario_nome, u.perfil, p.posto_id, p.nome AS posto_nome
    FROM (
        SELECT created_at, descricao, usuario_id, posto_id FROM logs_atividade
        UNION ALL
        SELECT DISTINCT la.created_at, la.acao || ' (' || to_char(f.data_referencia, 'DD/MM') || ')', la.usuario_id, f.posto_id
        FROM logs_auditoria la JOIN fechamentos f USING (fechamento_id)
    ) a
    JOIN usuarios u USING (usuario_id)
    LEFT JOIN postos p USING (posto_id)
    WHERE ($1::int IS NULL OR a.usuario_id = $1)
    ORDER BY a.created_at DESC
    LIMIT $2`;
