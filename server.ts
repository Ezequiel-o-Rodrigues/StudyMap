import express from "express";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Configuração do Banco de Dados (Preferência por DATABASE_URL)
const connectionString = process.env.DATABASE_URL;
const poolConfig = { 
  connectionString, 
  ssl: { rejectUnauthorized: false } 
};

// Validação de variáveis de ambiente essenciais
const isDbConfigured = !!(connectionString || (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD));

if (!isDbConfigured) {
  console.warn('AVISO: Configurações do banco de dados (DATABASE_URL ou PG*) não encontradas.');
}

const pool = new Pool(poolConfig);

// Retry logic para conexão inicial
let retries = 5;
async function connectWithRetry() {
  while (retries > 0) {
    try {
      const client = await pool.connect();
      console.log('Conexão com o banco de dados estabelecida com sucesso.');
      client.release();
      break;
    } catch (err) {
      retries -= 1;
      console.error(`Erro ao conectar ao banco de dados. Tentativas restantes: ${retries}`, err);
      if (retries === 0) {
        console.error('Não foi possível conectar ao banco de dados após várias tentativas.');
      } else {
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }
}

connectWithRetry();

// Testar conexão ao iniciar
pool.on('error', (err) => {
  console.error('Erro inesperado no pool do Postgres:', err);
});

// Configuração Supabase (para validação de JWT)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabaseClient: any = null;
function getSupabase() {
  if (!supabaseClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('AVISO: SUPABASE_URL ou SUPABASE_ANON_KEY não configurados.');
      return null;
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

// Middleware de Autenticação
const authenticate = async (req: any, res: any, next: any) => {
  const supabase = getSupabase();
  if (!supabase) {
    // Se não estiver configurado, podemos permitir o acesso em desenvolvimento ou retornar erro
    // Para segurança, vamos retornar erro se não estiver configurado
    return res.status(500).json({ error: "Serviço de autenticação não configurado" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Token inválido" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Erro na autenticação" });
  }
};

// Middleware de Admin
const isAdmin = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Não autenticado" });
  
  const email = req.user.email;
  const userId = req.user.id;
  
  // Regra especial hardcoded para segurança extra
  if (email === 'ezequielrod2020@gmail.com' || email === 'admin@techify.one') {
    console.log(`Admin access granted via hardcoded email: ${email}`);
    return next();
  }

  try {
    const result = await pool.query("SELECT role FROM user_roles WHERE user_id = $1::uuid", [userId]);
    const userRole = result.rows[0]?.role;
    
    if (userRole === 'admin') {
      console.log(`Admin access granted via DB role for user: ${userId} (${email})`);
      next();
    } else {
      console.warn(`Admin access denied for user: ${userId} (${email}). Role found: ${userRole}`);
      res.status(403).json({ error: "Acesso negado: Requer privilégios de administrador" });
    }
  } catch (err) {
    console.error(`Error checking admin permissions for user ${userId}:`, err);
    res.status(500).json({ error: "Erro ao verificar permissões" });
  }
};

// Configuração n8n
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.coolify.teste.techify.run/webhook/gerar-avaliacao';
const N8N_API_KEY = process.env.N8N_API_KEY;

// --- SCHEMAS DE VALIDAÇÃO (ZOD) ---
const NodeSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  order_index: z.number().int(),
  links: z.union([z.string(), z.array(z.any())]).optional()
});

const ProgressSchema = z.object({
  user_id: z.string().uuid(),
  node_id: z.string().uuid(),
  completed: z.boolean()
});

const ReportSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  node_id: z.string().uuid(),
  content: z.string().optional(),
  attachments: z.array(z.any()).optional(),
  status: z.string().optional(),
  teacher_feedback: z.string().optional()
});

/**
 * Inicializa o banco de dados criando as tabelas necessárias se não existirem.
 */
async function initDb() {
  if (!isDbConfigured) return;

  let client;
  try {
    client = await pool.connect();
    console.log('Iniciando inicialização do banco de dados...');
    
    // Tabela de Módulos (Nodes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        order_index INTEGER NOT NULL,
        links JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Tabela de Perfis de Usuário
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        user_id UUID PRIMARY KEY,
        full_name TEXT,
        email TEXT,
        avatar_url TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Tabela de Papéis (Roles)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID PRIMARY KEY,
        role TEXT NOT NULL DEFAULT 'student',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Tabela de Progresso
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress (
        user_id UUID NOT NULL,
        node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        completed BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, node_id)
      )
    `);

    // Tabela de Relatórios/Entregas
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        content TEXT,
        attachments JSONB DEFAULT '[]',
        status TEXT DEFAULT 'pending',
        teacher_feedback TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Tabela de Banco de Questões IA (Cache)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_assessments_bank (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        content_source_url TEXT,
        difficulty TEXT,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer INTEGER NOT NULL,
        explanation TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Tabela de Resultados de Testes dos Alunos
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_test_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        score INTEGER,
        passed BOOLEAN,
        chat_history JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Adiciona colunas se não existirem (para migração)
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_test_results' AND column_name='link_url') THEN
          ALTER TABLE student_test_results ADD COLUMN link_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_test_results' AND column_name='difficulty') THEN
          ALTER TABLE student_test_results ADD COLUMN difficulty TEXT;
        END IF;
      END $$;
    `);

    console.log('Banco de dados inicializado com sucesso.');

    // Seed: Se a tabela de módulos estiver vazia, popula com os dados iniciais
    const nodesCount = await client.query("SELECT COUNT(*) FROM nodes");
    if (parseInt(nodesCount.rows[0].count, 10) === 0) {
      console.log('Semeando dados iniciais de módulos...');
      await client.query(`
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
        ('Módulo 10: Central de Cursos e Referências', 'Acesso às comunidades e canais essenciais para continuar evoluindo.', 9, '[{"type":"course","title":"Sem Codar","url":"https://comunidade.semcodar.com.br/","credentials":"User: estudo.techys@gmail.com | Pass: #@Estudo147"},{"type":"course","title":"Pack Typebot","url":"https://packtypebot.com.br/cursos/pack-typebot/","credentials":"User: estudo.techys@gmail.com | Pass: #@Estudo147"},{"type":"course","title":"AI Builders","url":"https://comunidade.aibuilders.com.br/","credentials":"User: estudo.techys@gmail.com | Pass: #@Estudo147"},{"type":"course","title":"Adapta","url":"https://app.adapta.one/","credentials":"User: automacao.redesbrasil@gmail.com | Pass: Redes147#@"},{"type":"course","title":"Arquiteto Renato Augusto","url":"https://hotmart.com/pt-BR/club/renato-augusto/products/5683152","credentials":"User: licencas.techify@gmail.com | Pass: HotTech147#@"},{"type":"youtube","title":"Canal: Promovaweb","url":"https://www.youtube.com/@promovaweb"},{"type":"youtube","title":"Canal: Lucas Montano","url":"https://www.youtube.com/@LucasMontano"}]')
      `);
      console.log('Seed de módulos concluído.');
    }
  } catch (err) {
    console.error('Erro ao inicializar banco de dados:', err);
  } finally {
    if (client) client.release();
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // Inicializa o banco de dados em segundo plano para não bloquear o início do servidor
  initDb().then(() => {
    console.log('Database initialization background task completed.');
  }).catch(err => {
    console.error('Critical error during background database initialization:', err);
  });

  // Health check aprimorado
  app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    try {
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } catch (err) {
      dbStatus = "error";
    }
    
    res.json({ 
      status: "ok", 
      database: dbStatus,
      env: process.env.NODE_ENV || "development"
    });
  });

  // --- API ROUTES ---

  // Nodes (Módulos)
  app.get("/api/nodes", authenticate, async (req: any, res: any) => {
    try {
      const result = await pool.query("SELECT * FROM nodes ORDER BY order_index ASC");
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar módulos" });
    }
  });

  app.post("/api/nodes", authenticate, isAdmin, async (req: any, res: any) => {
    try {
      const validated = NodeSchema.parse(req.body);
      const { title, description, order_index, links } = validated;
      const result = await pool.query(
        "INSERT INTO nodes (title, description, order_index, links) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description, order_index, typeof links === 'string' ? links : JSON.stringify(links)]
      );
      res.json(result.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: err.issues });
      }
      console.error(err);
      res.status(500).json({ error: "Erro ao criar módulo" });
    }
  });

  app.put("/api/nodes/:id", authenticate, isAdmin, async (req: any, res: any) => {
    const { id } = req.params;
    try {
      const validated = NodeSchema.parse(req.body);
      const { title, description, order_index, links } = validated;
      const result = await pool.query(
        "UPDATE nodes SET title = $1, description = $2, order_index = $3, links = $4 WHERE id = $5 RETURNING *",
        [title, description, order_index, typeof links === 'string' ? links : JSON.stringify(links), id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: err.issues });
      }
      console.error(err);
      res.status(500).json({ error: "Erro ao atualizar módulo" });
    }
  });

  app.delete("/api/nodes/:id", authenticate, isAdmin, async (req: any, res: any) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM nodes WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao deletar módulo" });
    }
  });

  app.post("/api/nodes/bulk-delete", authenticate, isAdmin, async (req: any, res: any) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs inválidos" });
    }
    try {
      await pool.query("DELETE FROM nodes WHERE id = ANY($1::uuid[])", [ids]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao deletar módulos em massa" });
    }
  });

  app.post("/api/nodes/reorder", authenticate, isAdmin, async (req: any, res: any) => {
    const { orders } = req.body; // Array de { id, order_index }
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: "Dados de ordenação inválidos" });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of orders) {
        await client.query("UPDATE nodes SET order_index = $1 WHERE id = $2", [item.order_index, item.id]);
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: "Erro ao reordenar módulos" });
    } finally {
      client.release();
    }
  });

  // Progress
  app.get("/api/progress/:userId", authenticate, async (req: any, res: any) => {
    const { userId } = req.params;
    
    // Apenas o próprio usuário ou admin pode ver o progresso
    if (req.user.id !== userId) {
      const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
      if (adminCheck.rows[0]?.role !== 'admin' && req.user.email !== 'ezequielrod2020@gmail.com') {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    try {
      const result = await pool.query("SELECT * FROM progress WHERE user_id = $1", [userId]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar progresso" });
    }
  });

  app.post("/api/progress", authenticate, async (req: any, res: any) => {
    try {
      const validated = ProgressSchema.parse(req.body);
      const { user_id, node_id, completed } = validated;

      // Apenas o próprio usuário ou admin pode salvar progresso
      if (req.user.id !== user_id) {
        const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
        if (adminCheck.rows[0]?.role !== 'admin' && req.user.email !== 'ezequielrod2020@gmail.com') {
          return res.status(403).json({ error: "Acesso negado" });
        }
      }

      const result = await pool.query(
        "INSERT INTO progress (user_id, node_id, completed) VALUES ($1, $2, $3) ON CONFLICT (user_id, node_id) DO UPDATE SET completed = EXCLUDED.completed, updated_at = NOW() RETURNING *",
        [user_id, node_id, completed]
      );
      res.json(result.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: err.issues });
      }
      console.error(err);
      res.status(500).json({ error: "Erro ao salvar progresso" });
    }
  });

  // Reports
  app.get("/api/reports/:userId", authenticate, async (req: any, res: any) => {
    const { userId } = req.params;

    // Apenas o próprio usuário ou admin pode ver relatórios
    if (req.user.id !== userId) {
      const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
      if (adminCheck.rows[0]?.role !== 'admin' && req.user.email !== 'ezequielrod2020@gmail.com') {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    try {
      const result = await pool.query("SELECT * FROM reports WHERE user_id = $1", [userId]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar relatórios" });
    }
  });

  app.get("/api/reports/node/:nodeId", authenticate, async (req: any, res: any) => {
    const { nodeId } = req.params;
    const { userId } = req.query;

    // Apenas o próprio usuário ou admin pode ver relatório
    if (req.user.id !== userId) {
      const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
      if (adminCheck.rows[0]?.role !== 'admin' && req.user.email !== 'ezequielrod2020@gmail.com') {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    try {
      const result = await pool.query("SELECT * FROM reports WHERE node_id = $1 AND user_id = $2", [nodeId, userId]);
      res.json(result.rows[0] || null);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar relatório" });
    }
  });

  app.post("/api/reports", authenticate, async (req: any, res: any) => {
    try {
      const validated = ReportSchema.parse(req.body);
      const { id, user_id, node_id, content, attachments, status, teacher_feedback } = validated;

      // Apenas o próprio usuário pode enviar relatório (admin não envia relatório para outros)
      if (req.user.id !== user_id) {
        return res.status(403).json({ error: "Acesso negado: Você só pode enviar seus próprios relatórios" });
      }

      let result;
      if (id) {
        result = await pool.query(
          "UPDATE reports SET content = $1, attachments = $2, status = $3, teacher_feedback = $4, updated_at = NOW() WHERE id = $5 RETURNING *",
          [content, JSON.stringify(attachments || []), status, teacher_feedback, id]
        );
      } else {
        result = await pool.query(
          "INSERT INTO reports (user_id, node_id, content, attachments, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [user_id, node_id, content, JSON.stringify(attachments || []), status || 'pending']
        );
      }
      res.json(result.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: err.issues });
      }
      console.error(err);
      res.status(500).json({ error: "Erro ao salvar relatório" });
    }
  });

  // AI Assessment: Generate questions via n8n
  app.post("/api/assessments/generate", authenticate, async (req: any, res: any) => {
    const { node_id, node_title, link_url, difficulty, user_email } = req.body;

    try {
      // Timeout de 180 segundos para a chamada ao n8n (o novo prompt é mais complexo e demora mais)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const payload = {
        node_id,
        node_title,
        link_url,
        difficulty,
        user_email
      };

      console.log('Sending request to n8n:', JSON.stringify(payload, null, 2));

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(N8N_API_KEY ? { 'X-N8N-API-KEY': N8N_API_KEY } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`n8n returned ${response.status}`);
      }

      const generated = await response.json();
      res.json(generated);
    } catch (err: any) {
      console.error('Error calling n8n:', err);
      if (err.name === 'AbortError') {
        res.status(504).json({ error: "O servidor de IA demorou muito para responder. Tente novamente." });
      } else {
        res.status(500).json({ error: "Erro ao gerar avaliação via IA" });
      }
    }
  });

  // AI Assessment Bank (Cache)
  app.get("/api/assessments/bank", authenticate, async (req: any, res: any) => {
    const { node_id, url, difficulty } = req.query;
    try {
      const result = await pool.query(
        "SELECT * FROM ai_assessments_bank WHERE node_id = $1 AND content_source_url = $2 AND difficulty = $3 LIMIT 3",
        [node_id, url, difficulty]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar cache de questões" });
    }
  });

  app.delete("/api/assessments/cache", authenticate, async (req: any, res: any) => {
    const { node_id, link_url, difficulty } = req.query;
    try {
      await pool.query(
        "DELETE FROM ai_assessments_bank WHERE node_id = $1 AND content_source_url = $2 AND difficulty = $3",
        [node_id, link_url, difficulty]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao limpar cache" });
    }
  });

  app.post("/api/assessments/bank", authenticate, async (req: any, res: any) => {
    const questions = Array.isArray(req.body) ? req.body : [req.body]; // Handle single object or array
    try {
      const inserted = [];
      for (const q of questions) {
        if (!q.question) continue; // Skip empty objects
        
        let options = q.options;
        
        // Se n8n enviar como string, tentamos converter para objeto real
        if (typeof options === 'string') {
          try {
            // Tenta parsear se for um JSON válido
            options = JSON.parse(options);
          } catch (e) {
            // Se não for JSON válido (ex: "A, B, C"), tenta dar split
            console.warn('Opções recebidas como string não-JSON, tentando split:', options);
            options = options.split(/[,\n]/).map((o: string) => o.trim()).filter(Boolean);
          }
        }

        // Se por algum motivo ainda não for um array, garantimos que seja
        if (!Array.isArray(options)) {
          options = options ? [options] : [];
        }

        // Se o array estiver vazio, não faz sentido salvar
        if (options.length === 0) continue;

        // Converter correct_answer para número se for letra (A, B, C, D)
        let correctAnswer = q.correct_answer;
        if (typeof correctAnswer === 'string') {
          const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
          const upper = correctAnswer.trim().toUpperCase().charAt(0);
          if (letterMap[upper] !== undefined) {
            correctAnswer = letterMap[upper];
          } else {
            correctAnswer = parseInt(correctAnswer, 10) || 0;
          }
        } else {
          correctAnswer = parseInt(correctAnswer, 10) || 0;
        }

        const result = await pool.query(
          "INSERT INTO ai_assessments_bank (node_id, content_source_url, difficulty, question, options, correct_answer, explanation) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
          [q.node_id, q.content_source_url, q.difficulty, q.question, JSON.stringify(options), correctAnswer, q.explanation || '']
        );
        inserted.push(result.rows[0]);
      }
      res.json(inserted);
    } catch (err) {
      console.error('Erro ao salvar no banco:', err);
      res.status(500).json({ error: "Erro ao salvar questões no banco", details: err.message });
    }
  });

  // Student Test Results
  app.get("/api/assessments/results/:userId", authenticate, async (req: any, res: any) => {
    const { userId } = req.params;
    const { node_id } = req.query;

    // Apenas o próprio usuário ou admin pode ver resultados
    if (req.user.id !== userId) {
      const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
      if (adminCheck.rows[0]?.role !== 'admin' && req.user.email !== 'ezequielrod2020@gmail.com') {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    try {
      let query = "SELECT * FROM student_test_results WHERE user_id = $1";
      let params = [userId];
      if (node_id) {
        query += " AND node_id = $2 ORDER BY passed DESC, created_at DESC";
        params.push(node_id as string);
      }
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar resultados de testes" });
    }
  });

  app.post("/api/assessments/results", authenticate, async (req: any, res: any) => {
    const { user_id, node_id, link_url, difficulty, score, passed, chat_history } = req.body;

    // Apenas o próprio usuário pode salvar seus resultados
    if (req.user.id !== user_id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    try {
      const result = await pool.query(
        "INSERT INTO student_test_results (user_id, node_id, link_url, difficulty, score, passed, chat_history) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [user_id, node_id, link_url, difficulty, score, passed, JSON.stringify(chat_history)]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao salvar resultado do teste" });
    }
  });

  // User Roles
  app.get("/api/roles/:userId", authenticate, async (req: any, res: any) => {
    const { userId } = req.params;

    // Apenas o próprio usuário ou admin pode ver role
    if (req.user.id !== userId) {
      const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
      if (adminCheck.rows[0]?.role !== 'admin' && req.user.email !== 'ezequielrod2020@gmail.com') {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    try {
      const result = await pool.query("SELECT * FROM user_roles WHERE user_id = $1", [userId]);
      res.json(result.rows[0] || { role: 'student' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar role" });
    }
  });

  app.post("/api/roles", authenticate, async (req: any, res: any) => {
    const { user_id, role, email, promoCode } = req.body;

    // Apenas o próprio usuário (na criação) ou admin pode definir roles
    const isAdminUser = req.user.email === 'ezequielrod2020@gmail.com' || req.user.email === 'admin@techify.one';
    
    if (req.user.id !== user_id && !isAdminUser) {
      const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
      if (adminCheck.rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    try {
      let finalRole = 'student';

      // Regra 1: Email do proprietário sempre é admin
      if (email === 'ezequielrod2020@gmail.com' || email === 'admin@techify.one') {
        finalRole = 'admin';
      } 
      // Regra 2: Código de professor válido
      else if (promoCode?.toUpperCase() === 'TEACHER2025') {
        finalRole = 'admin';
      }
      // Regra 3: Admin existente tentando mudar role de outro
      else if (isAdminUser || (await pool.query("SELECT role FROM user_roles WHERE user_id = $1::uuid", [req.user.id])).rows[0]?.role === 'admin') {
        finalRole = role || 'student';
      }

      const result = await pool.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role RETURNING *",
        [user_id, finalRole]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao salvar role" });
    }
  });

  // Admin: Get all students and their progress
  app.get("/api/admin/students", authenticate, isAdmin, async (req: any, res: any) => {
    try {
      const result = await pool.query(`
        SELECT 
          ur.user_id, 
          ur.role,
          p.full_name,
          p.email,
          (SELECT COUNT(*) FROM progress pr WHERE pr.user_id::uuid = ur.user_id::uuid AND pr.completed = true) as completed_count
        FROM user_roles ur
        LEFT JOIN profiles p ON ur.user_id::uuid = p.user_id::uuid
        WHERE ur.role = 'student'
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar alunos" });
    }
  });

  // Admin: Get all reports with node titles
  app.get("/api/admin/reports", authenticate, isAdmin, async (req: any, res: any) => {
    try {
      const result = await pool.query(`
        SELECT r.*, n.title as node_title, n.order_index
        FROM reports r
        JOIN nodes n ON r.node_id = n.id
        ORDER BY r.updated_at DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar relatórios" });
    }
  });

  // Admin: Get all profiles
  app.get("/api/admin/profiles", authenticate, isAdmin, async (req: any, res: any) => {
    try {
      const result = await pool.query("SELECT * FROM profiles");
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar perfis" });
    }
  });

  app.post("/api/profiles", authenticate, async (req: any, res: any) => {
    const { user_id, full_name, email, avatar_url } = req.body;

    // Apenas o próprio usuário ou admin pode atualizar perfil
    if (req.user.id !== user_id) {
      const adminCheck = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.user.id]);
      if (adminCheck.rows[0]?.role !== 'admin' && req.user.email !== 'ezequielrod2020@gmail.com') {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    try {
      const result = await pool.query(
        "INSERT INTO profiles (user_id, full_name, email, avatar_url, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, updated_at = NOW() RETURNING *",
        [user_id, full_name, email, avatar_url]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao salvar perfil" });
    }
  });

  // Admin: Review report
  app.post("/api/admin/review-report", authenticate, isAdmin, async (req: any, res: any) => {
    const { id, status, teacher_feedback } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        "UPDATE reports SET status = $1, teacher_feedback = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
        [status, teacher_feedback, id]
      );

      if (result.rows.length === 0) {
        throw new Error("Relatório não encontrado");
      }

      const report = result.rows[0];

      // Se aprovado, atualiza automaticamente o progresso do aluno
      if (status === 'approved') {
        await client.query(
          "INSERT INTO progress (user_id, node_id, completed) VALUES ($1, $2, $3) ON CONFLICT (user_id, node_id) DO UPDATE SET completed = EXCLUDED.completed, updated_at = NOW()",
          [report.user_id, report.node_id, true]
        );
      }

      await client.query('COMMIT');
      res.json(report);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Error reviewing report:', err);
      res.status(500).json({ error: "Erro ao avaliar relatório: " + err.message });
    } finally {
      client.release();
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
