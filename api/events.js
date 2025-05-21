import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const sqlite = sqlite3.verbose();
const db = new sqlite.Database('./events.db');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    console.log('Received request for events');
    db.all('SELECT * FROM events ORDER BY date ASC', (err, events) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log(`Returning ${events.length} events`);
      res.json(events);
    });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 