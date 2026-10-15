DROP TABLE IF EXISTS "logs_auditoria" CASCADE;
DROP TABLE IF EXISTS "observacoes" CASCADE;
DROP TABLE IF EXISTS "divergencias" CASCADE;
DROP TABLE IF EXISTS "fechamento_empresa" CASCADE;
DROP TABLE IF EXISTS "fechamento_cnpj" CASCADE; -- caso ainda exista do script antigo
DROP TABLE IF EXISTS "fechamento_maquinas" CASCADE;
DROP TABLE IF EXISTS "fechamentos" CASCADE;
DROP TABLE IF EXISTS "operadores" CASCADE;
DROP TABLE IF EXISTS "maquinas" CASCADE;
DROP TABLE IF EXISTS "empresas" CASCADE;
DROP TABLE IF EXISTS "posto_usuarios" CASCADE; -- nome antigo (com INHERITS)
DROP TABLE IF EXISTS "postos_usuarios" CASCADE; -- nome novo
DROP TABLE IF EXISTS "usuarios" CASCADE;
DROP TABLE IF EXISTS "postos" CASCADE;

