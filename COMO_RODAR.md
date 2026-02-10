# 🚀 Como Rodar o App - Guia para Iniciantes

## 📋 Pré-requisito

✅ Node.js instalado (você está instalando agora)

---

## 🔧 Passo a Passo Completo

### Passo 1: Verificar se o Node.js foi instalado corretamente

**Depois que a instalação terminar:**

1. Feche qualquer terminal que esteja aberto
2. Abra um **novo PowerShell** ou **Prompt de Comando**
   - Pressione `Windows + R`
   - Digite: `powershell`
   - Pressione Enter

3. Digite e pressione Enter:
   ```bash
   node --version
   ```

4. Você deve ver algo como: `v24.13.0`

5. Agora digite:
   ```bash
   npm --version
   ```

6. Você deve ver algo como: `10.x.x`

✅ **Se viu as versões, o Node.js está instalado!**

❌ **Se deu erro "comando não encontrado":**
   - Reinicie o computador
   - Tente abrir um novo terminal novamente

---

### Passo 2: Navegar até a pasta do projeto

No PowerShell/Terminal, digite exatamente:

```bash
cd "c:\Geral\Alice\Provas Antigas\APP\residencia-app"
```

Pressione Enter.

✅ **Confirmação:** O caminho no terminal deve mudar para mostrar essa pasta.

---

### Passo 3: Instalar as dependências do projeto

Agora digite:

```bash
npm install
```

Pressione Enter.

**O que vai acontecer:**
- ⏳ Vai aparecer uma barra de progresso
- 📦 Vai baixar MUITOS arquivos (isso é normal!)
- ⏱️ Pode demorar **2-5 minutos** dependendo da internet
- 💾 Vai criar uma pasta chamada `node_modules` (não mexa nela!)

**Aguarde até aparecer algo como:**
```
added 500 packages in 3m
```

✅ **Pronto! Dependências instaladas.**

---

### Passo 4: Configurar as variáveis de ambiente

**Importante para conectar com o Supabase:**

1. Na pasta do projeto, você tem um arquivo: `.env.example`

2. Crie uma **cópia** desse arquivo e renomeie para: `.env.local`

3. Abra o arquivo `.env.local` em um editor de texto

4. Preencha com suas credenciais do Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

**Onde encontrar essas informações:**
- Acesse: https://supabase.com/dashboard
- Entre no seu projeto
- Vá em: Settings → API
- Copie:
  - `Project URL` → cole em `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → cole em `NEXT_PUBLIC_SUPABASE_ANON_KEY`

5. Salve o arquivo `.env.local`

---

### Passo 5: Rodar o servidor de desenvolvimento

No terminal (ainda na pasta do projeto), digite:

```bash
npm run dev
```

Pressione Enter.

**O que vai acontecer:**
- ⚡ O servidor vai iniciar
- 🌐 Vai aparecer uma mensagem tipo:
  ```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Ready in 3.5s
  ```

✅ **Pronto! O app está rodando!**

⚠️ **NÃO FECHE ESTE TERMINAL** enquanto quiser usar o app.

---

### Passo 6: Acessar o app no navegador

1. Abra seu navegador (Chrome, Edge, Firefox, etc.)

2. Digite na barra de endereço:
   ```
   http://localhost:3000
   ```

3. Pressione Enter

🎉 **Você deve ver a tela inicial do App de Residência!**

---

## 🎯 Navegando pelo App

**Telas principais que você pode acessar:**

1. **Home** - `http://localhost:3000`
   - 4 cards principais
   - Seções de atividades recentes

2. **Biblioteca de Provas** - `http://localhost:3000/app/provas`
   - Buscar e filtrar provas

3. **Simulados** - `http://localhost:3000/app/simulados`
   - Ver simulados sugeridos

4. **Monta Provas com IA** ⭐ - `http://localhost:3000/app/monta-provas`
   - Criar prova personalizada com o agente

5. **Perfil** - `http://localhost:3000/app/profile`
   - Configurar preferências

---

## 🛑 Como Parar o Servidor

Quando quiser parar o app:

1. Vá no terminal onde está rodando
2. Pressione: `Ctrl + C`
3. Confirme se perguntar: `S` ou `Y` + Enter

---

## ▶️ Como Rodar Novamente

Depois de parar, para rodar de novo:

1. Abra o terminal
2. Navegue até a pasta:
   ```bash
   cd "c:\Geral\Alice\Provas Antigas\APP\residencia-app"
   ```
3. Rode:
   ```bash
   npm run dev
   ```
4. Acesse: `http://localhost:3000`

---

## ⚠️ Problemas Comuns

### Erro: "Port 3000 já está em uso"

**Solução:**
- Outro app está usando a porta 3000
- Pare esse outro app ou
- Use outra porta:
  ```bash
  npm run dev -- -p 3001
  ```
  Depois acesse: `http://localhost:3001`

### Erro: "Cannot find module..."

**Solução:**
- Delete a pasta `node_modules`
- Delete o arquivo `package-lock.json`
- Rode novamente: `npm install`

### Tela branca ou erro no navegador

**Solução:**
1. Verifique se o `.env.local` está configurado
2. Veja se o terminal mostra erros em vermelho
3. Tente: `Ctrl + C` → `npm run dev` (reiniciar)

---

## 💡 Dicas

✅ **Recomendações:**
- Use o **Chrome** ou **Edge** para melhor experiência
- Mantenha o terminal aberto enquanto usa o app
- Se fizer alterações no código, a página atualiza sozinha!
- **Não precisa reiniciar** o servidor ao editar arquivos

❌ **Não faça:**
- Não delete a pasta `node_modules`
- Não feche o terminal se quiser usar o app
- Não edite o arquivo `.env.example` (use `.env.local`)

---

## 📞 Precisa de Ajuda?

Se algo der errado:

1. Copie a mensagem de erro que apareceu
2. Me mostre (tire print ou copie o texto)
3. Te ajudo a resolver!

---

🎓 **Bons estudos com o App de Residência!**
