const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ID_PEPPER = process.env.ID_PEPPER;

if (!ID_PEPPER) {
  throw new Error('ID_PEPPER environment variable is required.');
}

function hashSensitiveValue(value) {
  return crypto
    .createHmac('sha256', ID_PEPPER)
    .update(value)
    .digest('hex');
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function ensureDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      dob DATE NOT NULL,
      aadhaar_hash CHAR(64) NOT NULL,
      voter_id_hash CHAR(64),
      passport_hash CHAR(64),
      driving_licence_hash CHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dob DATE');
  await pool.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS aadhaar_hash CHAR(64)');
  await pool.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS voter_id_hash CHAR(64)');
  await pool.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS passport_hash CHAR(64)');
  await pool.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS driving_licence_hash CHAR(64)');
}

app.use(express.json({ limit: '20kb' }));

app.get('/healthz', (_req, res) => res.send('ok'));

app.get('/', (_req, res) => res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Contact Registration</title>
  <style>
    body { font:16px system-ui; background:#f5f7fb; margin:0; }
    .box { max-width:540px; margin:48px auto; background:#fff; padding:32px;
      border-radius:12px; box-shadow:0 4px 20px #0002; }
    h1 { margin-top:0; color:#172554; }
    input, button { box-sizing:border-box; width:100%; padding:12px; margin:7px 0;
      border-radius:6px; border:1px solid #cbd5e1; }
    button { border:0; background:#2563eb; color:#fff; font-weight:700; cursor:pointer; }
    label { display:block; margin-top:10px; font-weight:600; }
    .msg { min-height:20px; color:#047857; }
    .note { color:#475569; font-size:14px; }
  </style>
</head>
<body>
  <main class="box">
    <h1>Contact Registration</h1>

    <form id="form">
      <input name="name" placeholder="Full name" required maxlength="120">
      <input name="email" type="email" placeholder="Email address" required maxlength="255">
      <input name="phone" inputmode="tel" placeholder="Mobile number" required maxlength="40">

      <label>Date of birth</label>
      <input name="dob" type="date" required>

      <input name="aadhaar" inputmode="numeric" pattern="[0-9]{12}"
        placeholder="12-digit Aadhaar number" required maxlength="12">

      <input name="voterId" placeholder="Voter ID / EPIC number (optional)"
        maxlength="20" style="text-transform:uppercase">

      <input name="passportNumber" placeholder="Passport number (optional)"
        maxlength="20" style="text-transform:uppercase">

      <input name="drivingLicence" placeholder="Driving licence number (optional)"
        maxlength="40" style="text-transform:uppercase">

      <button type="submit">Submit</button>
    </form>

    <p id="message" class="msg"></p>
    <p class="note">
      Sensitive identity numbers are not displayed after submission.
    </p>
  </main>

  <script>
    const form = document.getElementById('form');
    const message = document.getElementById('message');

    form.onsubmit = async (event) => {
      event.preventDefault();

      const body = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      message.textContent = response.ok
        ? 'Details saved successfully.'
        : (data.error || 'Unable to save details.');

      if (response.ok) form.reset();
    };
  </script>
</body>
</html>`));

app.post('/api/contacts', async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      dob,
      aadhaar,
      voterId = '',
      passportNumber = '',
      drivingLicence = ''
    } = req.body;

    if (![name, email, phone, dob, aadhaar].every(
      value => typeof value === 'string' && value.trim()
    )) {
      return res.status(400).json({ error: 'Name, email, phone, DOB and Aadhaar are required.' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email.' });
    }

    if (!isValidDate(dob)) {
      return res.status(400).json({ error: 'Invalid date of birth.' });
    }

    const aadhaarNumber = aadhaar.replace(/\s/g, '');
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ error: 'Aadhaar must contain 12 digits.' });
    }

    const normalizedVoterId = voterId.trim().toUpperCase().replace(/\s/g, '');
    const normalizedPassport = passportNumber.trim().toUpperCase().replace(/\s/g, '');
    const normalizedLicence = drivingLicence.trim().toUpperCase().replace(/\s/g, '');

    // Typical Indian EPIC format: ABC1234567
    if (normalizedVoterId && !/^[A-Z]{3}\d{7}$/.test(normalizedVoterId)) {
      return res.status(400).json({ error: 'Invalid Voter ID format.' });
    }

    // Typical Indian passport format: A1234567
    if (normalizedPassport && !/^[A-Z][0-9]{7}$/.test(normalizedPassport)) {
      return res.status(400).json({ error: 'Invalid passport number format.' });
    }

    if (normalizedLicence && !/^[A-Z0-9-]{8,40}$/.test(normalizedLicence)) {
      return res.status(400).json({ error: 'Invalid driving licence number.' });
    }

    await pool.query(
      `INSERT INTO contacts
        (name, email, phone, dob, aadhaar_hash, voter_id_hash, passport_hash, driving_licence_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        dob,
        hashSensitiveValue(aadhaarNumber),
        normalizedVoterId ? hashSensitiveValue(normalizedVoterId) : null,
        normalizedPassport ? hashSensitiveValue(normalizedPassport) : null,
        normalizedLicence ? hashSensitiveValue(normalizedLicence) : null
      ]
    );

    res.status(201).json({ message: 'Saved.' });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unable to save details.' });
});

ensureDatabase()
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Contact app listening on port ${process.env.PORT || 3000}`);
    });
  })
  .catch(err => {
    console.error('Database setup failed:', err);
    process.exit(1);
  });
