import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

const sqlite = sqlite3.verbose();
const db = new sqlite.Database('./events.db');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, eventId } = req.body;
    if (!email || !eventId) return res.status(400).json({ error: 'Missing data' });

    db.get('SELECT * FROM subscribers WHERE email = ? AND event_id = ?', [email, eventId], (err, existing) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (existing) return res.status(400).json({ error: 'Already subscribed' });

      db.run('INSERT INTO subscribers (id, email, event_id) VALUES (?, ?, ?)', [uuidv4(), email, eventId], err => {
        if (err) return res.status(400).json({ error: 'Subscription failed' });

        db.get('SELECT source_url FROM events WHERE id = ?', [eventId], (err, event) => {
          if (err || !event) return res.status(404).json({ error: 'Event not found' });
          res.json({ redirectUrl: event.source_url });
        });
      });
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 