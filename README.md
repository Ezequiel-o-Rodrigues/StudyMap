<div align="center">

# 🗺️ StudyMap

### Plataforma Gamificada de Aprendizado com Inteligência Artificial

*Projeto de Estágio — Ezequiel Oliveira | Techify*

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![n8n](https://img.shields.io/badge/n8n-Automation-EA4B71?logo=n8n&logoColor=white)](https://n8n.io/)
[![Google AI](https://img.shields.io/badge/Google_AI-Gemini-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)

</div>

---

## 💡 A Ideia

<div align="center">
<img src="docs/screenshots/2_A-Ideia.png" alt="A Ideia do StudyMap" width="800"/>
</div>

O **StudyMap** é uma plataforma de aprendizado progressivo que transforma a jornada de estudo em um **mapa interativo gamificado**. O aluno navega por **10 módulos sequenciais** — do consumo de APIs até infraestrutura e Linux — desbloqueando cada etapa conforme avança, como fases de um jogo.

**O Problema:** Como acompanhar o progresso de alunos em trilhas de automação, no-code e IA de forma estruturada, com feedback do instrutor e avaliações inteligentes — sem depender de planilhas e processos manuais?

**A Solução:** Uma plataforma completa que integra gamificação, inteligência artificial e automação de workflows.

---

## 🚀 Os Três Pilares de Inovação

<div align="center">
<img src="docs/screenshots/3_Tres-Pilares-de-Inovacao.png" alt="Três Pilares de Inovação" width="800"/>
</div>

---

### Pilar 1 — Avaliações Inteligentes via n8n + Google AI

<div align="center">
<img src="docs/screenshots/4_Pilar-1-Avaliacoes-Inteligentes-via-n8n.png" alt="Avaliações Inteligentes via n8n" width="800"/>
</div>

O sistema integra o **n8n** (automação de workflows) com a **Google Generative AI (Gemini)** para gerar avaliações dinâmicas e personalizadas:

```
Aluno escolhe material + dificuldade
  → Backend envia para webhook n8n
    → n8n processa com Google AI (Gemini)
      → Questões personalizadas são geradas
        → Cache no banco para reutilização
```

- Cada avaliação é **única**, baseada no conteúdo real estudado
- Três níveis de dificuldade: **Iniciante**, **Intermediário** e **Expert**
- Sistema de **cache inteligente** — evita chamadas repetidas à IA

---

### Pilar 2 — Mapa Horizontal Gamificado

<div align="center">
<img src="docs/screenshots/5_Pilar-2-Mapa-Horizontal-Gamificado.png" alt="Mapa Horizontal Gamificado" width="800"/>
</div>

A interface principal é um mapa horizontal interativo com status visuais:

| Status | Descrição |
|--------|-----------|
| 🔒 **Bloqueado** | Módulo ainda não disponível |
| 📍 **Atual** | Disponível para estudo |
| ✅ **Completo** | Aprovado pelo instrutor |

---

### Pilar 3 — Ciclo Completo Aluno-Instrutor

<div align="center">
<img src="docs/screenshots/6_Pilar-3-Ciclo-Aluno-Instrutor.png" alt="Ciclo Aluno-Instrutor" width="800"/>
</div>

```
📚 Aluno estuda material
  → 📝 Submete relatório de aprendizado
    → 👨‍🏫 Instrutor revisa e dá feedback
      → ✅ Aprovação desbloqueia próximo módulo
```

---

## 🛠️ Stack Tecnológica

<div align="center">
<img src="docs/screenshots/7_Stack-Tecnologica-Moderna.png" alt="Stack Tecnológica" width="800"/>
</div>

| Camada | Tecnologia | Finalidade |
|--------|-----------|------------|
| **Frontend** | React 19 + TypeScript | Interface reativa e tipada |
| **Build** | Vite 6.2 | Build ultrarrápido com HMR |
| **Estilização** | Tailwind CSS 4.1 | Design responsivo e consistente |
| **Animações** | Framer Motion 12 | Transições fluidas e interativas |
| **Backend** | Node.js + Express.js | API RESTful robusta |
| **Banco de Dados** | PostgreSQL (Neon) | Banco serverless escalável |
| **Autenticação** | Supabase Auth (JWT) | Login seguro com tokens |
| **IA** | Google Generative AI (Gemini) | Geração de avaliações inteligentes |
| **Automação** | n8n (self-hosted via Coolify) | Orquestração de workflows de IA |
| **Validação** | Zod 4.3 | Validação de schemas em runtime |

---

## 📐 Arquitetura do Banco de Dados

<div align="center">
<img src="docs/screenshots/8_Arquitetura-do-Banco-de-Dados.png" alt="Arquitetura do Banco de Dados" width="800"/>
</div>

**7 tabelas** projetadas para escalabilidade:

| Tabela | Função |
|--------|--------|
| `nodes` | Módulos de aprendizado (JSONB para links) |
| `profiles` | Perfis de usuário |
| `user_roles` | Controle de acesso (student/admin) |
| `progress` | Rastreamento de conclusão |
| `reports` | Relatórios com feedback do instrutor |
| `ai_assessments_bank` | Cache de questões geradas por IA |
| `student_test_results` | Histórico de avaliações |

---

## 📈 Usabilidade e Escalabilidade

<div align="center">
<img src="docs/screenshots/9_Usabilidade-e-Escalabilidade.png" alt="Usabilidade e Escalabilidade" width="800"/>
</div>

### Usabilidade
- **Onboarding simples** — cadastro via email com Supabase Auth
- **Navegação visual** — mapa horizontal mostra onde o aluno está
- **Barra de progresso** — feedback visual constante
- **Chat de avaliação** — interface conversacional para provas de IA
- **Dashboard do instrutor** — fila de relatórios, aprovação com um clique
- **Animações fluidas** — Framer Motion sem comprometer performance

### Escalabilidade

| Aspecto | Solução |
|---------|---------|
| **Banco de Dados** | Neon (PostgreSQL serverless) — escala sob demanda |
| **Cache de IA** | Questões cacheadas evitam chamadas repetidas ao Gemini |
| **Automação** | n8n desacoplado — escala independentemente |
| **Auth** | Supabase gerencia sessões sem carga no backend |
| **Módulos** | CRUD dinâmico via painel admin — sem redeploy |
| **Conexões** | Pool com retry automático (5 tentativas) |

---

## 🏁 Conclusão

<div align="center">
<img src="docs/screenshots/10_Conclusao.png" alt="Conclusão" width="800"/>
</div>

---

## 📦 Estrutura do Projeto

```
StudyMap/
├── server.ts                    # Backend Express com rotas API
├── vite.config.ts               # Configuração do Vite
├── migration_data.sql           # Seed dos 10 módulos
├── package.json                 # Dependências
├── .env.example                 # Template de variáveis de ambiente
│
├── src/
│   ├── main.tsx                 # Entry point React
│   ├── App.tsx                  # Componente raiz com roteamento
│   ├── index.css                # Estilos globais (Tailwind)
│   ├── types/index.ts           # Interfaces TypeScript
│   ├── services/
│   │   ├── api.ts               # Cliente API do frontend
│   │   └── supabase.ts          # Inicialização Supabase
│   ├── data/mock.ts             # Dados mock dos módulos
│   └── components/
│       ├── Auth.tsx              # Login e cadastro
│       ├── HorizontalMap.tsx     # Mapa de aprendizado
│       ├── MapNode.tsx           # Nó visual do módulo
│       ├── ModuleModal.tsx       # Detalhes do módulo
│       ├── AssessmentChat.tsx    # Interface de avaliação IA
│       ├── AdminDashboard.tsx    # Gestão de módulos
│       ├── StudentsDashboard.tsx # Painel do instrutor
│       └── CourseLibrary.tsx     # Central de cursos
│
└── docs/screenshots/            # Screenshots da aplicação
```

---

## 📚 Módulos de Aprendizado

| # | Módulo | Conteúdo |
|---|--------|----------|
| 1 | **Consumo de APIs e JSON** | APIs, JSON, Postman, cURL, Typebot, n8n |
| 2 | **Webhooks e Servidores** | Servidores, webhooks n8n, Stripe, chatbots |
| 3 | **Dominando o N8N** | Interface n8n, modos de teste/produção, agentes IA |
| 4 | **Lógica e Manipulação de Texto** | Regex, operações com strings, estruturas de dados |
| 5 | **Operações com Dados (DB)** | Google Sheets, Supabase, SQL/NoSQL |
| 6 | **Fluxos Avançados e Debug** | Loops, debugging, tratamento de erros |
| 7 | **Projetos Práticos** | Automação de vendas, bots de moderação, assistentes IA |
| 8 | **Node.js e Backend** | Express, middlewares, OOP, debugging |
| 9 | **Infraestrutura e Linux** | Linux, SSH, modelagem de banco, triggers |
| 10 | **Central de Cursos** | Recursos externos curados e comunidades |

---

## ⚡ Como Executar

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com/)
- Banco PostgreSQL no [Neon](https://neon.tech/)
- Instância [n8n](https://n8n.io/) (opcional, para avaliações IA)

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/StudyMap.git
cd StudyMap

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
```

### Variáveis de Ambiente

```env
# Supabase (Frontend)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

# PostgreSQL (Neon)
DATABASE_URL=postgresql://usuario:senha@host/database?sslmode=require

# Google AI
GEMINI_API_KEY=sua-chave-gemini

# n8n (Avaliações IA)
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/gerar-avaliacao

# App
APP_URL=http://localhost:5173
```

### Executar

```bash
# Modo desenvolvimento
npm run dev

# Build para produção
npm run build
```

---

## 🔐 Autenticação e Roles

| Role | Permissões |
|------|-----------|
| **Student** | Visualizar módulos, estudar materiais, submeter relatórios, fazer avaliações |
| **Admin** | Tudo do Student + criar/editar módulos, revisar relatórios, gerenciar alunos |

---

## 🤝 Autor

**Ezequiel Oliveira** — Projeto de Estágio na [Techify](https://techify.one)

---

<div align="center">

</div>
