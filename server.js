const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
app.use(express.json()); 

let db; 

const PRIORIDADES = ['baixa', 'media', 'alta'];
const STATUS = ['aberto', 'em_andamento', 'concluido'];

async function iniciarBanco() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS chamados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL CHECK (length(titulo) >= 5),
      descricao TEXT NOT NULL,
      prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa', 'media', 'alta')),
      status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'concluido')),
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Banco conectado e tabela chamados pronta.');
}

function vazio(valor) {
  return typeof valor !== 'string' || valor.trim() === '';
}


function validarChamado({ titulo, descricao, prioridade, status }) {
  if (vazio(titulo) || vazio(descricao) || vazio(prioridade)) {
    return 'titulo, descricao e prioridade são obrigatórios.';
  }

  if (titulo.trim().length < 5) {
    return 'O título precisa ter no mínimo 5 caracteres.';
  }

  if (!PRIORIDADES.includes(prioridade)) {
    return "Prioridade inválida. Use: 'baixa', 'media' ou 'alta'.";
  }


  if (status !== undefined && !STATUS.includes(status)) {
    return "Status inválido. Use: 'aberto', 'em_andamento' ou 'concluido'.";
  }

  return null; // tudo certo
}


app.post('/chamados', async (req, res) => {
  const dados = req.body || {};

  const erroValidacao = validarChamado(dados);
  if (erroValidacao) {
    return res.status(400).json({ erro: erroValidacao });
  }

  try {
    const resultado = await db.run(
      'INSERT INTO chamados (titulo, descricao, prioridade, status) VALUES (?, ?, ?, ?)',
      [dados.titulo.trim(), dados.descricao.trim(), dados.prioridade, dados.status || 'aberto']
    );

    const novoChamado = await db.get('SELECT * FROM chamados WHERE id = ?', [resultado.lastID]);
    res.status(201).json(novoChamado);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar chamado no banco.' });
  }
});


app.get('/chamados', async (req, res) => {
  try {
    const chamados = await db.all('SELECT * FROM chamados ORDER BY id');
    res.json(chamados);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar chamados no banco.' });
  }
});

app.get('/chamados/:id', async (req, res) => {
  const id = Number(req.params.id);

  try {
    const chamado = await db.get('SELECT * FROM chamados WHERE id = ?', [id]);

    if (!chamado) {
      return res.status(404).json({ erro: 'Chamado não encontrado.' });
    }

    res.json(chamado);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar chamado no banco.' });
  }
});

app.put('/chamados/:id', async (req, res) => {
  const id = Number(req.params.id);
  const dados = req.body || {};

  try {
    
    const existente = await db.get('SELECT * FROM chamados WHERE id = ?', [id]);
    if (!existente) {
      return res.status(404).json({ erro: 'Chamado não encontrado.' });
    }

    const erroValidacao = validarChamado(dados);
    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao });
    }

    await db.run(
      'UPDATE chamados SET titulo = ?, descricao = ?, prioridade = ?, status = ? WHERE id = ?',
      [
        dados.titulo.trim(),
        dados.descricao.trim(),
        dados.prioridade,
        dados.status || existente.status,
        id,
      ]
    );

    const atualizado = await db.get('SELECT * FROM chamados WHERE id = ?', [id]);
    res.json(atualizado);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar chamado no banco.' });
  }
});

app.delete('/chamados/:id', async (req, res) => {
  const id = Number(req.params.id);

  try {
    const resultado = await db.run('DELETE FROM chamados WHERE id = ?', [id]);

    if (resultado.changes === 0) {
      return res.status(404).json({ erro: 'Chamado não encontrado.' });
    }

    res.json({ mensagem: 'Chamado removido com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover chamado do banco.' });
  }
});

iniciarBanco()
  .then(() => {
    app.listen(3000, () => {
      console.log('Servidor rodando em http://localhost:3000');
    });
  })
  .catch((erro) => {
    console.error('Erro ao iniciar o banco:', erro);
  });