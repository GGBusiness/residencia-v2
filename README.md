# 🎓 App de Residência Médica

> **Preparação inteligente para residência médica com IA**

## 🚀 Sobre o Projeto

App completo de preparação para residência médica com recursos de:

- ✅ **Biblioteca de Provas** - Acesso a provas de ENARE, USP, UNICAMP, UNIFESP e mais
- ✅ **Simulados Personalizados** - Simulados sugeridos e histórico completo
- ✅ **Monta Provas com IA** - Agente inteligente que monta provas personalizadas
- ✅ **Dois Modos de Estudo**:
  - **Modo Prova**: Correção apenas no final (simula prova real)
  - **Modo Estudo**: Feedback imediato após cada questão
- ✅ **Correção Detalhada** - Explicações completas para cada questão
- ✅ **Acompanhamento de Progresso** - Histórico e estatísticas

## 🛠️ Tecnologias

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (Design System personalizado)
- **Supabase** (Backend, Auth, Database, Storage)
- **Lucide Icons**
- **Zustand** (State Management)

## 📁 Estrutura do Projeto

```
residencia-app/
├── app/
│   ├── app/                    # Rotas principais
│   │   ├── home/              # Tela inicial
│   │   ├── provas/            # Biblioteca de provas
│   │   ├── simulados/         # Simulados
│   │   ├── aulas/             # PDF de aulas
│   │   ├── monta-provas/      # Agente IA (⭐ principal)
│   │   ├── prova/[id]/        # Execução da prova
│   │   ├── prova/[id]/result/ # Correção e resultado
│   │   ├── history/           # Histórico
│   │   └── profile/           # Perfil
│   ├── layout.tsx             # Layout root
│   └── globals.css            # Estilos globais
├── components/
│   ├── ui/                    # Componentes reutilizáveis
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Skeleton.tsx
│   └── layout/
│       └── AppLayout.tsx      # Layout principal
├── lib/
│   ├── supabase.ts            # Cliente Supabase
│   ├── data-service.ts        # Camada de acesso a dados
│   └── utils.ts               # Utilitários
└── package.json
```

## 🎯 Funcionalidades Principais

### 1. Monta Provas com IA ⭐

O **diferencial do app**. Um wizard conversacional que:

1. Coleta preferências do usuário (objetivo, área, nº questões, anos)
2. Escolhe modo de feedback (Prova vs Estudo)
3. Monta um plano personalizado
4. Gera a prova sob medida

**Exemplo de fluxo:**
```
Agente: "Qual é o seu objetivo?"
Usuário: [Seleciona "Prova completa"]

Agente: "Em qual área você quer focar?"
Usuário: [Seleciona "Clínica Médica"]

Agente: "Quantas questões?"
Usuário: [Seleciona "60"]

Agente: "Como você prefere estudar?"
Usuário: [Seleciona "Modo Prova"]

Agente: "Plano da Prova pronto! ✅"
```

### 2. Execução da Prova

**Modo Prova (padrão):**
- Sem feedback durante a execução
- Correção completa no final
- Simula experiência real de prova

**Modo Estudo:**
- Feedback imediato após cada resposta
- Mostra correta vs marcada
- Explicação inline
- Ideal para aprendizado

**Recursos:**
- Grade de navegação (Q1..QN)
- Marcação de questões para revisão
- Timer (opcional)
- Autosave automático
- Contadores (respondidas/marcadas/não respondidas)

### 3. Correção e Explicações

Tela de resultado com:
- Estatísticas de performance (%, certas, erradas)
- Filtros (todas, certas, erradas, não respondidas)
- Explicações detalhadas expandíveis
- Indicação visual de acertos/erros
- Comparação resposta marcada vs correta

### 4. Biblioteca de Provas

- Busca por texto
- Filtros:
  - Grande área (CM, Cirurgia, GO, Ped, Preventiva)
  - Ano
  - Instituição/Programa
  - Somente com gabarito
- Cards com metadados completos
- Ações: Ver PDF | Usar na prova

## 🔧 Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Instalação

```bash
npm install
```

### 3. Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### 4. Build

```bash
npm run build
npm start
```

## 🗄️ Backend (Supabase)

O app espera as seguintes tabelas no Supabase:

- `users` - Usuários
- `documents` - Provas/Documentos (PDFs)
- `attempts` - Tentativas de prova
- `attempt_answers` - Respostas das tentativas
- `questions` - Questões (quando estruturadas)
- `user_preferences` - Preferências do usuário

Ver [`02_Schema_SQL.md`](../02_Schema_SQL.md) para o schema completo.

## 🎨 Design System

**Cores:**
- Primary: Indigo (#4f46e5)
- Success: Green (#22c55e)
- Error: Red (#ef4444)
- Warning: Amber (#f59e0b)

**Componentes:**
- `Button` - 4 variantes (primary, secondary, outline, ghost)
- `Card` - Composable (Card, CardHeader, CardBody, CardFooter)
- `Badge` - 5 variantes de cor
- `Skeleton` - Loading states

**Layout:**
- Desktop: Sidebar fixa à esquerda
- Mobile: Bottom navigation

## 📱 Mobile-First

Todo o app é responsivo e otimizado para mobile:
- Layouts adaptáveis
- Bottom navigation em mobile
- Touch-friendly buttons
- Modais e overlays mobile-optimized

## 🚧 Próximos Passos

- [ ] Implementação completa de autenticação
- [ ] Upload/Ingestão de PDFs
- [ ] Parser de questões de PDF
- [ ] Visualizador de PDF integrado
- [ ] Sistema de revisão espaçada
- [ ] Dashboard de analytics

## 📝 Notas de Implementação

### Data Access Layer

`lib/data-service.ts` é a **camada de abstração** para o backend:

```typescript
import { dataService } from '@/lib/data-service';

// Buscar documentos
const { data, count } = await dataService.searchDocuments({ ... });

// Criar tentativa
const attempt = await dataService.createAttempt(config, userId);

// Salvar resposta
await dataService.upsertAttemptAnswer({ ... });
```

### Fallbacks e Adaptação

O app foi projetado com **fallbacks automáticos**:

- Se não houver `program`, mapeia de `institution`
- Se não houver `correct_option`, não afirma gabarito
- Se não houver `explanation`, mostra "Explicação indisponível"
- Normaliza arrays vs strings automaticamente

### Mock Data

Atualmente usa **MOCK_QUESTIONS** para demonstração.
Em produção, substituir por:

```typescript
const questions = await dataService.getQuestionsByDocument(documentId);
```

## 👨‍💻 Autor

Desenvolvido com ❤️ para estudantes de medicina

## 📄 Licença

Este projeto é privado e proprietário.

---

**Bons estudos! 🎓**

# Deploy Update: 02/10/2026 15:04:13
