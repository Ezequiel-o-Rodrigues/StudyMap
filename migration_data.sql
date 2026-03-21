-- 1. Inserir Módulos (Nodes)
-- Estes são os módulos base da trilha de estudos
INSERT INTO nodes (title, description, order_index, links) VALUES 
('Módulo 1: Consumo de APIs e JSON', 'Aprenda a base da comunicação entre sistemas: JSON, Postman, Curl e integrações iniciais com Typebot e N8N.', 0, '[{"type":"reference","title":"Introdução a JSON","url":"https://www.json.org/"},{"type":"course","title":"Postman Academy","url":"https://learning.postman.com/"},{"type":"youtube","title":"Como usar cURL","url":"https://www.youtube.com/results?search_query=como+usar+curl"},{"type":"reference","title":"Documentação Typebot","url":"https://docs.typebot.io/"}]'),
('Módulo 2: Webhooks e Servidores', 'Entenda o conceito de Webhook Server e Client. Integre N8N, Botconversa, Stripe e ferramentas de chat.', 1, '[{"type":"youtube","title":"Webhook vs API","url":"https://www.youtube.com/watch?v=oDXDYjksMds"},{"type":"reference","title":"Stripe Webhooks Guide","url":"https://stripe.com/docs/webhooks"},{"type":"course","title":"Botconversa Docs","url":"https://help.botconversa.com.br/"}]'),
('Módulo 3: Dominando o N8N', 'Funcionamento do n8n, uso de chat e fields, e a diferença crucial entre modo Teste e Produção.', 2, '[{"type":"youtube","title":"Curso Completo N8N (Interfaces)","url":"https://youtu.be/3hvNCeWDdKQ?si=XF7pDiKrdN4IPfe-"},{"type":"youtube","title":"Agentes de IA no N8N","url":"https://www.youtube.com/watch?v=vpyllOeLhs4"},{"type":"reference","title":"N8N Documentation","url":"https://docs.n8n.io/"}]'),
('Módulo 4: Lógica e Manipulação de Texto', 'Operações essenciais: Regex, Replace, Split, Operador Ternário, Manipulação de Datas e Estruturas de Dados.', 3, '[{"type":"reference","title":"Regex101: Teste seu Regex","url":"https://regex101.com/"},{"type":"youtube","title":"Manipulação de Arrays JS","url":"https://www.youtube.com/results?search_query=javascript+array+methods"},{"type":"reference","title":"MDN: String Methods","url":"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String"}]'),
('Módulo 5: Operações com Dados (DB)', 'Integração com Google Sheets, Supabase, Nocodb, Baserow e bancos SQL/NoSQL (Postgres, Mongo, MySQL).', 4, '[{"type":"reference","title":"Supabase Docs","url":"https://supabase.com/docs"},{"type":"course","title":"Google Sheets API","url":"https://developers.google.com/sheets/api"},{"type":"youtube","title":"Por que não usar FLOAT para dinheiro","url":"https://www.youtube.com/watch?v=vFBUWtrzz48"}]'),
('Módulo 6: Fluxos Avançados e Debug', 'Loops, Debugging, HTTP Requests complexos e Webhook Respond para criar automações profissionais.', 5, '[{"type":"youtube","title":"Microsserviços e DDD","url":"https://www.youtube.com/watch?v=JXeJUfBCg4U"},{"type":"reference","title":"N8N: Error Handling","url":"https://docs.n8n.io/hosting/scaling/error-handling/"}]'),
('Módulo 7: Projetos Práticos (Geral)', 'Exercícios: Resumo de grupos, automação de vendas, bots de moderação com IA e assistentes pessoais.', 6, '[{"type":"youtube","title":"RAG vs Fine Tuning","url":"https://www.youtube.com/watch?v=00Q0G84kq3M"},{"type":"youtube","title":"Agentic RAG + Knowledge Graphs","url":"https://www.youtube.com/watch?v=p0FERNkpyHE"}]'),
('Módulo 8: Node.js e Backend', 'Subir servidor Express, Middlewares, POO, Classes Built-in e Debug avançado com VS Code.', 7, '[{"type":"course","title":"Curso.dev","url":"https://curso.dev/"},{"type":"reference","title":"Express.js Guide","url":"https://expressjs.com/"}]'),
('Módulo 9: Infraestrutura e Linux', 'Comandos básicos, SSH, Debug de rede, Processos e Modelagem de Banco de Dados (Joins, Triggers).', 8, '[{"type":"youtube","title":"O Fim da Programação?","url":"https://youtu.be/vaFHawMRsps"},{"type":"reference","title":"Linux Journey","url":"https://linuxjourney.com/"}]'),
('Módulo 10: Central de Cursos e Referências', 'Acesso às comunidades e canais essenciais para continuar evoluindo.', 9, '[{"type":"course","title":"Sem Codar","url":"https://comunidade.semcodar.com.br/","credentials":"User: estudo.techys@gmail.com | Pass: #@Estudo147"},{"type":"course","title":"Pack Typebot","url":"https://packtypebot.com.br/cursos/pack-typebot/","credentials":"User: estudo.techys@gmail.com | Pass: #@Estudo147"},{"type":"course","title":"AI Builders","url":"https://comunidade.aibuilders.com.br/","credentials":"User: estudo.techys@gmail.com | Pass: #@Estudo147"},{"type":"course","title":"Adapta","url":"https://app.adapta.one/","credentials":"User: automacao.redesbrasil@gmail.com | Pass: Redes147#@"},{"type":"course","title":"Arquiteto Renato Augusto","url":"https://hotmart.com/pt-BR/club/renato-augusto/products/5683152","credentials":"User: licencas.techify@gmail.com | Pass: HotTech147#@"},{"type":"youtube","title":"Canal: Promovaweb","url":"https://www.youtube.com/@promovaweb"},{"type":"youtube","title":"Canal: Lucas Montano","url":"https://www.youtube.com/@LucasMontano"}]');

-- 2. Inserir Perfis e Roles (Exemplos)
-- IMPORTANTE: Substitua os UUIDs abaixo pelos IDs reais dos usuários que aparecem no Supabase Auth.

-- Exemplo: Instrutor (Admin)
-- INSERT INTO profiles (user_id, full_name, avatar_url) VALUES 
-- ('UUID_DO_INSTRUTOR', 'Nome do Instrutor', 'https://avatar.url/instrutor.png');

-- INSERT INTO user_roles (user_id, role) VALUES 
-- ('UUID_DO_INSTRUTOR', 'admin');

-- Exemplo: Aluno
-- INSERT INTO profiles (user_id, full_name, avatar_url) VALUES 
-- ('UUID_DO_ALUNO_1', 'João Silva', 'https://avatar.url/aluno1.png');

-- INSERT INTO user_roles (user_id, role) VALUES 
-- ('UUID_DO_ALUNO_1', 'student');

-- 3. Inserir Progresso (Opcional - se quiser migrar o que já foi feito)
-- INSERT INTO progress (user_id, node_id, completed) VALUES 
-- ('UUID_DO_ALUNO_1', (SELECT id FROM nodes WHERE title LIKE '%Módulo 1%'), true);
