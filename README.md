# Sistema DRPS

Plataforma web para o **Diagnóstico de Riscos Psicossociais (DRPS)**, alinhada à NR-01, que permite às empresas aplicar questionários de riscos psicossociais aos colaboradores, acompanhar agendamentos e palestras, e gerar relatórios de risco por setor e por tópico.

## Aplicação principal: `drps-platform`

O código da aplicação está na pasta `drps-platform/`, construída com React 19, TypeScript, Vite e TailwindCSS.

### Principais funcionalidades

- Landing page pública e fluxo de autenticação (`Auth.tsx`)
- Questionário (`Survey.tsx`) respondido pelos colaboradores
- Cálculo automático de gravidade e nível de risco por tópico, seguindo a matriz de risco da NR-01 (`src/services/riskCalculator.ts`)
- Painel administrativo: visão geral, gestão de empresas, relatório por empresa, gestão de usuários, agenda e conteúdo
- Painel do colaborador: dashboard pessoal, agenda e conteúdo
- Geração de relatórios em PDF (`jspdf`/`jspdf-autotable`) e importação/exportação de planilhas (`xlsx`)
- Gráficos e dashboards com `recharts`, e calendário de agendamentos com `react-calendar`

### Estrutura de pastas (`drps-platform/`)

- `src/pages/` — telas da aplicação (Landing, Auth, Survey, `admin/*`, `colaborador/*`)
- `src/layouts/` — layouts de navegação (AdminLayout, ColaboradorLayout)
- `src/context/` — contextos de estado (AuthContext, AdminContext, ColaboradorContext)
- `src/services/` — regras de negócio (`questions.ts`, `riskCalculator.ts`, `pdfGenerator.ts`, `supabase.ts`)
- `src/components/` — componentes reutilizáveis (ImportSpreadsheetModal, RouteGuards)
- `api/` — funções serverless (create-user, delete-user, list-users) para operações administrativas
- `supabase/migrations/` — migrações do banco de dados Supabase
- `modelodrps.pdf` — modelo de referência do relatório/diagnóstico

### Tecnologias

React 19, Vite, TypeScript, TailwindCSS, Supabase (autenticação e banco de dados), react-router-dom, recharts, react-calendar, jspdf, xlsx, date-fns, lucide-react.

### Como rodar localmente

1. `cd drps-platform`
2. `npm install`
3. Configurar as variáveis de ambiente do Supabase (URL e chave anônima) exigidas por `src/services/supabase.ts`
4. `npm run dev` — inicia o servidor de desenvolvimento (Vite)
5. `npm run build` — gera a build de produção
6. `npm run preview` — pré-visualiza a build de produção

### Deploy

O projeto contém `vercel.json`, indicando deploy na Vercel.

## Projeto relacionado

Este front-end é a interface do Sistema DRPS. Uma nova infraestrutura de backend em AWS (DynamoDB, Cognito, S3, API Gateway e Lambdas) está em desenvolvimento no repositório [`drps-infra`](https://github.com/pedrohsouzadf/drps-infra), incluindo um script de migração dos dados do Supabase para a nova base.
