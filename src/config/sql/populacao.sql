-- ============================================================
-- POPULAÇÃO DO BANCO — Une Caixas / Fechamento Certo
-- 3 postos | 2 empresas por posto | 5 máquinas por empresa | 5 operadores por empresa
-- ============================================================
 
-- ------------------------------------------------------------
-- 1. POSTOS (3)
-- ------------------------------------------------------------
INSERT INTO postos (posto_id, nome, endereco, created_at) VALUES
(1, 'Meu Posto - Matriz',      'Av. das Torres, 1200, Curitiba/PR', NOW()),
(2, 'Posto Bela Vista',        'Rua Getúlio Vargas, 450, Curitiba/PR', NOW()),
(3, 'Posto Rodovia Sul',       'BR-116, Km 32, Curitiba/PR', NOW());
 
-- ------------------------------------------------------------
-- 2. EMPRESAS (2 por posto = 6 no total)
-- ------------------------------------------------------------
INSERT INTO empresas (empresa_id, posto_id, nome, cnpj, tipo, created_at) VALUES
-- Posto 1 - Meu Posto - Matriz
(1, 1, 'Posto Max',        '12.345.678/0001-01', 'combustivel',  NOW()),
(2, 1, 'Dia a Dia',        '12.345.678/0002-02', 'conveniencia', NOW()),
-- Posto 2 - Posto Bela Vista
(3, 2, 'Bela Vista Fuel',  '23.456.789/0001-03', 'combustivel',  NOW()),
(4, 2, 'Mercadinho BV',    '23.456.789/0002-04', 'conveniencia', NOW()),
-- Posto 3 - Posto Rodovia Sul
(5, 3, 'Rodovia Combustíveis', '34.567.890/0001-05', 'combustivel',  NOW()),
(6, 3, 'Parada Sul Conveniência', '34.567.890/0002-06', 'conveniencia', NOW());
 
-- ------------------------------------------------------------
-- 3. MÁQUINAS (5 por empresa = 30 no total)
-- ------------------------------------------------------------
INSERT INTO maquinas (maquina_id, empresa_id, nome, ativo, created_at) VALUES
-- Empresa 1 - Posto Max
(1,  1, 'Stone POS 1',  true, NOW()),
(2,  1, 'Cielo Máq 1',  true, NOW()),
(3,  1, 'Rede Máq 1',   true, NOW()),
(4,  1, 'Stone POS 2',  true, NOW()),
(5,  1, 'GetNet Máq 1', true, NOW()),
-- Empresa 2 - Dia a Dia
(6,  2, 'Stone POS 3',  true, NOW()),
(7,  2, 'Cielo Máq 2',  true, NOW()),
(8,  2, 'Rede Máq 2',   true, NOW()),
(9,  2, 'Vero Máq 1',   true, NOW()),
(10, 2, 'GetNet Máq 2', true, NOW()),
-- Empresa 3 - Bela Vista Fuel
(11, 3, 'Stone POS 4',  true, NOW()),
(12, 3, 'Cielo Máq 3',  true, NOW()),
(13, 3, 'Rede Máq 3',   true, NOW()),
(14, 3, 'PagSeguro Máq 1', true, NOW()),
(15, 3, 'GetNet Máq 3', true, NOW()),
-- Empresa 4 - Mercadinho BV
(16, 4, 'Stone POS 5',  true, NOW()),
(17, 4, 'Cielo Máq 4',  true, NOW()),
(18, 4, 'Rede Máq 4',   true, NOW()),
(19, 4, 'Vero Máq 2',   true, NOW()),
(20, 4, 'PagSeguro Máq 2', true, NOW()),
-- Empresa 5 - Rodovia Combustíveis
(21, 5, 'Stone POS 6',  true, NOW()),
(22, 5, 'Cielo Máq 5',  true, NOW()),
(23, 5, 'Rede Máq 5',   true, NOW()),
(24, 5, 'GetNet Máq 4', true, NOW()),
(25, 5, 'PagSeguro Máq 3', true, NOW()),
-- Empresa 6 - Parada Sul Conveniência
(26, 6, 'Stone POS 7',  true, NOW()),
(27, 6, 'Cielo Máq 6',  true, NOW()),
(28, 6, 'Rede Máq 6',   true, NOW()),
(29, 6, 'Vero Máq 3',   true, NOW()),
(30, 6, 'GetNet Máq 5', true, NOW());
 
-- ------------------------------------------------------------
-- 4. OPERADORES (5 por empresa = 30 no total)
-- ------------------------------------------------------------
INSERT INTO operadores (operador_id, empresa_id, nome, ativo, created_at) VALUES
-- Empresa 1 - Posto Max
(1,  1, 'João Silva',        true, NOW()),
(2,  1, 'Carlos Souza',      true, NOW()),
(3,  1, 'Pedro Almeida',     true, NOW()),
(4,  1, 'Lucas Ferreira',    true, NOW()),
(5,  1, 'Rafael Costa',      true, NOW()),
-- Empresa 2 - Dia a Dia
(6,  2, 'Mariana Lima',      true, NOW()),
(7,  2, 'Fernanda Rocha',    true, NOW()),
(8,  2, 'Juliana Ribeiro',   true, NOW()),
(9,  2, 'Camila Santos',     true, NOW()),
(10, 2, 'Beatriz Martins',   true, NOW()),
-- Empresa 3 - Bela Vista Fuel
(11, 3, 'Gabriel Oliveira',  true, NOW()),
(12, 3, 'Thiago Pereira',    true, NOW()),
(13, 3, 'Bruno Carvalho',    true, NOW()),
(14, 3, 'Diego Nascimento',  true, NOW()),
(15, 3, 'Felipe Barros',     true, NOW()),
-- Empresa 4 - Mercadinho BV
(16, 4, 'Aline Cardoso',     true, NOW()),
(17, 4, 'Patrícia Gomes',    true, NOW()),
(18, 4, 'Larissa Teixeira',  true, NOW()),
(19, 4, 'Vanessa Correia',   true, NOW()),
(20, 4, 'Débora Araújo',     true, NOW()),
-- Empresa 5 - Rodovia Combustíveis
(21, 5, 'Marcos Vinícius',   true, NOW()),
(22, 5, 'André Luiz',        true, NOW()),
(23, 5, 'Rodrigo Alves',     true, NOW()),
(24, 5, 'Eduardo Ramos',     true, NOW()),
(25, 5, 'Gustavo Pinto',     true, NOW()),
-- Empresa 6 - Parada Sul Conveniência
(26, 6, 'Renata Moreira',    true, NOW()),
(27, 6, 'Simone Dias',       true, NOW()),
(28, 6, 'Tatiane Freitas',   true, NOW()),
(29, 6, 'Priscila Nunes',    true, NOW()),
(30, 6, 'Amanda Duarte',     true, NOW());