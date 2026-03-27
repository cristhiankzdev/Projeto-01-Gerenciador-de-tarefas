# 🌸 DayFlow — Tarefas Diárias

Gerenciador de tarefas diárias com grade de 7 dias, categorias, tarefas em etapas e notas rápidas.

---

## 📋 Passo a Passo para Colocar o Projeto no Ar

Siga cada etapa com calma. Não precisa saber programar — é só clicar e copiar!

---

### ETAPA 1 — Criar uma conta no Supabase

O Supabase é o serviço que vai guardar os dados do aplicativo (usuários, tarefas, etc.). É gratuito.

1. Acesse **https://supabase.com**
2. Clique em **"Start your project"** (botão verde)
3. Clique em **"Sign up"** e crie uma conta com seu e-mail
4. Depois de fazer login, clique em **"New project"**
5. Preencha:
   - **Organization**: pode deixar o padrão
   - **Name**: escreva `dayflow` (ou qualquer nome)
   - **Database Password**: crie uma senha forte e **salve em algum lugar seguro**
   - **Region**: escolha `South America (São Paulo)`
6. Clique em **"Create new project"**
7. Aguarde cerca de 1 minuto enquanto o projeto é criado

---

### ETAPA 2 — Criar o banco de dados

Agora vamos criar as tabelas onde as tarefas serão guardadas.

1. No painel do Supabase, clique em **"SQL Editor"** no menu da esquerda
2. Clique em **"New query"** (botão no canto superior esquerdo)
3. Apague qualquer texto que já esteja na caixa
4. Copie **todo** o SQL abaixo e cole na caixa:

```sql
-- Perfis dos usuários
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📌',
  color TEXT NOT NULL DEFAULT '#8C7B6B',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarefas
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  priority TEXT CHECK (priority IN ('alta', 'media', 'baixa')) NOT NULL DEFAULT 'media',
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  type TEXT CHECK (type IN ('simple', 'steps')) DEFAULT 'simple',
  steps JSONB,
  current_step INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notas rápidas
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  content TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Segurança: cada usuário só vê seus próprios dados
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "users_own_categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_notes" ON notes FOR ALL USING (auth.uid() = user_id);

-- Cria categorias padrão automaticamente quando um usuário se cadastra
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, emoji, color) VALUES
    (NEW.id, 'Trabalho', '💼', '#4A7FC1'),
    (NEW.id, 'Pessoal', '🏠', '#7D9B76'),
    (NEW.id, 'Saúde', '❤️', '#D95F5F'),
    (NEW.id, 'Estudos', '📚', '#8B6FBA');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_categories();
```

5. Clique no botão **"Run"** (ícone de play ▶️) ou pressione `Ctrl + Enter`
6. Se aparecer **"Success. No rows returned"**, funcionou! ✅

---

### ETAPA 3 — Pegar as credenciais do Supabase

Agora você precisa copiar dois códigos que permitem ao app se conectar ao banco.

1. No painel do Supabase, clique em **"Settings"** (ícone de engrenagem ⚙️ no menu da esquerda)
2. Clique em **"API"**
3. Você vai ver duas informações importantes:
   - **Project URL** — parece com `https://abcdefghij.supabase.co`
   - **anon public** (dentro de "Project API keys") — uma chave longa que começa com `eyJ...`
4. Copie os dois valores. Você vai usar no próximo passo.

---

### ETAPA 4 — Colar as credenciais no projeto

1. No seu computador, abra a pasta do projeto `dayflow`
2. Abra o arquivo `js/supabase.js` com qualquer editor de texto (Bloco de Notas, VS Code, etc.)
3. Você vai ver estas duas linhas:
   ```
   const SUPABASE_URL = 'COLE_SUA_URL_AQUI'
   const SUPABASE_ANON_KEY = 'COLE_SUA_CHAVE_AQUI'
   ```
4. Substitua `COLE_SUA_URL_AQUI` pela **Project URL** que você copiou
5. Substitua `COLE_SUA_CHAVE_AQUI` pela chave **anon public** que você copiou
6. Salve o arquivo

Exemplo de como deve ficar:
```javascript
const SUPABASE_URL = 'https://abcdefghij.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

---

### ETAPA 5 — Subir o projeto para o GitHub

O GitHub é onde ficará guardado o código do projeto. O Vercel vai buscar o código de lá para publicar.

**Se você ainda não tem uma conta no GitHub:**
1. Acesse **https://github.com** e crie uma conta gratuita

**Subindo o projeto:**

1. Abra o terminal do seu computador:
   - No Windows: pressione `Win + R`, digite `cmd` e aperte Enter
   - Ou use o terminal do VS Code

2. Navegue até a pasta do projeto. Digite e aperte Enter:
   ```
   cd "C:\Users\CRKZ\Desktop\CLAUDE\Projeto 01 - Gerenciador de tarefas\dayflow"
   ```

3. Execute estes comandos um por um (aperte Enter após cada um):
   ```bash
   git init
   git add .
   git commit -m "Primeiro commit do DayFlow"
   ```

4. Crie um novo repositório no GitHub:
   - Acesse **https://github.com/new**
   - Em **Repository name**, escreva `dayflow`
   - Deixe marcado como **Public**
   - Clique em **"Create repository"**

5. O GitHub vai mostrar alguns comandos. Execute os dois últimos no terminal:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/dayflow.git
   git push -u origin main
   ```
   > Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub

6. Se pedir login, entre com seu usuário e senha do GitHub

---

### ETAPA 6 — Fazer o deploy no Vercel

O Vercel vai pegar o código do GitHub e publicar na internet de graça.

1. Acesse **https://vercel.com**
2. Clique em **"Sign Up"** e escolha **"Continue with GitHub"** — isso conecta sua conta do GitHub ao Vercel
3. Depois de entrar, clique em **"Add New Project"**
4. Você vai ver uma lista de repositórios do seu GitHub — clique em **"Import"** ao lado do repositório `dayflow`
5. Na tela de configuração:
   - **Framework Preset**: deixe como `Other`
   - **Root Directory**: deixe em branco (ou coloque `./`)
   - Não precisa mexer em mais nada
6. Clique em **"Deploy"**
7. Aguarde cerca de 1 minuto. Quando aparecer um foguete 🚀 e **"Congratulations!"**, o deploy funcionou!

---

### ETAPA 7 — Acessar o seu app

1. Após o deploy, o Vercel vai mostrar um link como:
   `https://dayflow-abc123.vercel.app`
2. Clique no link — seu app está no ar! 🎉
3. Crie uma conta no app e comece a usar

---

## ❓ Dúvidas comuns

**O app abre mas dá erro ao fazer login?**
→ Verifique se você colou as credenciais corretas no arquivo `js/supabase.js` e fez um novo commit/push.

**As categorias padrão não aparecem ao criar conta?**
→ Certifique-se de que o SQL foi executado com sucesso no Supabase (especialmente o trigger `on_profile_created`).

**Quero atualizar o app depois de fazer mudanças?**
→ Basta executar no terminal:
```bash
git add .
git commit -m "Atualização"
git push
```
O Vercel vai detectar automaticamente e fazer um novo deploy.

---

## 🛠️ Tecnologias usadas

- **HTML, CSS e JavaScript** puro (sem frameworks)
- **Supabase** — banco de dados e autenticação
- **Vercel** — hospedagem gratuita
- **Google Fonts** — Fraunces + DM Sans
