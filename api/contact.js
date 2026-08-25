const nodemailer = require('nodemailer');

const ALLOWED_ORIGINS = [
  'https://aster-solutions.github.io',
  'https://aster-solutions.github.io/aster-solutions',
];

const TO_EMAIL = 'astersolutions.contact@gmail.com';

function setCors(res, origin) {
  if (origin && ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  setCors(res, origin);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (origin && !ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  }

  const {
    name = '',
    email = '',
    topic = '',
    otherTopic = '',
    message = '',
    website = '',
  } = req.body || {};

  if (website) return res.status(200).json({ ok: true });

  const cleanName = String(name).trim().slice(0, 150);
  const cleanEmail = String(email).trim().slice(0, 200);
  const cleanTopic = String(topic).trim().slice(0, 150);
  const cleanOtherTopic = String(otherTopic).trim().slice(0, 200);
  const cleanMessage = String(message).trim().slice(0, 5000);

  if (!cleanName || !cleanEmail || !cleanTopic || !cleanMessage) {
    return res.status(400).json({
      ok: false,
      error: 'Veuillez compléter tous les champs obligatoires.',
    });
  }

  if (cleanTopic === 'Autre besoin' && !cleanOtherTopic) {
    return res.status(400).json({
      ok: false,
      error: 'Veuillez préciser votre besoin.',
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ ok: false, error: 'Adresse e-mail invalide.' });
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.error('Missing SMTP_USER or SMTP_PASS');
    return res.status(503).json({
      ok: false,
      error: 'Le service de contact est temporairement indisponible.',
    });
  }

  const need = cleanTopic === 'Autre besoin' ? cleanOtherTopic : cleanTopic;
  const subject = `Demande ASTER Solutions — ${need}`;

  const text = [
    'Nouvelle demande depuis le site ASTER Solutions',
    '',
    `Nom / organisation : ${cleanName}`,
    `E-mail : ${cleanEmail}`,
    `Type de besoin : ${need}`,
    '',
    'Message :',
    cleanMessage,
  ].join('\n');

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `ASTER Solutions Website <${smtpUser}>`,
      to: TO_EMAIL,
      replyTo: cleanEmail,
      subject,
      text,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('SMTP send error', error);
    return res.status(500).json({
      ok: false,
      error: "L'envoi a échoué. Merci de réessayer dans quelques instants.",
    });
  }
};
