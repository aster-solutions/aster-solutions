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

  // Honeypot anti-spam field.
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

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.error('Missing RESEND_API_KEY or FROM_EMAIL');
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
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [TO_EMAIL],
        reply_to: cleanEmail,
        subject,
        text,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Resend error', response.status, data);
      return res.status(500).json({
        ok: false,
        error: "L'envoi a échoué. Merci de réessayer dans quelques instants.",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact API error', error);
    return res.status(500).json({
      ok: false,
      error: "L'envoi a échoué. Merci de réessayer dans quelques instants.",
    });
  }
};

// Git-connected deployment trigger: 2026-08-25
