import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const sqlite = sqlite3.verbose();
const db = new sqlite.Database('./events.db');
const app = express();

// Initialize database
db.serialize(() => {
  console.log('Initializing database...');
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      date TEXT,
      time TEXT,
      location TEXT,
      price TEXT,
      image_url TEXT,
      source_url TEXT,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating events table:', err);
    else console.log('Events table ready');
  });
  
  db.run(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      event_id TEXT,
      FOREIGN KEY(event_id) REFERENCES events(id)
    )
  `, (err) => {
    if (err) console.error('Error creating subscribers table:', err);
    else console.log('Subscribers table ready');
  });
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Scraper function
async function scrapeEvents() {
  console.log('Starting event scraping...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  const events = [];

  // Scrape TimeOut Sydney
  try {
    console.log('Scraping TimeOut Sydney...');
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    await page.goto('https://www.timeout.com/sydney/things-to-do/best-sydney-events', {
      timeout: 60000,
      waitUntil: 'networkidle0'
    });

    // Wait for content to load
    await page.waitForSelector('.card__content, .article-card', { timeout: 10000 });

    const timeoutEvents = await page.evaluate(() => {
      const cards = document.querySelectorAll('.card__content, .article-card');
      console.log(`Found ${cards.length} TimeOut events`);
      return Array.from(cards).map(el => {
        const titleEl = el.querySelector('.card__title, .article-card__title');
        const dateEl = el.querySelector('.card__date, .article-card__date');
        const descEl = el.querySelector('.card__desc, .article-card__desc');
        const linkEl = el.querySelector('a');

        if (!titleEl?.textContent) return null;

        return {
          title: titleEl.textContent.trim(),
          description: descEl?.textContent?.trim() || '',
          date: dateEl?.textContent?.trim() || 'Check website',
          location: 'Sydney',
          source_url: linkEl?.href || '',
        };
      }).filter(Boolean);
    });

    console.log(`Scraped ${timeoutEvents.length} events from TimeOut`);
    events.push(...timeoutEvents);
  } catch (err) {
    console.error('Error scraping TimeOut:', err);
  }

  // Scrape Eventbrite Sydney
  try {
    console.log('Scraping Eventbrite...');
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    await page.goto('https://www.eventbrite.com.au/d/australia--sydney/all-events/', {
      timeout: 60000,
      waitUntil: 'networkidle0'
    });

    // Wait for any event-related content
    await page.waitForSelector('[data-testid="event-card"], .eds-event-card, .eds-media-card-content', { timeout: 10000 });

    const eventbriteEvents = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="event-card"], .eds-event-card, .eds-media-card-content');
      console.log(`Found ${cards.length} Eventbrite events`);
      return Array.from(cards).map(el => {
        const titleEl = el.querySelector('h2, .eds-event-card__formatted-name');
        const dateEl = el.querySelector('time, .eds-event-card__formatted-date');
        const descEl = el.querySelector('p, .eds-event-card__description');
        const locationEl = el.querySelector('[data-testid="venue-name"], .eds-event-card__formatted-address');
        const priceEl = el.querySelector('[data-testid="price-range"], .eds-event-card__formatted-price');
        const imgEl = el.querySelector('img');
        const linkEl = el.querySelector('a');

        if (!titleEl?.textContent) return null;

        return {
          title: titleEl.textContent.trim(),
          description: descEl?.textContent?.trim() || '',
          date: dateEl?.textContent?.trim() || 'Check website',
          location: locationEl?.textContent?.trim() || 'Sydney',
          price: priceEl?.textContent?.trim() || 'Price varies',
          image_url: imgEl?.src || '',
          source_url: linkEl?.href || '',
        };
      }).filter(Boolean);
    });

    console.log(`Scraped ${eventbriteEvents.length} events from Eventbrite`);
    events.push(...eventbriteEvents);
  } catch (err) {
    console.error('Error scraping Eventbrite:', err);
  }

  await browser.close();
  console.log(`Total events scraped: ${events.length}`);

  // Save to DB
  if (events.length > 0) {
    console.log('Saving events to database...');
    events.forEach(event => {
      const formattedDate = dayjs(event.date).format('YYYY-MM-DD');
      db.run(
        `INSERT OR REPLACE INTO events 
         (id, title, description, date, time, location, price, image_url, source_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          event.title,
          event.description,
          formattedDate,
          event.time || 'Check website',
          event.location,
          event.price,
          event.image_url,
          event.source_url
        ],
        err => {
          if (err) console.error('Error inserting event:', err);
          else console.log('Event inserted:', event.title);
        }
      );
    });
  } else {
    console.log('No events to save to database');
  }
}

// API endpoints
app.get('/api/events', (req, res) => {
  console.log('Received request for events');
  db.all('SELECT * FROM events ORDER BY date ASC', (err, events) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    console.log(`Returning ${events.length} events`);
    res.json(events);
  });
});

app.post('/api/subscribe', (req, res) => {
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
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start initial scrape
  console.log('Starting initial event scrape...');
  scrapeEvents().catch(err => {
    console.error('Error during initial scrape:', err);
  });
});

// Schedule scraping (every 6 hours)
setInterval(() => {
  console.log('Starting scheduled event scrape...');
  scrapeEvents().catch(err => {
    console.error('Error during scheduled scrape:', err);
  });
}, 6 * 60 * 60 * 1000);

// Add a test endpoint to manually trigger scraping
app.post('/api/scrape', async (req, res) => {
  try {
    console.log('Manual scrape triggered');
    await scrapeEvents();
    res.json({ message: 'Scraping completed' });
  } catch (err) {
    console.error('Error during manual scrape:', err);
    res.status(500).json({ error: 'Scraping failed' });
  }
});
