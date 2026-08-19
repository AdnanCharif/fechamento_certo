let token = null;
let usuarioId = null;
let postoAtualId = null;
 
// ---------- LOGIN ----------
async function fazerLogin() {
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';
 
  try {
    const resp = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
 
    const data = await resp.json();
 
    if (!resp.ok) {
      erroEl.textContent = data.error || 'Erro ao logar';
      return;
    }
 
    token = data.token;
    usuarioId = data.usuario.usuario_id;
 
    document.getElementById('usuario-logado').textContent = data.usuario.nome;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
 
    carregarPostos();
  } catch (err) {
    erroEl.textContent = 'Erro de conexão com o servidor';
    console.error(err);
  }
}
 
function fazerLogout() {
  token = null;
  usuarioId = null;
  postoAtualId = null;
 
  document.getElementById('app-section').style.display = 'none';
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
}
 
// ---------- POSTOS ----------
async function carregarPostos() {
  const resp = await fetch(`/postos/${usuarioId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const postos = await resp.json();
 
  const tbody = document.querySelector('#tabela-postos tbody');
  tbody.innerHTML = '';
 
  postos.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.posto_id}</td>
      <td>${p.nome_posto}</td>
      <td><button onclick="selecionarPosto(${p.posto_id}, '${p.nome_posto}')">Ver usuários</button></td>
    `;
    tbody.appendChild(tr);
  });
}
 
function selecionarPosto(postoId, nomePosto) {
  postoAtualId = postoId;
  document.getElementById('posto-selecionado').textContent = `${nomePosto} (id ${postoId})`;
  carregarUsuarios();
}
 
// ---------- USUARIOS DO POSTO ----------
async function carregarUsuarios() {
  if (!postoAtualId) return;
 
  const resp = await fetch(`/postos/${postoAtualId}/usuarios`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const usuarios = await resp.json();
 
  const tbody = document.querySelector('#tabela-usuarios tbody');
  tbody.innerHTML = '';
 
  usuarios.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.usuario_id}</td>
      <td>${u.nome}</td>
      <td>${u.email}</td>
      <td><button onclick="removerUsuario(${u.usuario_id})">Remover</button></td>
    `;
    tbody.appendChild(tr);
  });
}
 
async function adicionarUsuario() {
  const erroEl = document.getElementById('add-erro');
  erroEl.textContent = '';
 
  if (!postoAtualId) {
    erroEl.textContent = 'Selecione um posto primeiro';
    return;
  }
 
  const nome = document.getElementById('novo-nome').value;
  const email = document.getElementById('novo-email').value;
  const senha = document.getElementById('novo-senha').value;
 
  try {
    const resp = await fetch(`/postos/${postoAtualId}/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nome, email, senha })
    });
 
    const data = await resp.json();
 
    if (!resp.ok) {
      erroEl.textContent = data.error || 'Erro ao adicionar usuário';
      return;
    }
 
    document.getElementById('novo-nome').value = '';
    document.getElementById('novo-email').value = '';
    document.getElementById('novo-senha').value = '';
 
    carregarUsuarios();
  } catch (err) {
    erroEl.textContent = 'Erro de conexão com o servidor';
    console.error(err);
  }
}
 
async function removerUsuario(usuarioIdParaRemover) {
  if (!postoAtualId) return;
 
  try {
    const resp = await fetch(`/postos/${postoAtualId}/usuarios/${usuarioIdParaRemover}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
 
    if (!resp.ok) {
      const data = await resp.json();
      alert(data.error || 'Erro ao remover usuário');
      return;
    }
 
    carregarUsuarios();
  } catch (err) {
    alert('Erro de conexão com o servidor');
    console.error(err);
  }
}