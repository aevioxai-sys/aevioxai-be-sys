const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const file = path.join(__dirname, '..', 'data', 'users.json');

function load() {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Failed to load users', err);
    return [];
  }
}

function save(users) {
  fs.writeFileSync(file, JSON.stringify(users, null, 2), 'utf8');
}

async function findByEmail(email) {
  const users = load();
  return users.find(u => u.email === email) || null;
}

async function findById(id) {
  const users = load();
  return users.find(u => u.id === id) || null;
}

async function addUser({ name, email, password, role }) {
  const users = load();
  const user = { id: uuidv4(), name: name || '', email, password, role: role || 'user', createdAt: new Date().toISOString() };
  users.push(user);
  save(users);
  // return copy without password?
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

module.exports = { findByEmail, findById, addUser };
