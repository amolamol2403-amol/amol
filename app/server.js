const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

app.use(express.json());
app.get('/healthz', (_req, res) => res.send('ok'));
app.get('/', (_req, res) => res.type('html').send(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contact Registration</title>
<style>body{font:16px system-ui;background:#f5f7fb;margin:0}.box{max-width:540px;margin:48px auto;background:#fff;padding:32px;border-radius:12px;box-shadow:0 4px 20px #0002}h1{margin-top:0;color:#172554}input,button{box-sizing:border-box;width:100%;padding:12px;margin:7px 0;border-radius:6px;border:1px solid #cbd5e1}button{border:0;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}li{padding:9px 0;border-bottom:1px solid #e2e8f0}.msg{min-height:20px;color:#047857}</style></head>
<body><main class="box"><h1>Contact Registration</h1><form id="form"><input name="name" placeholder="Full name" required maxlength="120"><input name="email" type="email" placeholder="Email address" required maxlength="255"><input name="phone" placeholder="Mobile number" required maxlength="40"><button>Submit</button></form><p id="message" class="msg"></p><h2>Saved contacts</h2><ul id="contacts"></ul></main>
<script>const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function load(){let r=await fetch('/api/contacts'),a=await r.json();contacts.innerHTML=a.map(x=>'<li><b>'+esc(x.name)+'</b><br>'+esc(x.email)+' · '+esc(x.phone)+'</li>').join('')}form.onsubmit=async e=>{e.preventDefault();let b=Object.fromEntries(new FormData(form));let r=await fetch('/api/contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});message.textContent=r.ok?'Contact saved successfully.':'Unable to save contact.';if(r.ok){form.reset();load()}};load()</script></body></html>`));
app.get('/api/contacts', async (_req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,phone,created_at FROM contacts ORDER BY id DESC');
  res.json(rows);
});
app.post('/api/contacts', async (req, res) => {
  const { name, email, phone } = req.body;
  if (![name,email,phone].every(v => typeof v === 'string' && v.trim())) return res.status(400).json({ error: 'Name, email, and phone are required.' });
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return res.status(400).json({ error: 'Invalid email.' });
  await pool.query('INSERT INTO contacts(name,email,phone) VALUES($1,$2,$3)', [name.trim(),email.trim(),phone.trim()]);
  res.status(201).json({ message: 'Saved.' });
});
ensureDatabase().then(() => app.listen(process.env.PORT || 3000, () => console.log('Contact app listening on port 3000'))).catch(err => { console.error(err); process.exit(1); });
